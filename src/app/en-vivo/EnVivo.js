"use client";
// Vista pública de solo lectura con actualización en tiempo real (Server-Sent Events)
import { useEffect, useRef, useState } from 'react';
import s from './en-vivo.module.css';
import { FASES, resumenTorneo, tablaGrupo, ordenarPartidosGrupo } from '../../lib/torneo-calculos';
import { ETIQUETAS_FASE, FORMATOS, ganaPareja1, marcadorDePartido } from '../../lib/formatos';
import { resumenRelampago } from '../../lib/relampago';

const PESTANAS = {
  ranked16: [
    ['resumen', 'Resumen'],
    ['grupos', 'Grupos'],
    ['series', 'Fase 2'],
    ['llaves', 'Llaves'],
  ],
  relampago4: [
    ['resumen', 'Resumen'],
    ['tabla', 'Tabla'],
    ['partidos', 'Partidos'],
    ['final', 'Final'],
  ],
};
const DURACION_DESTELLO_MS = 4000;
// El servidor manda un latido cada 10 s; sin noticias en este tiempo la conexión se da por muerta
const SILENCIO_MAXIMO_MS = 25000;

// Firma de lo que el público ve de un partido: si cambia, el partido "destella"
const firma = p => `${p.pareja1_id}|${p.pareja2_id}|${p.puntos_pareja1}|${p.puntos_pareja2}|${p.jugado}|${JSON.stringify(p.detalle_sets)}`;

export default function EnVivo({ slug }) {
  const [datos, setDatos] = useState(null);
  const [conexion, setConexion] = useState('conectando');
  const [pestana, setPestana] = useState('resumen');
  const [recientes, setRecientes] = useState(() => new Set());
  const firmas = useRef(new Map());
  const temporizadorDestello = useRef(null);

  useEffect(() => {
    let fuente;
    let reintento;
    let ultimoMensaje = Date.now();

    // Vigilante: una conexión puede quedar "zombi" (servidor reiniciado, móvil que cambia de red)
    // sin que EventSource lo note. Si no llega nada en SILENCIO_MAXIMO_MS, se reconecta a mano.
    const reconectarSiSilencio = () => {
      if (Date.now() - ultimoMensaje > SILENCIO_MAXIMO_MS) {
        setConexion('reconectando');
        clearTimeout(reintento);
        fuente?.close();
        conectar();
      }
    };
    const vigilante = setInterval(reconectarSiSilencio, 5000);
    const alVolverVisible = () => { if (document.visibilityState === 'visible') reconectarSiSilencio(); };
    document.addEventListener('visibilitychange', alVolverVisible);

    const conectar = () => {
      ultimoMensaje = Date.now();
      fuente = new EventSource(`/api/torneo/stream?torneo=${encodeURIComponent(slug)}`);
      fuente.onopen = () => setConexion('en-vivo');
      fuente.addEventListener('latido', () => { ultimoMensaje = Date.now(); });
      fuente.addEventListener('torneo', (evento) => {
        ultimoMensaje = Date.now();
        const nuevo = JSON.parse(evento.data);
        const cambiados = [];
        for (const p of nuevo.partidos) {
          const anterior = firmas.current.get(p.id);
          if (anterior !== undefined && anterior !== firma(p)) cambiados.push(p.id);
          firmas.current.set(p.id, firma(p));
        }
        setDatos(nuevo);
        setConexion('en-vivo');
        if (cambiados.length) {
          setRecientes(new Set(cambiados));
          clearTimeout(temporizadorDestello.current);
          temporizadorDestello.current = setTimeout(() => setRecientes(new Set()), DURACION_DESTELLO_MS);
        }
      });
      fuente.onerror = () => {
        setConexion('reconectando');
        // EventSource reintenta solo; si el servidor respondió con error queda cerrado y reconectamos a mano
        if (fuente.readyState === EventSource.CLOSED) {
          clearTimeout(reintento);
          reintento = setTimeout(conectar, 5000);
        }
      };
    };

    conectar();
    return () => {
      fuente?.close();
      clearInterval(vigilante);
      document.removeEventListener('visibilitychange', alVolverVisible);
      clearTimeout(reintento);
      clearTimeout(temporizadorDestello.current);
    };
  }, [slug]);

  if (!datos) {
    return (
      <div className={s.cargando}>
        <img src="/brand/ranked-mark.png" alt="Ranked" width={72} height={79} />
        <span>{conexion === 'reconectando' ? 'Reconectando…' : 'Conectando con el torneo…'}</span>
      </div>
    );
  }

  const esRelampago = datos.torneo?.formato === 'relampago4';
  const pestanas = PESTANAS[esRelampago ? 'relampago4' : 'ranked16'];
  const organizador = datos.torneo?.organizador;

  return (
    <div className={s.pagina}>
      <header className={s.cabecera}>
        <img src="/brand/ranked-wordmark.png" alt="Ranked" className={s.logo} />
        <div className={s.cabeceraTexto}>
          <h1 className={s.titulo}>{datos.torneo?.nombre || 'Torneo de Frontón'}</h1>
          {datos.torneo?.subtitulo && <p className={s.subtitulo}>{datos.torneo.subtitulo}</p>}
          {organizador && (
            <p className={s.organiza}>
              Organiza{/front\s*on/i.test(organizador) ? <span className={s.frontOn}>FRONT ON</span> : <strong> {organizador}</strong>}
            </p>
          )}
        </div>
        <IndicadorConexion estado={conexion} />
      </header>

      <nav className={s.nav} aria-label="Secciones">
        {pestanas.map(([id, etiqueta]) => (
          <button key={id} className={pestana === id ? s.navActiva : s.navBoton} aria-current={pestana === id ? 'page' : undefined} onClick={() => setPestana(id)}>
            {etiqueta}
          </button>
        ))}
      </nav>

      <main className={s.contenido}>
        {esRelampago
          ? <CuerpoRelampago datos={datos} pestana={pestana} recientes={recientes} />
          : <CuerpoRanked16 datos={datos} pestana={pestana} recientes={recientes} />}
      </main>

      <footer className={s.pie}>
        Powered by <a href="https://geeky-tech.es" target="_blank" rel="noopener">Geeky Tech</a>
      </footer>
    </div>
  );
}

function CuerpoRanked16({ datos, pestana, recientes }) {
  const resumen = resumenTorneo(datos);
  return (
      <>
        {pestana === 'resumen' && <Resumen datos={datos} resumen={resumen} recientes={recientes} />}
        {pestana === 'grupos' && (
          <div className={s.gridGrupos}>
            {resumen.grupos.map(g => <TarjetaGrupo key={g} datos={datos} nombre={g} clasifican={2} recientes={recientes} />)}
          </div>
        )}
        {pestana === 'series' && <Series datos={datos} resumen={resumen} recientes={recientes} />}
        {pestana === 'llaves' && <Llaves resumen={resumen} recientes={recientes} />}
      </>
  );
}

// ── Formato Relámpago: 4 parejas todos contra todos + final ──
function CuerpoRelampago({ datos, pestana, recientes }) {
  const r = resumenRelampago(datos);
  const F = FORMATOS.relampago4;
  const porcentaje = r.progreso.total ? Math.round((r.progreso.jugados / r.progreso.total) * 100) : 0;
  const proximaRonda = r.proximos[0]?.ronda;

  if (pestana === 'tabla') {
    return (
      <section className={s.tarjeta}>
        <h2 className={s.tarjetaTitulo}>Tabla de posiciones</h2>
        <TablaRelampago r={r} />
      </section>
    );
  }

  if (pestana === 'partidos') {
    return (
      <div className={s.gridGrupos}>
        {[1, 2, 3].map(ronda => (
          <section key={ronda} className={s.tarjeta}>
            <h2 className={s.tarjetaTitulo}>Ronda {ronda}</h2>
            <ul className={s.listaPartidos}>
              {r.liga.filter(p => p.ronda === ronda).map(p => <Partido key={p.id} p={p} contexto reciente={recientes.has(p.id)} />)}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  if (pestana === 'final') {
    return (
      <>
        {r.campeon && <Campeon campeon={r.campeon} final={r.final} foto={datos.foto} />}
        <section className={s.tarjeta}>
          <h2 className={s.tarjetaTitulo}>Gran Final</h2>
          <p className={s.nota}>1° vs 2° de la tabla · Mejor de {F.fases.final.mejorDe} sets a {F.fases.final.puntosSet}</p>
          {r.final
            ? <ul className={s.listaPartidos}><Partido p={r.final} reciente={recientes.has(r.final.id)} /></ul>
            : (
              <div className={s.cruceProvisional}>
                <div className={s.fila}><span className={s.semilla}>1°</span><span className={s.nombre}>{r.finalistas[0]?.nombre_pareja || 'Por definir'}</span></div>
                <div className={s.fila}><span className={s.semilla}>2°</span><span className={s.nombre}>{r.finalistas[1]?.nombre_pareja || 'Por definir'}</span></div>
                {r.finalistas.length > 0 && !r.ligaTerminada && <span className={s.provisional}>Provisional</span>}
              </div>
            )}
        </section>
      </>
    );
  }

  return (
    <>
      {r.campeon && <Campeon campeon={r.campeon} final={r.final} foto={datos.foto} />}
      {!r.campeon && (
        <section className={s.tarjetaFase}>
          <div>
            <p className={s.etiqueta}>Fase actual</p>
            <h2 className={s.faseNombre}>{r.faseActual === 'final' ? 'Gran Final' : proximaRonda ? `${ETIQUETAS_FASE.liga} · Ronda ${proximaRonda}` : ETIQUETAS_FASE.liga}</h2>
          </div>
          <div className={s.progreso}>
            <div className={s.progresoTexto}><strong>{r.progreso.jugados}</strong> de {r.progreso.total} partidos jugados</div>
            <div className={s.barra} role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
              <div className={s.barraRelleno} style={{ width: `${porcentaje}%` }} />
            </div>
          </div>
        </section>
      )}
      <div className={s.gridResumen}>
        <section className={s.tarjeta}>
          <h2 className={s.tarjetaTitulo}>{proximaRonda && r.faseActual === 'liga' ? `En juego · Ronda ${proximaRonda}` : 'Próximo partido'}</h2>
          {r.proximos.length === 0
            ? <p className={s.vacio}>{r.campeon ? 'El torneo ha terminado.' : r.ligaTerminada ? 'La final se arma en breve.' : 'No hay partidos pendientes.'}</p>
            : <ul className={s.listaPartidos}>{r.proximos.map(p => <Partido key={p.id} p={p} contexto reciente={recientes.has(p.id)} />)}</ul>}
        </section>
        <section className={s.tarjeta}>
          <h2 className={s.tarjetaTitulo}>Posiciones</h2>
          <TablaRelampago r={r} compacta />
        </section>
      </div>
      <section className={s.tarjeta}>
        <h2 className={s.tarjetaTitulo}>Últimos resultados</h2>
        {r.ultimos.length === 0
          ? <p className={s.vacio}>Aún no se ha jugado ningún partido.</p>
          : <ul className={s.listaPartidos}>{r.ultimos.map(p => <Partido key={p.id} p={conRonda(p, r)} contexto reciente={recientes.has(p.id)} />)}</ul>}
      </section>
    </>
  );
}

// Los "últimos" vienen sin ronda/cancha: se recuperan de la lista de la liga
const conRonda = (p, r) => r.liga.find(l => l.id === p.id) || p;

function TablaRelampago({ r, compacta = false }) {
  const F = FORMATOS.relampago4;
  return (
    <>
      <div className={s.tablaScroll}>
        <table className={s.tabla}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col" className={s.izq}>Pareja</th>
              <th scope="col" title="Partidos jugados">PJ</th>
              <th scope="col" title={`Puntos (${F.puntosVictoria} por victoria)`}>Pts</th>
              <th scope="col" title="Diferencia de sets">DS</th>
              <th scope="col" title="Diferencia de puntos">DP</th>
              {!compacta && <th scope="col" title="Sets ganados-perdidos" className={s.opcional}>Sets</th>}
              {!compacta && <th scope="col" title="Puntos a favor-en contra" className={s.opcional}>PF-PC</th>}
            </tr>
          </thead>
          <tbody>
            {r.tabla.map((f, i) => {
              const clasifica = r.hayJugados && i < F.clasificanFinal;
              return (
                <tr key={f.pareja_id} className={clasifica ? s.clasifica : undefined}>
                  <td><span className={clasifica ? s.posClasifica : s.pos}>{i + 1}</span></td>
                  <td className={s.izq}>{f.nombre_pareja}{f.empateSinResolver && <span className={s.estrella} title="Empate sin resolver">⚠</span>}</td>
                  <td>{f.pj}</td>
                  <td className={s.fuerte}>{f.puntos}</td>
                  <td>{f.dif_sets > 0 ? `+${f.dif_sets}` : f.dif_sets}</td>
                  <td className={f.diferencia_puntos > 0 ? s.positivo : f.diferencia_puntos < 0 ? s.negativo : undefined}>
                    {f.diferencia_puntos > 0 ? `+${f.diferencia_puntos}` : f.diferencia_puntos}
                  </td>
                  {!compacta && <td className={s.opcional}>{f.sets_favor}-{f.sets_contra}</td>}
                  {!compacta && <td className={s.opcional}>{f.puntos_favor}-{f.puntos_contra}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={s.leyenda}>Pasan los {F.clasificanFinal} primeros a la final. Desempate: diferencia de sets, luego diferencia de puntos.</p>
    </>
  );
}

function IndicadorConexion({ estado }) {
  const enVivo = estado === 'en-vivo';
  return (
    <span className={enVivo ? s.enVivo : s.desconectado} role="status">
      <span className={s.punto} aria-hidden="true" />
      {enVivo ? 'En vivo' : 'Reconectando…'}
    </span>
  );
}

function Resumen({ datos, resumen, recientes }) {
  const { campeon, faseActual, progreso, proximos, ultimos, final } = resumen;
  const porcentaje = progreso.total ? Math.round((progreso.jugados / progreso.total) * 100) : 0;

  return (
    <>
      {campeon && <Campeon campeon={campeon} final={final} foto={datos.foto} />}

      {!campeon && (
        <section className={s.tarjetaFase}>
          <div>
            <p className={s.etiqueta}>Fase actual</p>
            <h2 className={s.faseNombre}>{FASES[faseActual]}</h2>
          </div>
          <div className={s.progreso}>
            <div className={s.progresoTexto}>
              <strong>{progreso.jugados}</strong> de {progreso.total} partidos jugados
            </div>
            <div className={s.barra} role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
              <div className={s.barraRelleno} style={{ width: `${porcentaje}%` }} />
            </div>
          </div>
        </section>
      )}

      <div className={s.gridResumen}>
        <section className={s.tarjeta}>
          <h2 className={s.tarjetaTitulo}>Próximos partidos</h2>
          {proximos.length === 0
            ? <p className={s.vacio}>{campeon ? 'El torneo ha terminado.' : 'No hay partidos pendientes definidos todavía.'}</p>
            : <ul className={s.listaPartidos}>{proximos.map(p => <Partido key={p.id} p={p} contexto reciente={recientes.has(p.id)} />)}</ul>}
        </section>
        <section className={s.tarjeta}>
          <h2 className={s.tarjetaTitulo}>Últimos resultados</h2>
          {ultimos.length === 0
            ? <p className={s.vacio}>Aún no se ha jugado ningún partido.</p>
            : <ul className={s.listaPartidos}>{ultimos.map(p => <Partido key={p.id} p={p} contexto reciente={recientes.has(p.id)} />)}</ul>}
        </section>
      </div>
    </>
  );
}

const tieneSets = p => Array.isArray(p.detalle_sets);

function Campeon({ campeon, final, foto }) {
  // Con sets se muestra el marcador en sets (2–1) y el detalle; con set único, los puntos
  const [m1, m2] = tieneSets(final) ? [final.sets_pareja1, final.sets_pareja2] : [final.puntos_pareja1, final.puntos_pareja2];
  const rival = campeon.id === final.pareja1_id ? final.nombre_pareja2 : final.nombre_pareja1;
  return (
    <section className={s.campeon}>
      {foto && <img src={foto} alt={`Campeones: ${campeon.nombre}`} className={s.campeonFoto} />}
      <div className={s.campeonTexto}>
        <span className={s.campeonBadge}>🏆 Campeón</span>
        <h2 className={s.campeonNombre}>{campeon.nombre}</h2>
        <p className={s.campeonMarcador}>
          <strong>{Math.max(m1, m2)}</strong> – {Math.min(m1, m2)} <span>vs {rival}</span>
          {tieneSets(final) && <span> · {final.detalle_sets.map(([a, b]) => (campeon.id === final.pareja1_id ? `${a}-${b}` : `${b}-${a}`)).join(', ')}</span>}
        </p>
      </div>
    </section>
  );
}

function tituloPartido(p) {
  if (p.fase === 'liga') return p.ronda ? `Ronda ${p.ronda} · Cancha ${p.cancha}` : ETIQUETAS_FASE.liga;
  return p.fase === 'grupos' || p.fase === 'cuartos' ? p.nombre_grupo : FASES[p.fase];
}

function Partido({ p, contexto = false, reciente = false }) {
  const definido = p.pareja1_id && p.pareja2_id;
  const gana1 = p.jugado && ganaPareja1(p);
  const gana2 = p.jugado && !gana1;
  const conSets = tieneSets(p);

  // En partidos a sets: puntos de cada set (resaltando los ganados) y, en grande, los sets ganados
  const enJuego = !p.jugado && p.en_juego === 1;
  const vivo = enJuego ? marcadorDePartido(p) : null;

  const marcador = (lado) => {
    if (enJuego) {
      // En juego: sets ya cerrados en pequeño y el set en curso en grande
      return (
        <span className={s.marcador}>
          <span className={s.setsDetalle}>
            {vivo.cerrados.map((set, i) => <span key={i} className={set[lado] > set[1 - lado] ? s.setGanado : undefined}>{set[lado]}</span>)}
          </span>
          <span className={`${s.puntos} ${s.puntosVivo}`}>{vivo.actual ? vivo.actual[lado] : (lado === 0 ? p.sets_pareja1 : p.sets_pareja2)}</span>
        </span>
      );
    }
    if (!p.jugado) return <span className={s.puntos}>–</span>;
    if (!conSets) return <span className={s.puntos}>{lado === 0 ? p.puntos_pareja1 : p.puntos_pareja2}</span>;
    return (
      <span className={s.marcador}>
        <span className={s.setsDetalle}>
          {p.detalle_sets.map((set, i) => (
            <span key={i} className={set[lado] > set[1 - lado] ? s.setGanado : undefined}>{set[lado]}</span>
          ))}
        </span>
        <span className={s.puntos}>{lado === 0 ? p.sets_pareja1 : p.sets_pareja2}</span>
      </span>
    );
  };

  return (
    <li className={`${s.partido} ${reciente ? s.reciente : ''}`}>
      {(contexto || enJuego) && (
        <span className={s.partidoContexto}>
          {contexto && tituloPartido(p)}
          {enJuego && <span className={s.enJuegoBadge}>● En juego{vivo.actual ? ` · Set ${vivo.cerrados.length + 1}` : ''}</span>}
        </span>
      )}
      {definido ? (
        <div className={s.partidoFilas}>
          <div className={gana1 ? s.filaGanadora : s.fila}>
            <span className={s.nombre}>{p.nombre_pareja1}</span>
            {marcador(0)}
          </div>
          <div className={gana2 ? s.filaGanadora : s.fila}>
            <span className={s.nombre}>{p.nombre_pareja2}</span>
            {marcador(1)}
          </div>
        </div>
      ) : (
        <p className={s.porDefinir}>Por definir</p>
      )}
    </li>
  );
}

function Tabla({ filas, clasifican, hayJugados }) {
  return (
    <div className={s.tablaScroll}>
      <table className={s.tabla}>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col" className={s.izq}>Pareja</th>
            <th scope="col" title="Partidos jugados">PJ</th>
            <th scope="col" title="Partidos ganados">PG</th>
            <th scope="col" title="Puntos a favor" className={s.opcional}>PF</th>
            <th scope="col" title="Puntos en contra" className={s.opcional}>PC</th>
            <th scope="col" title="Diferencia de puntos">Dif</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => {
            const clasifica = hayJugados && i < clasifican;
            return (
              <tr key={f.pareja_id} className={clasifica ? s.clasifica : undefined}>
                <td><span className={clasifica ? s.posClasifica : s.pos}>{i + 1}</span></td>
                <td className={s.izq}>
                  {f.nombre_pareja}
                  {f.cabeza_serie === 1 && <span className={s.estrella} title="Cabeza de serie">★</span>}
                </td>
                <td>{f.pj}</td>
                <td className={s.fuerte}>{f.pg}</td>
                <td className={s.opcional}>{f.puntos_favor}</td>
                <td className={s.opcional}>{f.puntos_contra}</td>
                <td className={f.diferencia_puntos > 0 ? s.positivo : f.diferencia_puntos < 0 ? s.negativo : undefined}>
                  {f.diferencia_puntos > 0 ? `+${f.diferencia_puntos}` : f.diferencia_puntos}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TarjetaGrupo({ datos, nombre, clasifican, recientes }) {
  const partidos = ordenarPartidosGrupo(datos.partidos.filter(p => p.nombre_grupo === nombre));
  const jugados = partidos.filter(p => p.jugado === 1).length;
  return (
    <section className={s.tarjeta}>
      <div className={s.tarjetaCabecera}>
        <h2 className={s.tarjetaTitulo}>{nombre}</h2>
        <span className={s.contador}>{jugados}/{partidos.length}</span>
      </div>
      <Tabla filas={tablaGrupo(datos, nombre)} clasifican={clasifican} hayJugados={jugados > 0} />
      <details className={s.detalles} open={partidos.some(p => recientes.has(p.id)) || undefined}>
        <summary>Partidos</summary>
        <ul className={s.listaPartidos}>
          {partidos.map(p => <Partido key={p.id} p={p} reciente={recientes.has(p.id)} />)}
        </ul>
      </details>
    </section>
  );
}

function Series({ datos, resumen, recientes }) {
  if (resumen.sorteoValido) {
    return (
      <div className={s.gridGrupos}>
        {resumen.series.map(g => <TarjetaGrupo key={g} datos={datos} nombre={g} clasifican={2} recientes={recientes} />)}
      </div>
    );
  }
  return (
    <section className={s.tarjeta}>
      <h2 className={s.tarjetaTitulo}>Clasificados a la Fase 2</h2>
      <p className={s.nota}>
        {resumen.fase1Terminada
          ? 'Fase 1 terminada. Pronto se sortearán las 8 parejas en 2 series de 4.'
          : 'Provisional: clasifican los 2 primeros de cada grupo. Al terminar la Fase 1 se sortean en 2 series de 4.'}
      </p>
      {resumen.clasificadosFase1.length === 0 && <p className={s.vacio}>Los clasificados aparecerán cuando empiecen los partidos de la Fase 1.</p>}
      <ul className={s.clasificados}>
        {resumen.clasificadosFase1.map(c => (
          <li key={c.pareja_id}>
            <span className={s.clasificadoGrupo}>{c.puesto}° {c.nombre_grupo.replace('GRUPO ', 'Grupo ')}</span>
            <span>{c.nombre_pareja}{c.cabeza_serie === 1 && <span className={s.estrella}>★</span>}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Llaves({ resumen, recientes }) {
  const { crucesSemis, final, campeon } = resumen;
  const finalistas = crucesSemis.map(c => c.partido?.jugado ? (c.partido.puntos_pareja1 > c.partido.puntos_pareja2 ? c.partido.nombre_pareja1 : c.partido.nombre_pareja2) : null);

  return (
    <div className={s.llaves}>
      <div className={s.llavesColumna}>
        <h2 className={s.llavesTitulo}>Semifinales</h2>
        {crucesSemis.map((cruce, i) => (
          cruce.partido
            ? <ul key={i} className={s.listaPartidos}><Partido p={{ ...cruce.partido, fase: 'semifinal' }} reciente={recientes.has(cruce.partido.id)} /></ul>
            : (
              <div key={i} className={s.cruceProvisional}>
                <div className={s.fila}><span className={s.semilla}>{cruce.etiqueta1}</span><span className={s.nombre}>{cruce.pareja1?.nombre_pareja || 'Por definir'}</span></div>
                <div className={s.fila}><span className={s.semilla}>{cruce.etiqueta2}</span><span className={s.nombre}>{cruce.pareja2?.nombre_pareja || 'Por definir'}</span></div>
                {cruce.pareja1 && !cruce.definitivo && <span className={s.provisional}>Provisional</span>}
              </div>
            )
        ))}
      </div>
      <div className={s.llavesConector} aria-hidden="true" />
      <div className={s.llavesColumna}>
        <h2 className={s.llavesTitulo}>Final</h2>
        {final
          ? <ul className={s.listaPartidos}><Partido p={final} reciente={recientes.has(final.id)} /></ul>
          : (
            <div className={s.cruceProvisional}>
              <div className={s.fila}><span className={s.semilla}>Ganador SF1</span><span className={s.nombre}>{finalistas[0] || 'Por definir'}</span></div>
              <div className={s.fila}><span className={s.semilla}>Ganador SF2</span><span className={s.nombre}>{finalistas[1] || 'Por definir'}</span></div>
            </div>
          )}
        {campeon && <p className={s.llavesCampeon}>🏆 {campeon.nombre}</p>}
      </div>
    </div>
  );
}
