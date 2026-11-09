"use client";
// Panel del formato Relámpago: 4 parejas todos contra todos (2 canchas, 3 rondas) + final entre las 2 mejores
import { useRef, useState } from 'react';
import { C, styles, titulo, boton } from './admin-estilos';
import CabeceraAdmin from './CabeceraAdmin';
import { useTorneoEnVivo } from '../lib/useTorneoEnVivo';
import Guia from './Guia';
import EditorReglas from './EditorReglas';
import { FORMATOS, reglasFase, validarSets, ganaPareja1, textoSets, textoReglas, textoCierreCorto } from '../lib/formatos';
import { resumenRelampago } from '../lib/relampago';

const F = FORMATOS.relampago4;
const json = { 'Content-Type': 'application/json' };

export default function AdminRelampago({ torneo, torneos }) {
  // Tiempo real por SSE: los cambios del árbitro y de otros dispositivos llegan sin recargar
  const { datos: data, conexion } = useTorneoEnVivo(torneo.slug);
  const [tab, setTab] = useState('partidos');
  const [ronda, setRonda] = useState(null);
  const [fotoSubida, setFotoUrl] = useState(undefined); // undefined = usar la de la transmisión
  const fotoUrl = fotoSubida === undefined ? data?.foto ?? null : fotoSubida;
  // El torneo de la transmisión trae las reglas vigentes (pueden cambiar desde otro dispositivo)
  const t = data?.torneo || torneo;

  // Devuelve true si la operación se guardó; el nuevo estado llega por la transmisión
  const enviar = async (method, payload) => {
    const res = await fetch('/api/partidos', { method, headers: json, body: JSON.stringify({ ...payload, torneo_id: torneo.id }) });
    const respuesta = await res.json().catch(() => ({}));
    if (res.status === 401) { window.location.href = `/t/${torneo.slug}/login?rol=admin`; return false; }
    if (!res.ok) alert(respuesta.error || 'No se pudo guardar.');
    return res.ok;
  };
  const cargarDatos = () => {}; // compatibilidad con el editor de parejas: la transmisión ya refresca

  if (!data) return (
    <div style={styles.loading}>
      <img src="/brand/ranked-mark.png" alt="Ranked" style={{ width: '72px', height: 'auto' }} />
      <span>{conexion === 'reconectando' ? 'Reconectando…' : 'Cargando torneo…'}</span>
    </div>
  );

  const r = resumenRelampago(data);
  // Ronda elegida o, por defecto, la que se está jugando (la última si la liga terminó)
  const rondaVisible = ronda ?? r.proximos.find(p => p.fase === 'liga')?.ronda ?? 3;
  const partidoFinal = data.partidos.find(p => p.fase === 'final');

  // Cambiar un resultado de la liga con la final ya armada puede cambiar quién la juega
  const confirmarSiFinalArmada = partido => partido.fase !== 'liga' || !partidoFinal || confirm(
    'La final ya está armada con la tabla actual. Si este cambio altera quiénes son las 2 mejores, ' +
    'tendrás que resetear la final y volver a armarla. ¿Continuar?'
  );

  const guardarSets = async (partido, sets) => {
    const v = validarSets(sets, reglasFase(t, partido.fase));
    if (v.error) { alert(v.error); return false; }
    if (v.avisos.length && !confirm(`${v.avisos.join('\n')}\n\n¿Guardar igual?`)) return false;
    if (!confirmarSiFinalArmada(partido)) return false;
    return enviar('PUT', { id: partido.id, sets: v.sets });
  };

  const resetearPartido = partido => confirmarSiFinalArmada(partido) && confirm('¿Borrar el resultado de este partido?') && enviar('PUT', { id: partido.id, reset: true });
  const armarFinal = (p1, p2) => enviar('POST', { fase: 'final', pareja1_id: p1, pareja2_id: p2 });
  const resetearFinal = () => confirm('¿Resetear la final? Se borra el partido y su resultado.') && enviar('DELETE', { fase: 'final' });

  return (
    <div style={styles.container}>
      <CabeceraAdmin torneo={t} torneos={torneos} />

      <nav className="tabs-scroll" style={styles.tabsContainer}>
        {[['partidos', 'Partidos'], ['tabla', 'Tabla'], ['final', 'Final'], ['parejas', 'Parejas'], ['reglas', 'Reglas']].map(([id, etiqueta]) => (
          <button key={id} onClick={() => setTab(id)} style={tab === id ? styles.tabActive : styles.tab} data-testid={`tab-${id}`}>{etiqueta}</button>
        ))}
      </nav>

      {tab === 'partidos' && (
        <>
          {/* Una ronda a la vez (sus 2 partidos se juegan a la vez): entra en la pantalla sin scroll */}
          <SelectorRonda r={r} ronda={rondaVisible} onElegir={setRonda} />
          <div style={styles.matchesGrid}>
            {r.liga.filter(p => p.ronda === rondaVisible).map(p => (
              <TarjetaPartido key={p.id} partido={p} torneo={t} titulo={`Cancha ${p.cancha}`} onGuardar={guardarSets} onReset={resetearPartido} />
            ))}
          </div>
          <p style={{ ...styles.faseInfo, textAlign: 'center', margin: '10px 0 0' }}>
            {r.progreso.jugados} de {r.progreso.total} jugados · {textoReglas(reglasFase(t, 'liga'))}
          </p>
        </>
      )}

      {tab === 'tabla' && (
        <section style={styles.groupCard}>
          <h2 style={styles.groupTitle}>Tabla de posiciones</h2>
          <TablaLiga r={r} />
        </section>
      )}

      {tab === 'final' && (
        <SeccionFinal r={r} partidoFinal={partidoFinal} parejas={r.tabla} onArmar={armarFinal} onResetear={resetearFinal}
          onGuardar={guardarSets} onReset={resetearPartido} torneo={t} fotoUrl={fotoUrl} setFotoUrl={setFotoUrl} />
      )}

      {tab === 'parejas' && <EditorParejas torneoId={torneo.id} parejas={r.tabla} onCambio={cargarDatos} />}

      {tab === 'reglas' && <><Reglas torneo={t} /><EditorReglas torneo={t} /></>}

      <Guia id="admin-relampago" />
      <footer style={styles.footer}>
        <span>Powered by <a href="https://geeky-tech.es" target="_blank" rel="noopener" style={styles.footerLink}>Geeky Tech</a></span>
      </footer>
    </div>
  );
}

function SelectorRonda({ r, ronda, onElegir }) {
  return (
    <div style={{ ...styles.subTabsContainer, marginBottom: '10px' }} role="tablist" aria-label="Rondas">
      {[1, 2, 3].map(n => {
        const partidos = r.liga.filter(p => p.ronda === n);
        const jugados = partidos.filter(p => p.jugado === 1).length;
        const enJuego = partidos.some(p => p.en_juego === 1 && !p.jugado);
        const activa = n === ronda;
        const estado = jugados === partidos.length ? '✓' : enJuego ? '●' : `${jugados}/${partidos.length}`;
        return (
          <button key={n} role="tab" aria-selected={activa} onClick={() => onElegir(n)} data-testid={`ronda-${n}`}
            style={activa ? { ...styles.subTabBase, ...styles.subTabActive, color: C.lima, borderColor: C.lima } : styles.subTabBase}>
            Ronda {n} <span style={{ marginLeft: 4, fontSize: '0.75rem', color: enJuego ? C.rojo : jugados === partidos.length ? C.lima : C.tenue }}>{estado}</span>
          </button>
        );
      })}
    </div>
  );
}

// Tarjeta de partido al mejor de 3: el estado local se reinicia cuando cambia el resultado guardado
// (p. ej. lo corrige otro dispositivo), sin pisar lo que se está escribiendo mientras tanto
function TarjetaPartido({ partido, torneo, titulo: tituloPartido, onGuardar, onReset }) {
  const reglas = reglasFase(torneo, partido.fase);
  const firma = `${partido.id}-${partido.jugado}-${JSON.stringify(partido.detalle_sets)}-${reglas.mejorDe}`;
  return <TarjetaPartidoInterna key={firma} partido={partido} reglas={reglas} titulo={tituloPartido} onGuardar={onGuardar} onReset={onReset} />;
}

function TarjetaPartidoInterna({ partido, reglas, titulo: tituloPartido, onGuardar, onReset }) {
  const { mejorDe } = reglas;
  const inicial = Array.from({ length: mejorDe }, (_, i) => partido.detalle_sets?.[i]?.map(String) || ['', '']);
  const [sets, setSets] = useState(inicial);
  const [guardando, setGuardando] = useState(false);

  const jugado = partido.jugado === 1;
  const gana1 = jugado && ganaPareja1(partido);
  const gana2 = jugado && !gana1;

  const cambiar = (i, lado, valor) => setSets(prev => prev.map((s, j) => (j === i ? (lado === 0 ? [valor, s[1]] : [s[0], valor]) : s)));
  const guardar = async () => {
    setGuardando(true);
    try { await onGuardar(partido, sets); } finally { setGuardando(false); }
  };

  const fila = (lado, nombre, gana) => (
    <div style={{ ...styles.teamLine, backgroundColor: gana ? C.limaFondo : 'transparent' }}>
      <span style={{ flex: 1, fontWeight: gana ? 700 : 500, color: gana ? C.lima : C.texto }}>
        {nombre}
        {jugado && <span style={{ marginLeft: 8, ...titulo, fontSize: '1.1rem', color: gana ? C.lima : C.suave }}>{lado === 0 ? partido.sets_pareja1 : partido.sets_pareja2}</span>}
      </span>
      <div style={{ display: 'flex', gap: '4px' }}>
        {sets.map((s, i) => (
          <input
            key={i}
            type="number" inputMode="numeric" min="0"
            aria-label={`Set ${i + 1} · ${nombre}`}
            data-testid={`set-${partido.id}-${i + 1}-${lado + 1}`}
            value={s[lado]}
            onChange={e => cambiar(i, lado, e.target.value)}
            style={{ ...styles.scoreInput, width: '44px', fontSize: '0.95rem', borderColor: gana ? C.lima : C.borde }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div style={jugado ? styles.matchCardPlayed : styles.matchCard} data-testid={`partido-${partido.id}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h4 style={styles.matchTitle}>
          {tituloPartido}
          {partido.en_juego === 1 && !jugado && (
            <span style={{ marginLeft: 8, color: partido.reloj_estado === 'pausado' ? C.ambar : C.rojo, fontSize: '0.75rem' }} title="El árbitro está cargando el marcador">
              {partido.reloj_estado === 'pausado' ? '⏸ PAUSADO' : partido.reloj_estado === 'en_juego' ? '● EN JUEGO' : '● ENTRE SETS'}
            </span>
          )}
        </h4>
        <span style={{ fontSize: '0.7rem', color: C.tenue, letterSpacing: '0.5px' }}>
          {Array.from({ length: mejorDe }, (_, i) => `S${i + 1}`).join(' · ')} · {textoCierreCorto(reglas)}
        </span>
      </div>
      <div style={styles.matchTeams}>
        {fila(0, partido.nombre_pareja1, gana1)}
        {fila(1, partido.nombre_pareja2, gana2)}
      </div>
      {jugado && <p style={{ margin: '-4px 0 10px', fontSize: '0.8rem', color: C.suave }}>Resultado: {textoSets(partido)}</p>}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={guardar} disabled={guardando} style={jugado ? styles.btnUpdate : styles.btnSave} data-testid={`guardar-${partido.id}`}>
          {guardando ? 'Guardando…' : jugado ? 'Corregir' : 'Guardar'}
        </button>
        {jugado && <button onClick={() => onReset(partido)} style={styles.btnReset} data-testid={`reset-${partido.id}`}>Reset</button>}
      </div>
    </div>
  );
}

function TablaLiga({ r }) {
  const hayEmpate = r.tabla.some(f => f.empateSinResolver);
  return (
    <>
      <div style={styles.tablaPosWrapper}>
        <div style={styles.tablaPosHeader}>
          <span style={styles.tablaPosTitle}>Posiciones</span>
          {r.hayJugados && <span style={styles.tablaPosLegend}><span style={styles.legendDot} />top {F.clasificanFinal} a la final</span>}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.tablaPos} data-testid="tabla-liga">
            <thead>
              <tr>
                <th style={styles.thPos}>#</th>
                <th style={styles.thPosLeft}>Pareja</th>
                <th style={styles.thPos}>PJ</th>
                <th style={styles.thPos}>PG</th>
                <th style={styles.thPos}>PP</th>
                <th style={styles.thPos} title="Puntos de tabla (2 por victoria)">Pts</th>
                <th style={styles.thPos} title="Sets ganados - perdidos">Sets</th>
                <th style={styles.thPos} title="Diferencia de sets">DS</th>
                <th style={styles.thPos} title="Puntos a favor - en contra">PF-PC</th>
                <th style={styles.thPos} title="Diferencia de puntos">DP</th>
              </tr>
            </thead>
            <tbody>
              {r.tabla.map((f, i) => {
                const clasifica = r.hayJugados && i < F.clasificanFinal;
                return (
                  <tr key={f.pareja_id} style={clasifica ? styles.rowClasifica : styles.rowNormal} data-testid="fila-tabla">
                    <td style={styles.tdPos}><span style={clasifica ? styles.badgeClasifica : styles.badgeNormal}>{i + 1}</span></td>
                    <td style={styles.tdPosNombre}>
                      <span data-testid="nombre-pareja">{f.nombre_pareja}</span>
                      {f.empateSinResolver && <span title="Empate que los criterios no resuelven" style={{ marginLeft: 6, color: C.ambar }}>⚠</span>}
                    </td>
                    <td style={styles.tdPos}>{f.pj}</td>
                    <td style={styles.tdPos}>{f.pg}</td>
                    <td style={styles.tdPos}>{f.pp}</td>
                    <td style={{ ...styles.tdPos, fontWeight: 800, color: C.lima }} data-testid="puntos">{f.puntos}</td>
                    <td style={styles.tdPos}>{f.sets_favor}-{f.sets_contra}</td>
                    <td style={styles.tdPos} data-testid="dif-sets">{signo(f.dif_sets)}</td>
                    <td style={styles.tdPos}>{f.puntos_favor}-{f.puntos_contra}</td>
                    <td style={{ ...styles.tdPos, fontWeight: 700, color: f.diferencia_puntos > 0 ? C.lima : f.diferencia_puntos < 0 ? C.rojo : C.suave }} data-testid="dif-puntos">
                      {signo(f.diferencia_puntos)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{ ...styles.faseInfo, marginTop: '12px' }}>
        Orden: puntos (victoria {F.puntosVictoria}, derrota {F.puntosDerrota}) → diferencia de sets → diferencia de puntos.
      </p>
      {hayEmpate && (
        <div style={styles.avisoHuerfana}>
          <p style={{ margin: 0 }}>⚠ Hay parejas empatadas en puntos, diferencia de sets y diferencia de puntos. Las bases no fijan otro criterio: la organización debe decidir.</p>
        </div>
      )}
    </>
  );
}

const signo = n => (n > 0 ? `+${n}` : String(n));

function SeccionFinal({ r, partidoFinal, parejas, onArmar, onResetear, onGuardar, onReset, torneo, fotoUrl, setFotoUrl }) {
  const torneoId = torneo.id;
  if (!r.ligaTerminada) {
    return (
      <>
        <div style={styles.lockedPhase}>🔒 Completa los 6 partidos del todos contra todos para habilitar la final.</div>
        {r.finalistas.length === 2 && (
          <p style={{ ...styles.faseInfo, textAlign: 'center', marginTop: '12px' }}>
            Provisional: {r.finalistas[0].nombre_pareja} vs {r.finalistas[1].nombre_pareja}
          </p>
        )}
        {r.finalHuerfana && (
          <div style={styles.avisoHuerfana}>
            <p style={{ margin: 0 }}>⚠ Hay una final armada con una tabla anterior, pero la liga ya no está completa. Resetéala y vuelve a armarla al terminar la liga.</p>
            <button onClick={onResetear} style={styles.btnResetFase}>Resetear final</button>
          </div>
        )}
      </>
    );
  }

  return (
    <section style={{ ...styles.groupCard, border: `2px solid ${C.oro}` }}>
      <h2 style={{ ...styles.groupTitle, color: C.oro, textAlign: 'center', marginBottom: '4px' }}>🏆 La Gran Final</h2>
      <p style={{ ...styles.faseInfo, textAlign: 'center' }}>1° vs 2° de la tabla · {textoReglas(reglasFase(torneo, 'final'))}</p>

      {!partidoFinal && (r.corteEmpatado
        ? <ElegirFinalistas parejas={parejas} onArmar={onArmar} />
        : (
          <div style={{ textAlign: 'center', padding: '10px' }}>
            <p style={{ fontWeight: 600, marginBottom: '10px' }}>
              Finalistas: <strong>{r.finalistas[0].nombre_pareja}</strong> vs <strong>{r.finalistas[1].nombre_pareja}</strong>
            </p>
            <button onClick={() => onArmar(r.finalistas[0].pareja_id, r.finalistas[1].pareja_id)} style={styles.btnAssign} data-testid="armar-final">🏆 Armar Gran Final</button>
          </div>
        ))}

      {partidoFinal && (
        <>
          <div style={styles.matchesGrid}>
            <TarjetaPartido partido={partidoFinal} torneo={torneo} titulo="Partido por el campeonato" onGuardar={onGuardar} onReset={onReset} />
          </div>
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button onClick={onResetear} style={styles.btnResetFase}>🗑️ Resetear Gran Final</button>
          </div>
        </>
      )}

      {r.campeon && <Podio campeon={r.campeon} final={r.final} torneoId={torneoId} fotoUrl={fotoUrl} setFotoUrl={setFotoUrl} />}
    </section>
  );
}

// Si el 2° y el 3° empatan en todos los criterios, la organización elige los finalistas a mano
function ElegirFinalistas({ parejas, onArmar }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  return (
    <div style={styles.avisoHuerfana}>
      <p style={{ margin: 0 }}>⚠ Empate sin resolver por el 2° puesto. Elige a mano a las 2 parejas finalistas.</p>
      {[[p1, setP1, 'Finalista 1'], [p2, setP2, 'Finalista 2']].map(([valor, set, etiqueta]) => (
        <select key={etiqueta} value={valor} onChange={e => set(e.target.value)} style={styles.select} aria-label={etiqueta}>
          <option value="">{etiqueta}…</option>
          {parejas.map(p => <option key={p.pareja_id} value={p.pareja_id}>{p.nombre_pareja}</option>)}
        </select>
      ))}
      <button onClick={() => (p1 && p2 && p1 !== p2 ? onArmar(Number(p1), Number(p2)) : alert('Elige dos parejas distintas.'))} style={styles.btnAssign}>Armar final</button>
    </div>
  );
}

function Podio({ campeon, final, torneoId, fotoUrl, setFotoUrl }) {
  const inputRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const subcampeon = campeon.id === final.pareja1_id ? final.nombre_pareja2 : final.nombre_pareja1;
  const setsCampeon = Math.max(final.sets_pareja1, final.sets_pareja2);
  const setsRival = Math.min(final.sets_pareja1, final.sets_pareja2);

  const subir = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append('imagen', archivo);
      const res = await fetch(`/api/foto?torneo_id=${torneoId}`, { method: 'POST', body: formData });
      const r = await res.json();
      if (r.ok) setFotoUrl(r.url); else alert(r.error || 'Error al subir la foto');
    } catch { alert('Error de red al subir la foto'); }
    finally { setSubiendo(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  const eliminar = async () => {
    await fetch(`/api/foto?torneo_id=${torneoId}`, { method: 'DELETE' });
    setFotoUrl(null);
  };

  return (
    <div style={{ ...styles.podioWrapper, marginTop: '20px' }} data-testid="podio">
      <div style={styles.podioCuerpo}>
        <div style={styles.podioIzq}>
          <div style={styles.podioCorona}>👑</div>
          <div style={styles.podioBadge}>CAMPEÓN</div>
          <h2 style={styles.podioNombre} data-testid="campeon">{campeon.nombre}</h2>
          <div style={styles.podioMarcador}>
            <span style={styles.podioScore}>{setsCampeon}</span>
            <span style={styles.podioSeparador}>–</span>
            <span style={styles.podioScoreSub}>{setsRival}</span>
          </div>
          <p style={styles.podioSegundo}>{textoSets(final)}<br />vs {subcampeon}</p>
        </div>
        <div style={styles.podioDivisor} />
        <div style={styles.podioDer}>
          {subiendo ? (
            <div style={styles.fotoPlaceholder}><span style={styles.fotoIcono}>⏳</span><span style={styles.fotoTexto}>Subiendo foto...</span></div>
          ) : fotoUrl ? (
            <div style={styles.fotoContainer}>
              <img src={fotoUrl} alt="Campeones" style={styles.fotoGanador} />
              <button onClick={eliminar} style={styles.btnEliminarFoto} title="Eliminar foto">✕</button>
            </div>
          ) : (
            <div style={styles.fotoPlaceholder} onClick={() => inputRef.current?.click()}>
              <span style={styles.fotoIcono}>📸</span>
              <span style={styles.fotoTexto}>Toca para agregar foto del campeón</span>
            </div>
          )}
          <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={subir} style={{ display: 'none' }} />
        </div>
      </div>
      <div style={styles.podioTrofeo}>🏆 ¡Felicitaciones Campeones! 🏆</div>
    </div>
  );
}

function EditorParejas({ torneoId, parejas, onCambio }) {
  const ordenadas = [...parejas].sort((a, b) => a.pareja_id - b.pareja_id);
  return (
    <section style={styles.groupCard}>
      <h2 style={styles.groupTitle}>Parejas inscritas</h2>
      <p style={styles.faseInfo}>Cambiar el nombre no altera partidos ni resultados.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {ordenadas.map((p, i) => <FilaPareja key={`${p.pareja_id}-${p.nombre_pareja}`} numero={i + 1} pareja={p} torneoId={torneoId} onCambio={onCambio} />)}
      </div>
    </section>
  );
}

function FilaPareja({ numero, pareja, torneoId, onCambio }) {
  const [nombre, setNombre] = useState(pareja.nombre_pareja);
  const guardar = async () => {
    const res = await fetch('/api/parejas', { method: 'PUT', headers: json, body: JSON.stringify({ torneo_id: torneoId, id: pareja.pareja_id, nombre }) });
    const r = await res.json().catch(() => ({}));
    if (!res.ok) alert(r.error || 'No se pudo guardar');
    onCambio();
  };
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <span style={styles.badgeNormal}>{numero}</span>
      <input value={nombre} onChange={e => setNombre(e.target.value)} maxLength={150} aria-label={`Nombre de la pareja ${numero}`}
        style={{ ...styles.select, marginBottom: 0, flex: 1 }} data-testid={`pareja-nombre-${numero}`} />
      <button onClick={guardar} disabled={nombre.trim() === pareja.nombre_pareja} style={{ ...boton, padding: '9px 14px', backgroundColor: C.lima, color: C.navy, opacity: nombre.trim() === pareja.nombre_pareja ? 0.4 : 1 }}
        data-testid={`pareja-guardar-${numero}`}>Guardar</button>
    </div>
  );
}

export function Reglas({ torneo }) {
  const reglas = [
    ['Formato', 'Dos canchas en simultáneo. Todos contra todos: cada pareja juega 3 partidos.'],
    ['Puntaje', `Partido ganado: ${F.puntosVictoria} puntos. Partido perdido: ${F.puntosDerrota} puntos.`],
    ['Sets', `Todos contra todos: ${textoReglas(reglasFase(torneo, 'liga')).toLowerCase()}. La final: ${textoReglas(reglasFase(torneo, 'final')).toLowerCase()}.`],
    ['Clasificación', `Las ${F.clasificanFinal} parejas con mayor puntaje juegan la final.`],
    ['Desempate', '1. Diferencia de sets. 2. Si persiste el empate: diferencia de puntos.'],
  ];
  return (
    <section style={styles.groupCard}>
      <h2 style={styles.groupTitle}>Reglas del campeonato</h2>
      <ol style={styles.reglasLista}>
        {reglas.map(([t, texto]) => (
          <li key={t} style={styles.reglaItem}><strong style={styles.reglaTitulo}>{t}</strong><span>{texto}</span></li>
        ))}
      </ol>
    </section>
  );
}
