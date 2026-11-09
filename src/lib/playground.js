// Herramientas del playground: torneos de prueba aislados y simulación de resultados.
// Solo actúan sobre torneos con es_prueba = 1, nunca sobre torneos reales.
import pool from './db.js';
import { crearTorneoRelampago } from './crear-torneo.js';
import { obtenerDatosTorneo, obtenerTorneoPorId } from './torneo.js';
import { reglasFase, validarSets } from './formatos.js';
import { resumenRelampago } from './relampago.js';
import { hashClave } from './auth.js';
import { notificarCambio } from './torneo-en-vivo.js';

// Claves fijas de los torneos de prueba (solo existen en entornos con el playground habilitado)
export const CLAVES_PRUEBA = { admin: '1111', arbitro: '2222' };

export const playgroundHabilitado = () => process.env.PLAYGROUND_HABILITADO === '1';

const PAREJAS_DEMO = ['Los Veteranos', 'Dupla Capullana', 'Revés de Oro', 'Pared Firme'];

// Escenario de desempate (orden de cruces: A-B, C-D, A-C, B-D, A-D, B-C).
// A, B y C terminan con 4 puntos. A gana por diferencia de sets (+3); B y C empatan en sets (+1)
// y decide la diferencia de puntos: C (+11) por delante de B (-2). Orden esperado: A, C, B, D.
export const ESCENARIO_DESEMPATE = [
  [[15, 10], [15, 12]],           // A 2-0 B
  [[15, 8], [10, 15], [15, 9]],   // C 2-1 D
  [[15, 13], [11, 15], [13, 15]], // A 1-2 C
  [[15, 12], [15, 13]],           // B 2-0 D
  [[15, 11], [15, 11]],           // A 2-0 D
  [[15, 14], [14, 15], [15, 14]], // B 2-1 C
];

// Empate total entre A, B y C (ciclo con marcadores idénticos): ningún criterio de las bases lo resuelve
export const ESCENARIO_EMPATE_TOTAL = [
  [[15, 10], [15, 10]],  // A gana a B
  [[15, 10], [15, 10]],  // C gana a D
  [[10, 15], [10, 15]],  // C gana a A
  [[15, 10], [15, 10]],  // B gana a D
  [[15, 10], [15, 10]],  // A gana a D
  [[15, 10], [15, 10]],  // B gana a C
];

const azar = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// Resultado aleatorio pero válido al mejor de 3: el ganador llega al tope de cada set que gana
export function resultadoAleatorio({ puntosSet }) {
  const ganaPrimera = Math.random() < 0.5;
  const tresSets = Math.random() < 0.4;
  const set = ganaUno => {
    const perdedor = azar(Math.floor(puntosSet / 3), puntosSet - 2);
    return ganaUno ? [puntosSet, perdedor] : [perdedor, puntosSet];
  };
  return tresSets ? [set(ganaPrimera), set(!ganaPrimera), set(ganaPrimera)] : [set(ganaPrimera), set(ganaPrimera)];
}

async function torneoDePrueba(torneoId) {
  const torneo = await obtenerTorneoPorId(torneoId);
  if (!torneo) throw new ErrorPlayground('Torneo no encontrado', 404);
  if (!torneo.es_prueba) throw new ErrorPlayground('El playground solo modifica torneos de prueba', 403);
  return torneo;
}

export class ErrorPlayground extends Error {
  constructor(mensaje, status = 400) { super(mensaje); this.status = status; }
}

async function guardarResultado(torneo, partido, sets) {
  const v = validarSets(sets, reglasFase(torneo, partido.fase));
  if (v.error) throw new ErrorPlayground(`Partido ${partido.id}: ${v.error}`);
  await pool.query(
    'UPDATE partidos SET puntos_pareja1 = ?, puntos_pareja2 = ?, sets_pareja1 = ?, sets_pareja2 = ?, detalle_sets = ?, jugado = 1 WHERE id = ? AND torneo_id = ?',
    [v.puntos1, v.puntos2, v.sets1, v.sets2, JSON.stringify(v.sets), partido.id, torneo.id]
  );
}

const LIMPIAR = 'jugado = 0, puntos_pareja1 = 0, puntos_pareja2 = 0, sets_pareja1 = NULL, sets_pareja2 = NULL, detalle_sets = NULL';

export async function listarTorneosPrueba() {
  const [filas] = await pool.query('SELECT id, slug, nombre, subtitulo, formato, creado_en FROM torneo WHERE es_prueba = 1 ORDER BY id DESC');
  return filas;
}

export async function ejecutarAccion(peticion) {
  const resultado = await ejecutar(peticion);
  if (peticion.torneo_id) notificarCambio(Number(peticion.torneo_id));
  return resultado;
}

async function ejecutar({ accion, torneo_id, parejas }) {
  if (accion === 'crear') {
    const sello = new Date().toISOString().replace(/[-:T]/g, '').slice(4, 14); // MMDDhhmmss
    return crearTorneoRelampago({
      slug: `prueba-relampago-${sello}`,
      nombre: `Relámpago · Prueba ${sello.slice(4, 6)}:${sello.slice(6, 8)}`,
      subtitulo: 'Dobles Varones +45 (torneo de prueba)',
      organizador: 'Front On',
      cancha: 'Cancha de pruebas',
      horario: 'Simulación',
      parejas: Array.isArray(parejas) && parejas.length === 4 ? parejas : PAREJAS_DEMO,
      esPrueba: true,
    }).then(async (t) => {
      await pool.query('UPDATE torneo SET clave_admin = ?, clave_arbitro = ? WHERE id = ?', [hashClave(CLAVES_PRUEBA.admin), hashClave(CLAVES_PRUEBA.arbitro), t.id]);
      return t;
    });
  }

  const torneo = await torneoDePrueba(Number(torneo_id));
  const datos = await obtenerDatosTorneo(torneo.id);
  const r = resumenRelampago(datos);
  const liga = r.liga;

  switch (accion) {
    case 'simular_ronda': {
      if (!r.proximos.length || r.faseActual !== 'liga') throw new ErrorPlayground('No quedan rondas pendientes en la liga');
      for (const p of r.proximos) await guardarResultado(torneo, p, resultadoAleatorio(reglasFase(torneo, 'liga')));
      return { mensaje: `Ronda ${r.proximos[0].ronda} simulada` };
    }
    case 'simular_liga': {
      const pendientes = liga.filter(p => !p.jugado);
      for (const p of pendientes) await guardarResultado(torneo, p, resultadoAleatorio(reglasFase(torneo, 'liga')));
      return { mensaje: `${pendientes.length} partidos simulados` };
    }
    case 'escenario_desempate':
    case 'escenario_empate_total': {
      const escenario = accion === 'escenario_desempate' ? ESCENARIO_DESEMPATE : ESCENARIO_EMPATE_TOTAL;
      await pool.query("DELETE FROM partidos WHERE torneo_id = ? AND fase = 'final'", [torneo.id]);
      for (let i = 0; i < liga.length; i++) await guardarResultado(torneo, liga[i], escenario[i]);
      return { mensaje: 'Escenario cargado (la final se borró para volver a armarla)' };
    }
    case 'armar_final': {
      if (!r.ligaTerminada) throw new ErrorPlayground('La liga no está terminada');
      if (datos.partidos.some(p => p.fase === 'final')) throw new ErrorPlayground('La final ya está armada');
      if (r.corteEmpatado) throw new ErrorPlayground('Empate sin resolver por el 2° puesto: elige los finalistas en el panel');
      await pool.query(
        "INSERT INTO partidos (torneo_id, fase, pareja1_id, pareja2_id, grupo_id, puntos_pareja1, puntos_pareja2, jugado) VALUES (?, 'final', ?, ?, NULL, 0, 0, 0)",
        [torneo.id, r.finalistas[0].pareja_id, r.finalistas[1].pareja_id]
      );
      return { mensaje: `Final armada: ${r.finalistas[0].nombre_pareja} vs ${r.finalistas[1].nombre_pareja}` };
    }
    case 'simular_final': {
      const final = datos.partidos.find(p => p.fase === 'final');
      if (!r.ligaTerminada || !final) throw new ErrorPlayground('Primero termina la liga y arma la final');
      await guardarResultado(torneo, final, resultadoAleatorio(reglasFase(torneo, 'final')));
      return { mensaje: 'Final simulada' };
    }
    case 'reiniciar': {
      await pool.query("DELETE FROM partidos WHERE torneo_id = ? AND fase = 'final'", [torneo.id]);
      await pool.query(`UPDATE partidos SET ${LIMPIAR} WHERE torneo_id = ?`, [torneo.id]);
      return { mensaje: 'Resultados borrados' };
    }
    case 'eliminar': {
      // ON DELETE CASCADE borra grupos, parejas y partidos del torneo de prueba
      await pool.query('DELETE FROM torneo WHERE id = ? AND es_prueba = 1', [torneo.id]);
      return { mensaje: 'Torneo de prueba eliminado' };
    }
    default:
      throw new ErrorPlayground('Acción desconocida');
  }
}
