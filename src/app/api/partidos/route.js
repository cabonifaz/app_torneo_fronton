import pool from '../../../lib/db';
import { NextResponse } from 'next/server';
import { obtenerTorneoPorId } from '../../../lib/torneo';
import { reglasFase, validarSets, validarMarcadorVivo } from '../../../lib/formatos';
import { rolEnTorneo, puedeAdministrar, puedeArbitrar } from '../../../lib/auth';
import { notificarCambio } from '../../../lib/torneo-en-vivo';

const FASES_PERMITIDAS = ['grupos', 'cuartos', 'semifinal', 'final', 'liga'];
const LIMPIAR = 'jugado = 0, en_juego = 0, puntos_pareja1 = 0, puntos_pareja2 = 0, sets_pareja1 = NULL, sets_pareja2 = NULL, detalle_sets = NULL, reloj_estado = NULL, reloj_inicio = NULL, reloj_acumulado = 0, duracion_sets = NULL';
const error = (mensaje, status = 400) => NextResponse.json({ error: mensaje }, { status });
const ok = torneoId => { notificarCambio(torneoId); return NextResponse.json({ success: true }); };

// Todas las operaciones van acotadas a un torneo y exigen sesión con permiso sobre él
async function contexto(body, permiso) {
  const torneoId = Number(body.torneo_id);
  if (!Number.isInteger(torneoId) || torneoId <= 0) return { respuesta: error('Torneo no válido') };
  const torneo = await obtenerTorneoPorId(torneoId);
  if (!torneo) return { respuesta: error('Torneo no válido') };
  const rol = await rolEnTorneo(torneo.id);
  if (!permiso(rol)) return { respuesta: error(rol ? 'No tienes permiso para esta acción' : 'Inicia sesión para continuar', rol ? 403 : 401) };
  return { torneo, rol };
}

// Comprueba que las parejas pertenezcan al torneo (evita mezclar parejas de torneos distintos)
async function parejasDelTorneo(torneoId, ids) {
  const [filas] = await pool.query('SELECT COUNT(*) AS n FROM parejas WHERE torneo_id = ? AND id IN (?)', [torneoId, ids]);
  return filas[0].n === new Set(ids).size;
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, puntos_pareja1, puntos_pareja2, pareja1_id, pareja2_id, reset, reset_parejas, vaciar_fase, sets, marcador_vivo, reloj } = body;
    // El árbitro solo carga marcadores (en vivo o el final) y maneja el reloj; el resto es del admin
    const esDeArbitro = marcador_vivo !== undefined || reloj !== undefined || (sets && !reset && !reset_parejas);
    const { torneo, respuesta } = await contexto(body, esDeArbitro ? puedeArbitrar : puedeAdministrar);
    if (respuesta) return respuesta;

    if (vaciar_fase) {
      // Anula el sorteo de la Fase 2: los partidos de las series se conservan, vacíos
      if (vaciar_fase !== 'cuartos') return error('Fase no permitida');
      await pool.query(`UPDATE partidos SET pareja1_id = NULL, pareja2_id = NULL, ${LIMPIAR} WHERE fase = 'cuartos' AND torneo_id = ?`, [torneo.id]);
      return ok(torneo.id);
    }

    const [[partido]] = await pool.query(
      'SELECT id, fase, jugado, pareja1_id, pareja2_id, sets_pareja1, sets_pareja2, reloj_estado, reloj_inicio, reloj_acumulado, duracion_sets FROM partidos WHERE id = ? AND torneo_id = ?',
      [id, torneo.id]
    );
    if (!partido) return error('Partido no encontrado en este torneo', 404);
    const reglas = reglasFase(torneo.formato, partido.fase);
    const ahora = Date.now();

    if (reloj !== undefined) {
      // Cronómetro del set en curso: lo controla el árbitro, la hora la pone el servidor
      if (partido.jugado) return error('El partido ya está finalizado', 409);
      if (!partido.pareja1_id || !partido.pareja2_id) return error('El partido aún no tiene parejas');
      const r = transicionReloj(partido, reloj, ahora);
      if (r.error) return error(r.error);
      await pool.query('UPDATE partidos SET en_juego = 1, reloj_estado = ?, reloj_inicio = ?, reloj_acumulado = ? WHERE id = ? AND jugado = 0', [r.estado, r.inicio, r.acumulado, id]);
    } else if (marcador_vivo !== undefined) {
      // Marcador punto a punto desde la pantalla del árbitro: no cuenta para la tabla hasta finalizar
      if (partido.jugado) return error('El partido ya está finalizado. Pide al admin que lo resetee para corregirlo.', 409);
      if (!partido.pareja1_id || !partido.pareja2_id) return error('El partido aún no tiene parejas');
      const v = validarMarcadorVivo(marcador_vivo, reglas);
      if (v.error) return error(v.error);
      const r = relojTrasMarcador(partido, v, ahora);
      await pool.query(
        'UPDATE partidos SET en_juego = 1, detalle_sets = ?, sets_pareja1 = ?, sets_pareja2 = ?, puntos_pareja1 = ?, puntos_pareja2 = ?, reloj_estado = ?, reloj_inicio = ?, reloj_acumulado = ?, duracion_sets = ? WHERE id = ? AND jugado = 0',
        [JSON.stringify(v.detalle), v.sets1, v.sets2, v.puntos1, v.puntos2, r.estado, r.inicio, r.acumulado, JSON.stringify(r.duraciones), id]
      );
    } else if (reset_parejas) {
      await pool.query(`UPDATE partidos SET pareja1_id = NULL, pareja2_id = NULL, ${LIMPIAR} WHERE id = ?`, [id]);
    } else if (reset) {
      await pool.query(`UPDATE partidos SET ${LIMPIAR} WHERE id = ?`, [id]);
    } else if (pareja1_id && pareja2_id) {
      if (pareja1_id === pareja2_id || !(await parejasDelTorneo(torneo.id, [pareja1_id, pareja2_id]))) return error('Parejas no válidas');
      await pool.query('UPDATE partidos SET pareja1_id = ?, pareja2_id = ? WHERE id = ?', [pareja1_id, pareja2_id, id]);
    } else if (sets) {
      // Partido al mejor de N: el servidor recalcula sets y puntos totales a partir del detalle
      const v = validarSets(sets, reglas);
      if (v.error) return error(v.error);
      // Al finalizar, el reloj se detiene y las duraciones de los sets se conservan para el público.
      // Si el cierre del último set aún no había llegado (el árbitro finaliza enseguida), su duración se guarda aquí.
      const duraciones = Array.isArray(partido.duracion_sets) ? [...partido.duracion_sets] : [];
      const cerradosAntes = (partido.sets_pareja1 || 0) + (partido.sets_pareja2 || 0);
      if (v.sets1 + v.sets2 > cerradosAntes && ['en_juego', 'pausado'].includes(partido.reloj_estado)) duraciones.push(tiempoActual(partido, ahora));
      await pool.query(
        'UPDATE partidos SET puntos_pareja1 = ?, puntos_pareja2 = ?, sets_pareja1 = ?, sets_pareja2 = ?, detalle_sets = ?, jugado = 1, en_juego = 0, reloj_estado = NULL, reloj_inicio = NULL, reloj_acumulado = 0, duracion_sets = ? WHERE id = ?',
        [v.puntos1, v.puntos2, v.sets1, v.sets2, JSON.stringify(v.sets), duraciones.length ? JSON.stringify(duraciones) : null, id]
      );
    } else {
      await pool.query('UPDATE partidos SET puntos_pareja1 = ?, puntos_pareja2 = ?, jugado = 1 WHERE id = ?', [puntos_pareja1, puntos_pareja2, id]);
    }

    return ok(torneo.id);
  } catch (e) {
    console.error('Error al actualizar partido:', e);
    return error('Error interno', 500);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { torneo, respuesta } = await contexto(body, puedeAdministrar);
    if (respuesta) return respuesta;
    const { fase, pareja1_id, pareja2_id } = body;
    if (!FASES_PERMITIDAS.includes(fase)) return error('Fase no permitida');
    if (pareja1_id === pareja2_id || !(await parejasDelTorneo(torneo.id, [pareja1_id, pareja2_id]))) return error('Parejas no válidas');

    await pool.query(
      'INSERT INTO partidos (torneo_id, fase, pareja1_id, pareja2_id, grupo_id, puntos_pareja1, puntos_pareja2, jugado) VALUES (?, ?, ?, ?, NULL, 0, 0, 0)',
      [torneo.id, fase, pareja1_id, pareja2_id]
    );
    return ok(torneo.id);
  } catch (e) {
    console.error("Error al insertar partido:", e);
    return error('Error interno', 500);
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const { torneo, respuesta } = await contexto(body, puedeAdministrar);
    if (respuesta) return respuesta;
    // Solo fases de eliminación: los partidos de grupos/liga/series son la estructura del torneo
    if (!['semifinal', 'final'].includes(body.fase)) return error('Fase no permitida');

    await pool.query('DELETE FROM partidos WHERE fase = ? AND torneo_id = ?', [body.fase, torneo.id]);
    return ok(torneo.id);
  } catch (e) {
    console.error("Error al eliminar partidos:", e);
    return error('Error interno', 500);
  }
}

// ── Reloj del set ──
// Tiempo del set en curso según lo guardado (si está corriendo, suma lo transcurrido hasta `ahora`)
const tiempoActual = (p, ahora) => (p.reloj_acumulado || 0) + (p.reloj_estado === 'en_juego' && p.reloj_inicio ? Math.max(0, ahora - Number(p.reloj_inicio)) : 0);

function transicionReloj(p, accion, ahora) {
  switch (accion) {
    case 'empezar':
    case 'reanudar':
      if (p.reloj_estado === 'en_juego') return { estado: 'en_juego', inicio: p.reloj_inicio, acumulado: p.reloj_acumulado || 0 };
      return { estado: 'en_juego', inicio: ahora, acumulado: p.reloj_acumulado || 0 };
    case 'pausar':
      if (p.reloj_estado !== 'en_juego') return { error: 'El reloj no está corriendo' };
      return { estado: 'pausado', inicio: null, acumulado: tiempoActual(p, ahora) };
    default:
      return { error: 'Acción de reloj no válida' };
  }
}

// Al cambiar el marcador: el primer punto arranca el reloj; cerrar un set guarda su duración y deja
// el reloj listo para el siguiente; deshacer un cierre recupera esa duración (en pausa)
function relojTrasMarcador(p, v, ahora) {
  const duraciones = Array.isArray(p.duracion_sets) ? [...p.duracion_sets] : [];
  const cerradosAntes = (p.sets_pareja1 || 0) + (p.sets_pareja2 || 0);
  const cerradosAhora = v.sets1 + v.sets2;
  let estado = p.reloj_estado, inicio = p.reloj_inicio, acumulado = p.reloj_acumulado || 0;

  if (cerradosAhora > cerradosAntes) {
    duraciones.push(tiempoActual(p, ahora));
    estado = 'entre_sets'; inicio = null; acumulado = 0;
  } else if (cerradosAhora < cerradosAntes) {
    acumulado = duraciones.pop() || 0;
    estado = 'pausado'; inicio = null;
  } else if (!estado || estado === 'entre_sets') {
    const puntos = v.detalle[cerradosAhora];
    if (puntos && (puntos[0] > 0 || puntos[1] > 0)) { estado = 'en_juego'; inicio = ahora; acumulado = 0; }
  }
  return { estado, inicio, acumulado, duraciones };
}
