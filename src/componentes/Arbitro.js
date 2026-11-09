"use client";
// Pantalla del árbitro: elegir partido y llevar el marcador punto a punto.
// Cada toque se guarda al instante y llega a la vista pública por SSE, sin recargar.
import { useEffect, useRef, useState } from 'react';
import s from './arbitro.module.css';
import { useTorneoEnVivo } from '../lib/useTorneoEnVivo';
import { reglasFase, marcadorDePartido, ganaPareja1, textoSets, ETIQUETAS_FASE, tiempoSetActual, formatearTiempo, estadoPartido } from '../lib/formatos';
import { useAhora } from '../lib/useReloj';
import { rondaYCancha } from '../lib/relampago';
import Guia from './Guia';

const json = { 'Content-Type': 'application/json' };

// Etiqueta legible del partido según el formato
function contextoPartido(p, datos) {
  if (p.fase === 'liga') {
    const indice = datos.partidos.filter(x => x.fase === 'liga').findIndex(x => x.id === p.id);
    const { ronda, cancha } = rondaYCancha(indice);
    return `Ronda ${ronda} · Cancha ${cancha}`;
  }
  if (p.fase === 'grupos' || p.fase === 'cuartos') return p.nombre_grupo;
  return ETIQUETAS_FASE[p.fase] || p.fase;
}

export default function Arbitro({ torneo }) {
  const { datos, conexion, desfase } = useTorneoEnVivo(torneo.slug);
  const [partidoId, setPartidoId] = useState(null);

  // El partido elegido se recuerda en la URL (?partido=) para sobrevivir a una recarga accidental
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('partido'));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) setPartidoId(id);
  }, []);
  const elegir = (id) => {
    setPartidoId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('partido', id); else url.searchParams.delete('partido');
    window.history.replaceState(null, '', url);
  };

  if (!datos) {
    return <div className={s.pagina}><div className={s.lista}><p className={s.sub}>{conexion === 'reconectando' ? 'Reconectando…' : 'Cargando partidos…'}</p></div></div>;
  }

  const partido = datos.partidos.find(p => p.id === partidoId);
  if (partido) {
    return (
      <div className={s.pagina}>
        <Marcador key={partido.id} torneo={datos.torneo || torneo} partido={partido} contexto={contextoPartido(partido, datos)} onVolver={() => elegir(null)} desfase={desfase} />
      </div>
    );
  }

  return <ListaPartidos torneo={datos.torneo || torneo} datos={datos} onElegir={elegir} />;
}

function ListaPartidos({ torneo, datos, onElegir }) {
  const conParejas = datos.partidos.filter(p => p.pareja1_id && p.pareja2_id);
  const enJuego = conParejas.filter(p => p.en_juego === 1 && !p.jugado);
  const pendientes = conParejas.filter(p => !p.en_juego && !p.jugado);
  const jugados = conParejas.filter(p => p.jugado === 1);

  const salir = async () => {
    await fetch('/api/auth', { method: 'DELETE', headers: json, body: JSON.stringify({ torneo_id: torneo.id }) });
    window.location.assign(`/t/${torneo.slug}/login?rol=arbitro`);
  };

  const item = (p) => (
    <button key={p.id} onClick={() => onElegir(p.id)} data-testid={`arbitro-partido-${p.id}`}
      className={`${s.itemPartido} ${p.en_juego && !p.jugado ? s.itemEnJuego : ''} ${p.jugado ? s.itemJugado : ''}`}>
      <span className={s.itemContexto}>
        <span>{contextoPartido(p, datos)}</span>
        {p.en_juego === 1 && !p.jugado && <span className={p.reloj_estado === 'pausado' ? s.badgePausa : s.badgeVivo}>{p.reloj_estado === 'pausado' ? '⏸ Pausado' : estadoPartido(p).codigo === 'entre_sets' ? 'Entre sets' : '● En juego'}</span>}
        {p.jugado === 1 && <span>{textoSets(p) || `${p.puntos_pareja1}-${p.puntos_pareja2}`}</span>}
      </span>
      <span className={s.itemVs}>{p.nombre_pareja1}<span>vs</span>{p.nombre_pareja2}</span>
    </button>
  );

  return (
    <div className={s.pagina}>
      <div className={s.lista}>
        <div className={s.cabecera}>
          <div>
            <h1 className={s.tituloTorneo}>{torneo.nombre}</h1>
            <p className={s.sub}>Árbitro · elige tu partido</p>
          </div>
          <button className={s.salir} onClick={salir}>Salir</button>
        </div>
        {enJuego.length > 0 && <><p className={s.seccion}>En juego</p>{enJuego.map(item)}</>}
        <p className={s.seccion}>Por jugar</p>
        {pendientes.length ? pendientes.map(item) : <p className={s.sub}>No hay partidos pendientes con parejas definidas.</p>}
        {jugados.length > 0 && <><p className={s.seccion}>Finalizados</p>{jugados.map(item)}</>}
        <Guia id="arbitro-lista" />
      </div>
    </div>
  );
}

function Marcador({ torneo, partido, contexto, onVolver, desfase = 0 }) {
  const reglas = reglasFase(torneo.formato, partido.fase);
  const ahora = useAhora(desfase, partido.reloj_estado === 'en_juego');
  const necesarios = Math.ceil(reglas.mejorDe / 2);

  const [estado, setEstado] = useState(() => {
    const m = marcadorDePartido(partido);
    const decidido = m.cerrados.filter(x => x[0] > x[1]).length >= necesarios || m.cerrados.filter(x => x[1] > x[0]).length >= necesarios;
    return { cerrados: m.cerrados, actual: m.actual || (decidido ? null : [0, 0]) };
  });
  const [historial, setHistorial] = useState([]);
  const [invertido, setInvertido] = useState(false);
  const [guardado, setGuardado] = useState('ok'); // ok | guardando | error
  const [mensaje, setMensaje] = useState(null);
  const [finalizando, setFinalizando] = useState(false);

  // ── Envío en serie: siempre se manda el último estado, nunca dos peticiones a la vez ──
  const cola = useRef({ pendiente: null, enviando: false });
  const enviar = async () => {
    const c = cola.current;
    if (c.enviando || !c.pendiente) return;
    c.enviando = true;
    const marcador = c.pendiente;
    c.pendiente = null;
    try {
      const res = await fetch('/api/partidos', { method: 'PUT', headers: json, body: JSON.stringify({ torneo_id: torneo.id, id: partido.id, marcador_vivo: marcador }) });
      if (res.status === 401) { window.location.assign(`/t/${torneo.slug}/login?rol=arbitro`); return; }
      if (!res.ok) {
        const r = await res.json().catch(() => ({}));
        setMensaje({ tipo: 'error', texto: r.error || 'No se pudo guardar' });
        setGuardado('error');
      } else if (!c.pendiente) {
        setGuardado('ok');
      }
    } catch {
      // Sin conexión: se reintenta con el último estado
      c.pendiente ??= marcador;
      setGuardado('error');
      setTimeout(enviar, 2000);
    } finally {
      c.enviando = false;
      if (c.pendiente) enviar();
    }
  };

  const aplicar = (nuevo) => {
    setHistorial(h => [...h.slice(-200), estado]);
    setEstado(nuevo);
    setMensaje(null);
    setGuardado('guardando');
    cola.current.pendiente = nuevo;
    enviar();
    navigator.vibrate?.(12);
  };

  const deshacer = () => {
    if (!historial.length) return;
    const anterior = historial[historial.length - 1];
    setHistorial(h => h.slice(0, -1));
    setEstado(anterior);
    setGuardado('guardando');
    cola.current.pendiente = anterior;
    enviar();
  };

  // Mantener la pantalla encendida mientras se arbitra
  useEffect(() => {
    let bloqueo;
    const pedir = () => navigator.wakeLock?.request('screen').then(b => { bloqueo = b; }).catch(() => {});
    pedir();
    const alVolver = () => { if (document.visibilityState === 'visible') pedir(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { bloqueo?.release?.(); document.removeEventListener('visibilitychange', alVolver); };
  }, []);

  const sets1 = estado.cerrados.filter(x => x[0] > x[1]).length;
  const sets2 = estado.cerrados.filter(x => x[1] > x[0]).length;
  const decidido = sets1 >= necesarios || sets2 >= necesarios;
  const actual = estado.actual;
  const lider = actual && actual[0] !== actual[1] ? (actual[0] > actual[1] ? 0 : 1) : null;
  const setListo = lider !== null && actual[lider] >= reglas.puntosSet;

  // Reloj: estado que viene del servidor por la transmisión
  const corriendo = partido.reloj_estado === 'en_juego';
  const pausado = partido.reloj_estado === 'pausado';
  const duraciones = Array.isArray(partido.duracion_sets) ? partido.duracion_sets : [];
  const accionReloj = async (accion) => {
    const res = await fetch('/api/partidos', { method: 'PUT', headers: json, body: JSON.stringify({ torneo_id: torneo.id, id: partido.id, reloj: accion }) });
    if (!res.ok) setMensaje({ tipo: 'error', texto: (await res.json().catch(() => ({}))).error || 'No se pudo cambiar el reloj' });
  };

  const sumar = (lado, delta) => {
    if (!actual) return;
    if (pausado) { setMensaje({ tipo: 'info', texto: 'El partido está en pausa. Toca «Reanudar» para seguir.' }); return; }
    const nuevo = [...actual];
    nuevo[lado] = Math.max(0, Math.min(99, nuevo[lado] + delta));
    if (nuevo[lado] === actual[lado]) return;
    aplicar({ cerrados: estado.cerrados, actual: nuevo });
  };

  const cerrarSet = () => {
    if (lider === null) return;
    if (!setListo && !confirm(`Nadie llegó a ${reglas.puntosSet}. ¿Cerrar el set ${actual[0]}-${actual[1]} igual?`)) return;
    const cerrados = [...estado.cerrados, actual];
    const g1 = cerrados.filter(x => x[0] > x[1]).length;
    const g2 = cerrados.filter(x => x[1] > x[0]).length;
    aplicar({ cerrados, actual: g1 >= necesarios || g2 >= necesarios ? null : [0, 0] });
  };

  const finalizar = async () => {
    const ganador = sets1 > sets2 ? partido.nombre_pareja1 : partido.nombre_pareja2;
    if (!confirm(`¿Finalizar el partido? Gana ${ganador} (${Math.max(sets1, sets2)}-${Math.min(sets1, sets2)}).`)) return;
    setFinalizando(true);
    try {
      const res = await fetch('/api/partidos', { method: 'PUT', headers: json, body: JSON.stringify({ torneo_id: torneo.id, id: partido.id, sets: estado.cerrados }) });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) setMensaje({ tipo: 'error', texto: r.error || 'No se pudo finalizar' });
    } finally {
      setFinalizando(false);
    }
  };

  // Finalizado (por este árbitro o desde el panel): resumen y vuelta a la lista
  if (partido.jugado === 1) {
    const gana1 = ganaPareja1(partido);
    return (
      <div className={s.terminado} data-testid="arbitro-terminado">
        <p className={s.seccion}>{contexto} · Finalizado</p>
        <p className={s.terminadoGanador}>{gana1 ? partido.nombre_pareja1 : partido.nombre_pareja2}</p>
        <p className={s.sub}>gana {partido.sets_pareja1 != null ? `${Math.max(partido.sets_pareja1, partido.sets_pareja2)}-${Math.min(partido.sets_pareja1, partido.sets_pareja2)}` : ''} · {textoSets(partido)}</p>
        <p className={s.barraSub}>vs {gana1 ? partido.nombre_pareja2 : partido.nombre_pareja1}. Para corregirlo, el admin debe resetearlo desde el panel.</p>
        <button className={`${s.boton} ${s.botonPrincipal}`} onClick={onVolver}>Volver a los partidos</button>
      </div>
    );
  }

  const nombres = [partido.nombre_pareja1, partido.nombre_pareja2];
  const setsLado = [sets1, sets2];
  const orden = invertido ? [1, 0] : [0, 1];

  return (
    <div className={s.marcador}>
      <div className={s.barra}>
        <button className={s.volver} onClick={onVolver} aria-label="Volver a los partidos">‹ Partidos</button>
        <div className={s.barraCentro}>
          <p className={s.barraTitulo}>{contexto}</p>
          <p className={s.barraSub}>Mejor de {reglas.mejorDe} · sets a {reglas.puntosSet}</p>
        </div>
        <span className={`${s.estado} ${guardado === 'ok' ? s.estadoOk : guardado === 'guardando' ? s.estadoGuardando : s.estadoError}`} role="status" data-testid="arbitro-estado">
          {guardado === 'ok' ? '✓ Guardado' : guardado === 'guardando' ? 'Guardando…' : '⚠ Sin guardar'}
        </span>
      </div>

      <div className={s.sets}>
        {estado.cerrados.map((x, i) => (
          <span key={i} className={s.setChip}>Set {i + 1}: {x[0]}-{x[1]}{duraciones[i] != null ? ` · ${formatearTiempo(duraciones[i])}` : ''}</span>
        ))}
        {actual && <span className={`${s.setChip} ${s.setChipActual}`}>Set {estado.cerrados.length + 1}</span>}
      </div>

      {/* Cronómetro del set en curso: lo lleva el servidor; aquí solo se muestra y se controla */}
      {actual && (
        <div className={`${s.reloj} ${pausado ? s.relojPausado : ''}`} data-testid="arbitro-reloj">
          <div>
            <div className={s.relojTiempo} data-testid="arbitro-tiempo">{formatearTiempo(tiempoSetActual(partido, ahora))}</div>
            <div className={s.relojEstado}>{corriendo ? 'Set en juego' : pausado ? 'Pausado' : estado.cerrados.length ? 'Por empezar el siguiente set' : 'Por empezar'}</div>
          </div>
          {corriendo
            ? <button className={s.relojBoton} onClick={() => accionReloj('pausar')} data-testid="arbitro-pausar">⏸ Pausa</button>
            : <button className={`${s.relojBoton} ${s.relojBotonEmpezar}`} onClick={() => accionReloj(pausado ? 'reanudar' : 'empezar')} data-testid="arbitro-empezar">
                {pausado ? '▶ Reanudar' : '▶ Empezar set'}
              </button>}
        </div>
      )}

      {mensaje && <p className={`${s.aviso} ${mensaje.tipo === 'error' ? s.avisoError : s.avisoInfo}`}>{mensaje.texto}</p>}
      {decidido && <p className={`${s.aviso} ${s.avisoInfo}`}>Partido decidido: {sets1}-{sets2}. Confirma con «Finalizar partido».</p>}
      {pausado && <p className={`${s.aviso} ${s.avisoInfo}`}>Partido en pausa: los puntos están bloqueados hasta «Reanudar».</p>}

      <div className={s.lados}>
        {orden.map(lado => (
          <div key={lado} role="button" tabIndex={0} aria-disabled={!actual || pausado}
            className={`${s.lado} ${lider === lado ? s.ladoLider : ''} ${pausado ? s.ladoBloqueado : ''}`}
            onClick={() => sumar(lado, 1)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sumar(lado, 1); } }}
            data-testid={`arbitro-sumar-${lado + 1}`}>
            <span className={s.ladoNombre}>{nombres[lado]}</span>
            <span className={s.ladoSets}>Sets {setsLado[lado]}</span>
            <span className={s.ladoPuntos} data-testid={`arbitro-puntos-${lado + 1}`}>{actual ? actual[lado] : '—'}</span>
            {actual && <span className={s.ladoAyuda}>Toca para sumar punto</span>}
            {actual && (
              <button className={s.restar} aria-label={`Restar punto a ${nombres[lado]}`} data-testid={`arbitro-restar-${lado + 1}`}
                onClick={e => { e.stopPropagation(); sumar(lado, -1); }}>−</button>
            )}
          </div>
        ))}
      </div>

      <div className={s.acciones}>
        <button className={s.boton} onClick={deshacer} disabled={!historial.length} data-testid="arbitro-deshacer">↶ Deshacer</button>
        <button className={s.boton} onClick={() => setInvertido(v => !v)} aria-pressed={invertido} data-guia="arbitro-lados">⇄ Lados</button>
        {decidido ? (
          <button className={`${s.boton} ${s.botonFinal}`} onClick={finalizar} disabled={finalizando} data-testid="arbitro-finalizar">
            {finalizando ? 'Guardando…' : '🏁 Finalizar partido'}
          </button>
        ) : (
          <button className={`${s.boton} ${setListo ? s.botonPrincipal : ''}`} onClick={cerrarSet} disabled={lider === null} data-testid="arbitro-cerrar-set">
            Cerrar set {actual ? `${actual[0]}-${actual[1]}` : ''}
          </button>
        )}
      </div>
      <Guia id="arbitro-marcador" />
    </div>
  );
}
