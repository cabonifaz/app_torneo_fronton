"use client";
// Vista pública de solo lectura con actualización en tiempo real (Server-Sent Events)
import { useEffect, useRef, useState } from 'react';
import s from './en-vivo.module.css';
import { FASES, resumenTorneo, tablaGrupo, ordenarPartidosGrupo } from '../../lib/torneo-calculos';

const PESTANAS = [
  ['resumen', 'Resumen'],
  ['grupos', 'Grupos'],
  ['series', 'Fase 2'],
  ['llaves', 'Llaves'],
];
const DURACION_DESTELLO_MS = 4000;

// Firma de lo que el público ve de un partido: si cambia, el partido "destella"
const firma = p => `${p.pareja1_id}|${p.pareja2_id}|${p.puntos_pareja1}|${p.puntos_pareja2}|${p.jugado}`;

export default function EnVivo() {
  const [datos, setDatos] = useState(null);
  const [conexion, setConexion] = useState('conectando');
  const [pestana, setPestana] = useState('resumen');
  const [recientes, setRecientes] = useState(() => new Set());
  const firmas = useRef(new Map());
  const temporizadorDestello = useRef(null);

  useEffect(() => {
    let fuente;
    let reintento;

    const conectar = () => {
      fuente = new EventSource('/api/torneo/stream');
      fuente.onopen = () => setConexion('en-vivo');
      fuente.addEventListener('torneo', (evento) => {
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
      clearTimeout(reintento);
      clearTimeout(temporizadorDestello.current);
    };
  }, []);

  if (!datos) {
    return (
      <div className={s.cargando}>
        <img src="/brand/ranked-mark.png" alt="Ranked" width={72} height={79} />
        <span>{conexion === 'reconectando' ? 'Reconectando…' : 'Conectando con el torneo…'}</span>
      </div>
    );
  }

  const resumen = resumenTorneo(datos);

  return (
    <div className={s.pagina}>
      <header className={s.cabecera}>
        <img src="/brand/ranked-wordmark.png" alt="Ranked" className={s.logo} />
        <div className={s.cabeceraTexto}>
          <h1 className={s.titulo}>{datos.torneo?.nombre || 'Torneo de Frontón'}</h1>
          {datos.torneo?.subtitulo && <p className={s.subtitulo}>{datos.torneo.subtitulo}</p>}
        </div>
        <IndicadorConexion estado={conexion} />
      </header>

      <nav className={s.nav} aria-label="Secciones">
        {PESTANAS.map(([id, etiqueta]) => (
          <button key={id} className={pestana === id ? s.navActiva : s.navBoton} aria-current={pestana === id ? 'page' : undefined} onClick={() => setPestana(id)}>
            {etiqueta}
          </button>
        ))}
      </nav>

      <main className={s.contenido}>
        {pestana === 'resumen' && <Resumen datos={datos} resumen={resumen} recientes={recientes} />}
        {pestana === 'grupos' && (
          <div className={s.gridGrupos}>
            {resumen.grupos.map(g => <TarjetaGrupo key={g} datos={datos} nombre={g} clasifican={2} recientes={recientes} />)}
          </div>
        )}
        {pestana === 'series' && <Series datos={datos} resumen={resumen} recientes={recientes} />}
        {pestana === 'llaves' && <Llaves resumen={resumen} recientes={recientes} />}
      </main>

      <footer className={s.pie}>
        Powered by <a href="https://geeky-tech.es" target="_blank" rel="noopener">Geeky Tech</a>
      </footer>
    </div>
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

function Campeon({ campeon, final, foto }) {
  const puntosGanador = Math.max(final.puntos_pareja1, final.puntos_pareja2);
  const puntosRival = Math.min(final.puntos_pareja1, final.puntos_pareja2);
  const rival = campeon.id === final.pareja1_id ? final.nombre_pareja2 : final.nombre_pareja1;
  return (
    <section className={s.campeon}>
      {foto && <img src={foto} alt={`Campeones: ${campeon.nombre}`} className={s.campeonFoto} />}
      <div className={s.campeonTexto}>
        <span className={s.campeonBadge}>🏆 Campeón</span>
        <h2 className={s.campeonNombre}>{campeon.nombre}</h2>
        <p className={s.campeonMarcador}><strong>{puntosGanador}</strong> – {puntosRival} <span>vs {rival}</span></p>
      </div>
    </section>
  );
}

function Partido({ p, contexto = false, reciente = false }) {
  const definido = p.pareja1_id && p.pareja2_id;
  const gana1 = p.jugado && p.puntos_pareja1 > p.puntos_pareja2;
  const gana2 = p.jugado && p.puntos_pareja2 > p.puntos_pareja1;
  const titulo = p.fase === 'grupos' || p.fase === 'cuartos' ? p.nombre_grupo : FASES[p.fase];

  return (
    <li className={`${s.partido} ${reciente ? s.reciente : ''}`}>
      {contexto && <span className={s.partidoContexto}>{titulo}</span>}
      {definido ? (
        <div className={s.partidoFilas}>
          <div className={gana1 ? s.filaGanadora : s.fila}>
            <span className={s.nombre}>{p.nombre_pareja1}</span>
            <span className={s.puntos}>{p.jugado ? p.puntos_pareja1 : '–'}</span>
          </div>
          <div className={gana2 ? s.filaGanadora : s.fila}>
            <span className={s.nombre}>{p.nombre_pareja2}</span>
            <span className={s.puntos}>{p.jugado ? p.puntos_pareja2 : '–'}</span>
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
  const sorteado = datos.partidos.some(p => p.fase === 'cuartos' && p.pareja1_id);
  if (sorteado) {
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
