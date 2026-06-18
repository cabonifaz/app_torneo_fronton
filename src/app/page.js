"use client";
import { useEffect, useState, useRef } from 'react';

export default function Torneo() {
  const [data, setData] = useState({ posiciones: [], partidos: [] });
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('grupos');
  const [fotoUrl, setFotoUrl] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const fileInputRef = useRef(null);

  const cargarDatos = async () => {
    try {
      const res = await fetch('/api/torneo');
      const json = await res.json();
      
      // Solo actualizamos si la base de datos realmente nos envió los arreglos
      if (json.posiciones && json.partidos) {
        setData(json);
      } else {
        console.error("Error desde la base de datos:", json);
      }
    } catch (error) { 
      console.error("Error de conexión:", error); 
    } finally { 
      setCargando(false); 
    }
  };

  const cargarFoto = async () => {
    try {
      const res = await fetch('/api/foto');
      const json = await res.json();
      if (json.existe) setFotoUrl(json.url);
      else setFotoUrl(null);
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    cargarDatos();
    cargarFoto();
    const intervalo = setInterval(cargarDatos, 5000);
    return () => clearInterval(intervalo);
  }, []);

  const accionPartido = async (payload) => {
    await fetch('/api/partidos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    cargarDatos();
  };

  const guardarResultado = (id) => {
    const p1 = document.getElementById(`p1-${id}`).value;
    const p2 = document.getElementById(`p2-${id}`).value;
    if (p1 === "" || p2 === "") return alert("Ingresa ambos puntajes.");
    accionPartido({ id, puntos_pareja1: parseInt(p1), puntos_pareja2: parseInt(p2) });
  };

  const asignarParejas = (id) => {
    const s1 = document.getElementById(`s1-${id}`).value;
    const s2 = document.getElementById(`s2-${id}`).value;
    if (!s1 || !s2 || s1 === s2) return alert("Selecciona dos parejas distintas.");
    accionPartido({ id, pareja1_id: parseInt(s1), pareja2_id: parseInt(s2) });
  };

  const sortearFase = async (partidosFase, todosLosClasificados) => {
    const partidosVacios = partidosFase.filter(p => !p.pareja1_id || !p.pareja2_id);
    if (partidosVacios.length === 0) return alert("Todas las llaves ya están asignadas.");
    const idsUsados = partidosFase.flatMap(p => [p.pareja1_id, p.pareja2_id]).filter(id => id !== null);
    const clasificadosLibres = todosLosClasificados.filter(c => !idsUsados.includes(c.id));
    if (clasificadosLibres.length < partidosVacios.length * 2) {
      return alert("Faltan clasificados para llenar los partidos vacíos restantes.");
    }
    const mezclados = [...clasificadosLibres].sort(() => Math.random() - 0.5);
    const promesas = partidosVacios.map((p, i) => fetch('/api/partidos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, pareja1_id: mezclados[i * 2].id, pareja2_id: mezclados[i * 2 + 1].id })
    }));
    await Promise.all(promesas);
    cargarDatos();
  };

  const manejarFoto = (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    setSubiendoFoto(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const res = await fetch('/api/foto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imagen: ev.target.result })
        });
        const json = await res.json();
        if (json.ok) setFotoUrl(json.url);
        else alert('Error al subir la foto');
      } catch (err) {
        alert('Error de red al subir la foto');
      } finally {
        setSubiendoFoto(false);
      }
    };
    reader.readAsDataURL(archivo);
  };

  const eliminarFoto = async () => {
    await fetch('/api/foto', { method: 'DELETE' });
    setFotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (cargando) return <div style={styles.loading}>Cargando Torneo...</div>;

  const gruposList = [...new Set(data.posiciones.map(p => p.nombre_grupo))];
  const partidosGrupos = data.partidos.filter(p => p.fase === 'grupos');
  const faseGruposTerminada = partidosGrupos.length > 0 && partidosGrupos.every(p => p.jugado === 1);

  const clasificadosGrupos = gruposList.flatMap(g =>
    data.posiciones.filter(p => p.nombre_grupo === g).slice(0, 2).map(p => ({ id: p.pareja_id, nombre: p.nombre_pareja }))
  );

  const ganadoresFase = (faseStr) => data.partidos.filter(p => p.fase === faseStr && p.jugado === 1).map(p => (
    p.puntos_pareja1 > p.puntos_pareja2
      ? { id: p.pareja1_id, nombre: p.nombre_pareja1 }
      : { id: p.pareja2_id, nombre: p.nombre_pareja2 }
  ));

  const clasificadosSemis = ganadoresFase('cuartos');
  const clasificadosFinal = ganadoresFase('semifinal');

  const tablaGeneral = [...data.posiciones].sort((a, b) => {
    if (b.pg !== a.pg) return b.pg - a.pg;
    return b.diferencia_puntos - a.diferencia_puntos;
  });

  const partidoFinal = data.partidos.find(p => p.fase === 'final');
  const hayGanadorFinal = partidoFinal?.jugado === 1;
  const nombreGanadorFinal = hayGanadorFinal
    ? (partidoFinal.puntos_pareja1 > partidoFinal.puntos_pareja2 ? partidoFinal.nombre_pareja1 : partidoFinal.nombre_pareja2)
    : null;
  const puntosGanador = hayGanadorFinal ? Math.max(partidoFinal.puntos_pareja1, partidoFinal.puntos_pareja2) : null;
  const puntosSegundo = hayGanadorFinal ? Math.min(partidoFinal.puntos_pareja1, partidoFinal.puntos_pareja2) : null;
  const nombreSegundo = hayGanadorFinal
    ? (partidoFinal.puntos_pareja1 > partidoFinal.puntos_pareja2 ? partidoFinal.nombre_pareja2 : partidoFinal.nombre_pareja1)
    : null;

  // ─── Tabla de posiciones por grupo ───────────────────────────────────────────
  const TablaPosicionesGrupo = ({ nombreGrupo }) => {
    const posicionesGrupo = data.posiciones
      .filter(p => p.nombre_grupo === nombreGrupo)
      .sort((a, b) => {
        if (b.pg !== a.pg) return b.pg - a.pg;
        return b.diferencia_puntos - a.diferencia_puntos;
      });

    const partidosDelGrupo = partidosGrupos.filter(p => p.nombre_grupo === nombreGrupo);
    const hayPartidosJugados = partidosDelGrupo.some(p => p.jugado === 1);

    return (
      <div style={styles.tablaPosWrapper}>
        <div style={styles.tablaPosHeader}>
          <span style={styles.tablaPosTitle}>Posiciones</span>
          {hayPartidosJugados && (
            <span style={styles.tablaPosLegend}>
              <span style={styles.legendDot} />clasifican top 2
            </span>
          )}
        </div>
        <table style={styles.tablaPos}>
          <thead>
            <tr style={styles.tablaPosHead}>
              <th style={styles.thPos}>#</th>
              <th style={styles.thPosLeft}>Pareja</th>
              <th style={styles.thPos}>PJ</th>
              <th style={styles.thPos}>PG</th>
              <th style={styles.thPos}>Dif</th>
            </tr>
          </thead>
          <tbody>
            {posicionesGrupo.map((pos, idx) => {
              const clasifica = idx < 2;
              const pj = partidosDelGrupo.filter(p =>
                (p.pareja1_id === pos.pareja_id || p.pareja2_id === pos.pareja_id) && p.jugado === 1
              ).length;
              return (
                <tr key={pos.pareja_id} style={clasifica ? styles.rowClasifica : styles.rowNormal}>
                  <td style={styles.tdPos}>
                    {clasifica
                      ? <span style={styles.badgeClasifica}>{idx + 1}</span>
                      : <span style={styles.badgeNormal}>{idx + 1}</span>
                    }
                  </td>
                  <td style={styles.tdPosNombre}>{pos.nombre_pareja}</td>
                  <td style={styles.tdPos}>{pj}</td>
                  <td style={styles.tdPos}>{pos.pg}</td>
                  <td style={{ ...styles.tdPos, fontWeight: '700', color: pos.diferencia_puntos >= 0 ? '#276749' : '#c53030' }}>
                    {pos.diferencia_puntos > 0 ? `+${pos.diferencia_puntos}` : pos.diferencia_puntos}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ─── Tarjeta de partido ───────────────────────────────────────────────────────
  // esFaseGrupos: oculta el botón "Cambiar" para que no se reseteen parejas fijas
  const renderMatchCard = (partido, opcionesParejas, tituloPartido, esFaseGrupos = false) => {
    const idsAsignados = data.partidos.filter(p => p.fase === partido.fase).flatMap(p => [p.pareja1_id, p.pareja2_id]).filter(id => id !== null);
    const opcionesLibres = opcionesParejas.filter(pareja => !idsAsignados.includes(pareja.id));

    if (!partido.pareja1_id || !partido.pareja2_id) {
      return (
        <div key={partido.id} style={styles.matchCard}>
          <h4 style={styles.matchTitle}>{tituloPartido}</h4>
          <select id={`s1-${partido.id}`} style={styles.select}>
            <option value="">Elegir Pareja 1...</option>
            {opcionesLibres.map(o => <option key={`1-${o.id}`} value={o.id}>{o.nombre}</option>)}
          </select>
          <select id={`s2-${partido.id}`} style={styles.select}>
            <option value="">Elegir Pareja 2...</option>
            {opcionesLibres.map(o => <option key={`2-${o.id}`} value={o.id}>{o.nombre}</option>)}
          </select>
          <button onClick={() => asignarParejas(partido.id)} style={styles.btnAssign}>Fijar Manual</button>
        </div>
      );
    }

    const p1Gana = partido.jugado && partido.puntos_pareja1 > partido.puntos_pareja2;
    const p2Gana = partido.jugado && partido.puntos_pareja2 > partido.puntos_pareja1;

    return (
      <div key={partido.id} style={partido.jugado ? styles.matchCardPlayed : styles.matchCard}>
        <h4 style={styles.matchTitle}>{tituloPartido}</h4>
        <div style={styles.matchTeams}>
          <div style={{ ...styles.teamLine, backgroundColor: p1Gana ? '#f0fff4' : 'transparent', borderRadius: '6px', padding: '4px 6px' }}>
            <span style={{ fontWeight: p1Gana ? '700' : '400', color: p1Gana ? '#276749' : '#2d3748' }}>{partido.nombre_pareja1}</span>
            <input type="number" id={`p1-${partido.id}`} defaultValue={partido.jugado ? partido.puntos_pareja1 : ''} style={{ ...styles.scoreInput, borderColor: p1Gana ? '#68d391' : '#cbd5e0' }} />
          </div>
          <div style={{ ...styles.teamLine, backgroundColor: p2Gana ? '#f0fff4' : 'transparent', borderRadius: '6px', padding: '4px 6px' }}>
            <span style={{ fontWeight: p2Gana ? '700' : '400', color: p2Gana ? '#276749' : '#2d3748' }}>{partido.nombre_pareja2}</span>
            <input type="number" id={`p2-${partido.id}`} defaultValue={partido.jugado ? partido.puntos_pareja2 : ''} style={{ ...styles.scoreInput, borderColor: p2Gana ? '#68d391' : '#cbd5e0' }} />
          </div>
        </div>
        {!partido.jugado ? (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => guardarResultado(partido.id)} style={styles.btnSave}>Guardar</button>
            {/* Botón "Cambiar" oculto en fase de grupos para proteger parejas fijas */}
            {!esFaseGrupos && (
              <button onClick={() => accionPartido({ id: partido.id, reset_parejas: true })} style={styles.btnWarning}>Cambiar</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => guardarResultado(partido.id)} style={styles.btnUpdate}>Corregir</button>
            <button onClick={() => accionPartido({ id: partido.id, reset: true })} style={styles.btnReset}>Reset</button>
          </div>
        )}
      </div>
    );
  };

  const BracketBox = ({ partido }) => {
    const p1Gana = partido?.jugado && partido.puntos_pareja1 > partido.puntos_pareja2;
    const p2Gana = partido?.jugado && partido.puntos_pareja2 > partido.puntos_pareja1;
    return (
      <div style={styles.bracketBox}>
        <div style={{ ...styles.bracketTeam, backgroundColor: p1Gana ? '#e6fffa' : '#fff', fontWeight: p1Gana ? 'bold' : 'normal' }}>
          <span style={styles.bracketName}>{partido?.nombre_pareja1 || 'Por definir'}</span>
          <span>{partido?.jugado ? partido.puntos_pareja1 : '-'}</span>
        </div>
        <div style={{ ...styles.bracketTeam, borderBottom: 'none', backgroundColor: p2Gana ? '#e6fffa' : '#fff', fontWeight: p2Gana ? 'bold' : 'normal' }}>
          <span style={styles.bracketName}>{partido?.nombre_pareja2 || 'Por definir'}</span>
          <span>{partido?.jugado ? partido.puntos_pareja2 : '-'}</span>
        </div>
      </div>
    );
  };

  const PodioGanador = () => (
    <div style={styles.podioWrapper}>
      <div style={styles.podioDestellos}>
        {['✨','🌟','⭐','✨','🌟'].map((s, i) => <span key={i} style={styles.destello}>{s}</span>)}
      </div>
      <div style={styles.podioCuerpo}>
        <div style={styles.podioIzq}>
          <div style={styles.podioCorona}>👑</div>
          <div style={styles.podioBadge}>CAMPEÓN</div>
          <h2 style={styles.podioNombre}>{nombreGanadorFinal}</h2>
          <div style={styles.podioMarcador}>
            <span style={styles.podioScore}>{puntosGanador}</span>
            <span style={styles.podioSeparador}>–</span>
            <span style={styles.podioScoreSub}>{puntosSegundo}</span>
          </div>
          <p style={styles.podioSegundo}>vs {nombreSegundo}</p>
        </div>
        <div style={styles.podioDivisor} />
        <div style={styles.podioDer}>
          {subiendoFoto ? (
            <div style={styles.fotoPlaceholder}>
              <span style={styles.fotoIcono}>⏳</span>
              <span style={styles.fotoTexto}>Subiendo foto...</span>
            </div>
          ) : fotoUrl ? (
            <div style={styles.fotoContainer}>
              <img src={fotoUrl} alt="Campeones" style={styles.fotoGanador} />
              <button onClick={eliminarFoto} style={styles.btnEliminarFoto} title="Eliminar foto">✕</button>
            </div>
          ) : (
            <div style={styles.fotoPlaceholder} onClick={() => fileInputRef.current?.click()}>
              <span style={styles.fotoIcono}>📸</span>
              <span style={styles.fotoTexto}>Toca para agregar foto del campeón</span>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={manejarFoto} style={{ display: 'none' }} />
          {fotoUrl && !subiendoFoto && (
            <button onClick={() => fileInputRef.current?.click()} style={styles.btnCambiarFoto}>📷 Cambiar foto</button>
          )}
        </div>
      </div>
      <div style={styles.podioTrofeo}>🏆 ¡Felicitaciones Campeones! 🏆</div>
    </div>
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🏆 Torneo de Frontón</h1>
        <p style={styles.subtitle}>Día del Padre</p>
      </header>

      <div style={styles.tabsContainer}>
        <button onClick={() => setTab('grupos')} style={tab === 'grupos' ? styles.tabActive : styles.tab}>Fase Grupos</button>
        <button onClick={() => setTab('tabla')} style={tab === 'tabla' ? styles.tabActive : styles.tab}>Tabla General</button>
        <button onClick={() => setTab('fase_final')} style={tab === 'fase_final' ? styles.tabActive : styles.tab}>Llaves Finales</button>
      </div>

      {/* ── FASE DE GRUPOS ── */}
      {tab === 'grupos' && gruposList.map((nombreGrupo) => {
        const partidosDelGrupo = partidosGrupos.filter(p => p.nombre_grupo === nombreGrupo);
        return (
          <section key={nombreGrupo} style={styles.groupCard}>
            {/* Cabecera del grupo */}
            <h2 style={styles.groupTitle}>{nombreGrupo}</h2>

            {/* TABLA DE POSICIONES del grupo */}
            <TablaPosicionesGrupo nombreGrupo={nombreGrupo} />

            {/* Divisor */}
            <div style={styles.divider} />

            {/* Partidos del grupo */}
            <p style={styles.seccionLabel}>Partidos</p>
            <div style={styles.matchesGrid}>
              {partidosDelGrupo.map((p, i) => renderMatchCard(p, [], `Partido ${i + 1}`))}
            </div>
          </section>
        );
      })}

      {/* ── TABLA GENERAL ── */}
      {tab === 'tabla' && (
        <section style={styles.groupCard}>
          <h2 style={{ ...styles.groupTitle, textAlign: 'center' }}>Tabla General Consolidada</h2>
          <p style={{ fontSize: '0.85rem', color: '#718096', textAlign: 'center', marginBottom: '15px' }}>Ordenado por Partidos Ganados y Diferencia de Puntos</p>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.thCenter}>#</th>
                  <th style={styles.th}>Pareja</th>
                  <th style={styles.thCenter}>Grupo</th>
                  <th style={styles.thCenter}>PG</th>
                  <th style={styles.thCenter}>Dif</th>
                </tr>
              </thead>
              <tbody>
                {tablaGeneral.map((pos, idx) => (
                  <tr key={pos.pareja_id} style={idx < 8 ? styles.rowQualified : styles.rowStandard}>
                    <td style={styles.tdCenter}><strong>{idx + 1}</strong></td>
                    <td style={styles.tdMain}>{pos.nombre_pareja}</td>
                    <td style={styles.tdCenter}><span style={styles.badgeGrupo}>{pos.nombre_grupo.replace('GRUPO ', 'G')}</span></td>
                    <td style={styles.tdCenter}>{pos.pg}</td>
                    <td style={styles.tdBold}>{pos.diferencia_puntos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── FASE FINAL ── */}
      {tab === 'fase_final' && (
        <div style={styles.finalPhaseSection}>
          {!faseGruposTerminada ? (
            <div style={styles.lockedPhase}>🔒 Termina todos los partidos de grupos para habilitar el Sorteo y el Mapa de Llaves.</div>
          ) : (
            <>
              <div style={styles.bracketContainer}>
                <h3 style={{ textAlign: 'center', color: '#2d3748', marginBottom: '15px' }}>🗺️ Mapa de Llaves</h3>
                <div style={styles.bracketScroll}>
                  <div style={styles.bracketCol}>
                    <div style={styles.bracketHeader}>Cuartos</div>
                    {data.partidos.filter(p => p.fase === 'cuartos').map(p => <BracketBox key={p.id} partido={p} />)}
                  </div>
                  <div style={{ ...styles.bracketCol, justifyContent: 'space-around' }}>
                    <div style={styles.bracketHeader}>Semifinal</div>
                    {data.partidos.filter(p => p.fase === 'semifinal').map(p => <BracketBox key={p.id} partido={p} />)}
                  </div>
                  <div style={{ ...styles.bracketCol, justifyContent: 'center' }}>
                    <div style={styles.bracketHeader}>Final</div>
                    {data.partidos.filter(p => p.fase === 'final').map(p => <BracketBox key={p.id} partido={p} />)}
                  </div>
                </div>
              </div>

              <section style={styles.groupCard}>
                <div style={styles.headerFlex}>
                  <h2 style={styles.groupTitle}>Cuartos de Final</h2>
                  <button onClick={() => sortearFase(data.partidos.filter(p => p.fase === 'cuartos'), clasificadosGrupos)} style={styles.btnSorteo}>🎲 Sorteo</button>
                </div>
                <p style={styles.faseInfo}>Clasifican los 2 primeros de cada grupo · 8 parejas · 4 cruces</p>
                <div style={styles.matchesGrid}>
                  {data.partidos.filter(p => p.fase === 'cuartos').map((p, i) => renderMatchCard(p, clasificadosGrupos, `Cruce ${i + 1}`))}
                </div>
              </section>

              <section style={styles.groupCard}>
                <div style={styles.headerFlex}>
                  <h2 style={styles.groupTitle}>Semifinales</h2>
                  <button onClick={() => sortearFase(data.partidos.filter(p => p.fase === 'semifinal'), clasificadosSemis)} style={styles.btnSorteo}>🎲 Sorteo</button>
                </div>
                <p style={styles.faseInfo}>Ganadores de cuartos · 4 parejas · 2 partidos</p>
                <div style={styles.matchesGrid}>
                  {data.partidos.filter(p => p.fase === 'semifinal').map((p, i) => renderMatchCard(p, clasificadosSemis, `Semifinal ${i + 1}`))}
                </div>
              </section>

              <section style={{ ...styles.groupCard, border: '2px solid #ecc94b', overflow: 'hidden' }}>
                <h2 style={{ ...styles.groupTitle, color: '#b7791f', textAlign: 'center', marginBottom: '4px' }}>
                  🏆 LA GRAN FINAL 🏆
                </h2>
                <p style={{ ...styles.faseInfo, textAlign: 'center' }}>Ganadores de semifinales · set a 21</p>
                <div style={styles.matchesGrid}>
                  {data.partidos.filter(p => p.fase === 'final').map(p => renderMatchCard(p, clasificadosFinal, `Partido por el Campeonato`))}
                </div>
                {hayGanadorFinal && (
                  <div style={{ marginTop: '20px' }}>
                    <PodioGanador />
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.2rem' },
  container: { fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto', padding: '15px', backgroundColor: '#f4f6f8', minHeight: '100vh' },
  header: { textAlign: 'center', marginBottom: '15px' },
  title: { margin: '0 0 5px 0', color: '#1a202c', fontSize: '1.6rem' },
  subtitle: { margin: 0, color: '#718096' },

  tabsContainer: { display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '8px', padding: '4px', marginBottom: '20px' },
  tab: { flex: 1, padding: '10px', textAlign: 'center', border: 'none', background: 'transparent', color: '#4a5568', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', transition: '0.2s', fontSize: '0.8rem' },
  tabActive: { flex: 1, padding: '10px', textAlign: 'center', border: 'none', background: '#fff', color: '#2b6cb0', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', fontSize: '0.8rem' },

  headerFlex: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px', borderBottom: '2px solid #edf2f7', paddingBottom: '10px' },
  groupCard: { backgroundColor: '#fff', borderRadius: '12px', padding: '15px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  groupTitle: { margin: '0 0 12px 0', color: '#2d3748', fontSize: '1.2rem' },
  divider: { height: '1px', backgroundColor: '#edf2f7', margin: '16px 0' },
  seccionLabel: { fontSize: '0.8rem', fontWeight: '700', color: '#718096', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px 0' },
  faseInfo: { fontSize: '0.8rem', color: '#718096', margin: '0 0 12px 0' },

  // Tabla de posiciones por grupo
  tablaPosWrapper: { backgroundColor: '#f8fafc', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' },
  tablaPosHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#edf2f7' },
  tablaPosTitle: { fontSize: '0.78rem', fontWeight: '700', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' },
  tablaPosLegend: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: '#718096' },
  legendDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#38a169', display: 'inline-block' },
  tablaPos: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  tablaPosHead: { backgroundColor: '#edf2f7' },
  thPos: { padding: '6px 8px', textAlign: 'center', color: '#718096', fontSize: '0.75rem', fontWeight: '600' },
  thPosLeft: { padding: '6px 8px', textAlign: 'left', color: '#718096', fontSize: '0.75rem', fontWeight: '600' },
  rowClasifica: { borderBottom: '1px solid #c6f6d5', backgroundColor: '#f0fff4' },
  rowNormal: { borderBottom: '1px solid #edf2f7', backgroundColor: '#fff' },
  tdPos: { padding: '8px', textAlign: 'center', color: '#2d3748' },
  tdPosNombre: { padding: '8px', textAlign: 'left', color: '#2d3748', fontWeight: '500' },
  badgeClasifica: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#38a169', color: '#fff', fontSize: '0.75rem', fontWeight: '700' },
  badgeNormal: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#e2e8f0', color: '#718096', fontSize: '0.75rem', fontWeight: '600' },

  // Tabla general
  tableWrapper: { overflowX: 'auto', marginBottom: '10px' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' },
  th: { padding: '8px', color: '#4a5568', borderBottom: '2px solid #e2e8f0' },
  thCenter: { padding: '8px', textAlign: 'center', color: '#4a5568', borderBottom: '2px solid #e2e8f0' },
  rowStandard: { borderBottom: '1px solid #edf2f7' },
  rowQualified: { borderBottom: '1px solid #edf2f7', backgroundColor: '#f0fff4' },
  tdMain: { padding: '8px', fontWeight: '500', color: '#2d3748' },
  tdCenter: { padding: '8px', textAlign: 'center' },
  tdBold: { padding: '8px', textAlign: 'center', fontWeight: '700' },
  badgeGrupo: { backgroundColor: '#edf2f7', color: '#4a5568', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' },

  // Partidos
  matchesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' },
  matchCard: { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', backgroundColor: '#faf5ff' },
  matchCardPlayed: { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', backgroundColor: '#f7fafc', opacity: 0.9 },
  matchTitle: { margin: '0 0 10px 0', fontSize: '0.9rem', color: '#718096' },
  matchTeams: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' },
  teamLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' },
  scoreInput: { width: '50px', padding: '6px', textAlign: 'center', border: '1px solid #cbd5e0', borderRadius: '4px' },
  select: { width: '100%', padding: '8px', marginBottom: '8px', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '0.9rem' },

  btnSave: { flex: 2, padding: '8px', backgroundColor: '#6b46c1', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
  btnWarning: { flex: 1, padding: '8px', backgroundColor: '#fffaf0', color: '#dd6b20', border: '1px solid #fbd38d', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' },
  btnUpdate: { flex: 1, padding: '8px', backgroundColor: '#edf2f7', color: '#4a5568', border: '1px solid #cbd5e0', borderRadius: '6px', cursor: 'pointer' },
  btnReset: { flex: 1, padding: '8px', backgroundColor: '#fed7d7', color: '#c53030', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  btnAssign: { width: '100%', padding: '10px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
  btnSorteo: { padding: '6px 12px', backgroundColor: '#38a169', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' },

  finalPhaseSection: {},
  lockedPhase: { textAlign: 'center', padding: '20px', backgroundColor: '#edf2f7', borderRadius: '8px', color: '#718096', fontWeight: '500', marginTop: '20px' },

  bracketContainer: { backgroundColor: '#fff', borderRadius: '12px', padding: '15px', marginBottom: '25px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' },
  bracketScroll: { display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '10px' },
  bracketCol: { display: 'flex', flexDirection: 'column', gap: '15px', minWidth: '180px', flex: 1 },
  bracketHeader: { textAlign: 'center', fontSize: '0.85rem', fontWeight: 'bold', color: '#718096', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' },
  bracketBox: { border: '1px solid #cbd5e0', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  bracketTeam: { display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid #edf2f7', fontSize: '0.8rem', color: '#2d3748' },
  bracketName: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' },

  // Podio
  podioWrapper: { background: 'linear-gradient(135deg, #fffbea 0%, #fef3c7 50%, #fde68a 100%)', border: '2px solid #f6c000', borderRadius: '16px', padding: '20px 16px', boxShadow: '0 4px 20px rgba(246,192,0,0.3)' },
  podioDestellos: { display: 'flex', justifyContent: 'space-around', marginBottom: '10px' },
  destello: { fontSize: '1.4rem' },
  podioCuerpo: { display: 'flex', gap: '16px', alignItems: 'stretch' },
  podioIzq: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' },
  podioCorona: { fontSize: '2.8rem', lineHeight: 1, marginBottom: '2px' },
  podioBadge: { backgroundColor: '#b7791f', color: '#fff', fontSize: '0.65rem', fontWeight: '800', letterSpacing: '2px', padding: '3px 10px', borderRadius: '20px' },
  podioNombre: { margin: '6px 0 2px 0', fontSize: '1.15rem', fontWeight: '800', color: '#744210', textAlign: 'center', lineHeight: 1.2 },
  podioMarcador: { display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' },
  podioScore: { fontSize: '2rem', fontWeight: '900', color: '#276749' },
  podioSeparador: { fontSize: '1.2rem', color: '#718096', fontWeight: '300' },
  podioScoreSub: { fontSize: '1.5rem', fontWeight: '700', color: '#e53e3e' },
  podioSegundo: { fontSize: '0.75rem', color: '#718096', margin: '2px 0 0 0', textAlign: 'center' },
  podioDivisor: { width: '1px', backgroundColor: '#f6c000', opacity: 0.5, borderRadius: '4px', minHeight: '120px' },
  podioDer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  fotoContainer: { position: 'relative', width: '100%', maxWidth: '160px' },
  fotoGanador: { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '12px', border: '3px solid #f6c000', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'block' },
  btnEliminarFoto: { position: 'absolute', top: '-8px', right: '-8px', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#e53e3e', color: 'white', border: 'none', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', padding: 0 },
  fotoPlaceholder: { width: '100%', maxWidth: '160px', aspectRatio: '1', border: '2px dashed #c9a227', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', padding: '10px', boxSizing: 'border-box' },
  fotoIcono: { fontSize: '2rem', lineHeight: 1 },
  fotoTexto: { fontSize: '0.7rem', color: '#92703a', textAlign: 'center', lineHeight: 1.3 },
  btnCambiarFoto: { padding: '6px 14px', backgroundColor: 'rgba(255,255,255,0.8)', color: '#744210', border: '1px solid #c9a227', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' },
  podioTrofeo: { textAlign: 'center', fontSize: '0.85rem', fontWeight: '700', color: '#b7791f', marginTop: '16px', letterSpacing: '0.5px' },
};