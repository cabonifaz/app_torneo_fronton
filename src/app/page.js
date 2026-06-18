"use client";
import { useEffect, useState, useRef } from 'react';

export default function Torneo() {
  const [data, setData] = useState({ posiciones: [], partidos: [] });
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('grupos');
  const [subTabGrupos, setSubTabGrupos] = useState(null);
  const [subTabCuartos, setSubTabCuartos] = useState(null);
  const [fotoUrl, setFotoUrl] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const fileInputRef = useRef(null);

  const cargarDatos = async () => {
    try {
      const res = await fetch('/api/torneo');
      const json = await res.json();
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

  const sortearFaseCuartos = async (partidosCuartos, clasificadosFase1) => {
    const partidosVacios = partidosCuartos.filter(p => !p.pareja1_id || !p.pareja2_id);
    if (partidosVacios.length === 0) return alert("Todas las parejas ya están asignadas en los grupos de Cuartos.");

    if (clasificadosFase1.length < 8) {
      return alert("Se necesitan las 8 parejas clasificadas de la Fase de Grupos para realizar el sorteo.");
    }

    const mezclados = [...clasificadosFase1].sort(() => Math.random() - 0.5);
    const grupoA = mezclados.slice(0, 4);
    const grupoB = mezclados.slice(4, 8);

    const idGruposCuartos = [...new Set(partidosCuartos.map(p => p.grupo_id))].sort((a, b) => a - b);
    if (idGruposCuartos.length < 2) return alert("Falta configurar los 2 grupos de cuartos en la base de datos.");

    const idGrupo1 = idGruposCuartos[0];
    const idGrupo2 = idGruposCuartos[1];

    const crucesRelativos = [
      { p1Idx: 0, p2Idx: 1 }, { p1Idx: 2, p2Idx: 3 },
      { p1Idx: 0, p2Idx: 2 }, { p1Idx: 1, p2Idx: 3 },
      { p1Idx: 0, p2Idx: 3 }, { p1Idx: 1, p2Idx: 2 }
    ];

    const promesas = [];

    const partidosG1 = partidosCuartos.filter(p => p.grupo_id === idGrupo1);
    crucesRelativos.forEach((cruce, idx) => {
      if (partidosG1[idx]) {
        promesas.push(fetch('/api/partidos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: partidosG1[idx].id,
            pareja1_id: grupoA[cruce.p1Idx].id,
            pareja2_id: grupoA[cruce.p2Idx].id
          })
        }));
      }
    });

    const partidosG2 = partidosCuartos.filter(p => p.grupo_id === idGrupo2);
    crucesRelativos.forEach((cruce, idx) => {
      if (partidosG2[idx]) {
        promesas.push(fetch('/api/partidos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: partidosG2[idx].id,
            pareja1_id: grupoB[cruce.p1Idx].id,
            pareja2_id: grupoB[cruce.p2Idx].id
          })
        }));
      }
    });

    await Promise.all(promesas);
    cargarDatos();
  };

  // ── Crea los 2 partidos de semifinal en la BD con las parejas ya asignadas ──
  const setupSemifinal = async (clasificadosCuartos) => {
    if (clasificadosCuartos.length < 4) {
      return alert("Se necesitan las 4 parejas clasificadas de Cuartos.");
    }

    // Cruce: 1°G1 vs 2°G2  |  1°G2 vs 2°G1
    const cruces = [
      { pareja1_id: clasificadosCuartos[0].id, pareja2_id: clasificadosCuartos[3].id },
      { pareja1_id: clasificadosCuartos[2].id, pareja2_id: clasificadosCuartos[1].id },
    ];

    await Promise.all(
      cruces.map(cruce =>
        fetch('/api/partidos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fase: 'semifinal',
            pareja1_id: cruce.pareja1_id,
            pareja2_id: cruce.pareja2_id,
          })
        })
      )
    );
    cargarDatos();
  };

  // ── Crea el partido de final en la BD con los ganadores de semifinal ──
  const setupFinal = async (clasificadosFinal) => {
    if (clasificadosFinal.length < 2) {
      return alert("Se necesitan los 2 ganadores de Semifinal.");
    }

    await fetch('/api/partidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fase: 'final',
        pareja1_id: clasificadosFinal[0].id,
        pareja2_id: clasificadosFinal[1].id,
      })
    });
    cargarDatos();
  };

  // ── Borra todos los partidos de una fase (DELETE por fase) ──
  const resetearFase = async (fase) => {
    const confirmar = confirm(`¿Seguro que quieres resetear toda la ${fase}? Se borrarán los partidos y resultados.`);
    if (!confirmar) return;

    await fetch('/api/partidos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fase })
    });
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

  const partidosFase1 = data.partidos.filter(p => p.fase === 'grupos');
  const partidosCuartos = data.partidos.filter(p => p.fase === 'cuartos');
  const partidosSemifinal = data.partidos.filter(p => p.fase === 'semifinal');
  const partidoFinal = data.partidos.find(p => p.fase === 'final');

  const gruposFase1 = [...new Set(partidosFase1.map(p => p.nombre_grupo))];
  const gruposCuartos = [...new Set(partidosCuartos.map(p => p.nombre_grupo))];

  const fase1Terminada = partidosFase1.length > 0 && partidosFase1.every(p => p.jugado === 1);
  const cuartosTerminado = partidosCuartos.length > 0 && partidosCuartos.every(p => p.jugado === 1);
  const semifinalTerminado = partidosSemifinal.length > 0 && partidosSemifinal.every(p => p.jugado === 1);

  const clasificadosFase1 = gruposFase1.flatMap(g =>
    data.posiciones.filter(p => p.nombre_grupo === g).slice(0, 2).map(p => ({ id: p.pareja_id, nombre: p.nombre_pareja }))
  );

  // Top 2 de cada grupo de Cuartos → van a Semifinal
  const clasificadosCuartos = gruposCuartos.flatMap(g =>
    data.posiciones
      .filter(p => p.nombre_grupo === g)
      .sort((a, b) => b.pg - a.pg || b.diferencia_puntos - a.diferencia_puntos)
      .slice(0, 2)
      .map(p => ({ id: p.pareja_id, nombre: p.nombre_pareja }))
  );

  // Ganadores de Semifinal → van a la Final
  const clasificadosFinal = partidosSemifinal
    .filter(p => p.jugado === 1 && p.pareja1_id && p.pareja2_id)
    .map(p => p.puntos_pareja1 > p.puntos_pareja2
      ? { id: p.pareja1_id, nombre: p.nombre_pareja1 }
      : { id: p.pareja2_id, nombre: p.nombre_pareja2 }
    );

  const tablaGeneral = [...data.posiciones]
    .filter(pos => gruposFase1.includes(pos.nombre_grupo))
    .sort((a, b) => {
      if (b.pg !== a.pg) return b.pg - a.pg;
      return b.diferencia_puntos - a.diferencia_puntos;
    });

  const hayGanadorFinal = partidoFinal?.jugado === 1;
  const nombreGanadorFinal = hayGanadorFinal
    ? (partidoFinal.puntos_pareja1 > partidoFinal.puntos_pareja2 ? partidoFinal.nombre_pareja1 : partidoFinal.nombre_pareja2)
    : null;
  const puntosGanador = hayGanadorFinal ? Math.max(partidoFinal.puntos_pareja1, partidoFinal.puntos_pareja2) : null;
  const puntosSegundo = hayGanadorFinal ? Math.min(partidoFinal.puntos_pareja1, partidoFinal.puntos_pareja2) : null;
  const nombreSegundo = hayGanadorFinal
    ? (partidoFinal.puntos_pareja1 > partidoFinal.puntos_pareja2 ? partidoFinal.nombre_pareja2 : partidoFinal.nombre_pareja1)
    : null;

  // Sub-tab activo con fallback al primer grupo
  const grupoActivoFase1 = (subTabGrupos && gruposFase1.includes(subTabGrupos))
    ? subTabGrupos
    : gruposFase1[0];
  const grupoActivoCuartos = (subTabCuartos && gruposCuartos.includes(subTabCuartos))
    ? subTabCuartos
    : gruposCuartos[0];

  const TablaPosicionesGrupo = ({ nombreGrupo, limiteClasificacion = 2 }) => {
    const posicionesGrupo = data.posiciones
      .filter(p => p.nombre_grupo === nombreGrupo)
      .sort((a, b) => {
        if (b.pg !== a.pg) return b.pg - a.pg;
        return b.diferencia_puntos - a.diferencia_puntos;
      });

    const partidosDelGrupo = data.partidos.filter(p => p.nombre_grupo === nombreGrupo);
    const hayPartidosJugados = partidosDelGrupo.some(p => p.jugado === 1);

    return (
      <div style={styles.tablaPosWrapper}>
        <div style={styles.tablaPosHeader}>
          <span style={styles.tablaPosTitle}>Posiciones</span>
          {hayPartidosJugados && (
            <span style={styles.tablaPosLegend}>
              <span style={styles.legendDot} />clasifican top {limiteClasificacion}
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
              const clasifica = idx < limiteClasificacion;
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

  const renderMatchCard = (partido, opcionesParejas, tituloPartido, esFaseGrupos = false) => {
    const idsAsignados = data.partidos.filter(p => p.fase === partido.fase).flatMap(p => [p.pareja1_id, p.pareja2_id]).filter(id => id !== null);
    const opcionesLibres = opcionesParejas.filter(pareja => !idsAsignados.includes(pareja.id));

    if (!partido.pareja1_id || !partido.pareja2_id) {
      return (
        <div key={partido.id} style={styles.matchCard}>
          <h4 style={styles.matchTitle}>{tituloPartido}</h4>
          {esFaseGrupos ? (
            <p style={{ fontSize: '0.85rem', color: '#718096', fontStyle: 'italic' }}>Esperando asignación...</p>
          ) : (
            <>
              <select id={`s1-${partido.id}`} style={styles.select}>
                <option value="">Elegir Pareja 1...</option>
                {opcionesLibres.map(o => <option key={`1-${o.id}`} value={o.id}>{o.nombre}</option>)}
              </select>
              <select id={`s2-${partido.id}`} style={styles.select}>
                <option value="">Elegir Pareja 2...</option>
                {opcionesLibres.map(o => <option key={`2-${o.id}`} value={o.id}>{o.nombre}</option>)}
              </select>
              <button onClick={() => asignarParejas(partido.id)} style={styles.btnAssign}>Fijar Parejas</button>
            </>
          )}
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

  const PodioGanador = () => (
    <div style={styles.podioWrapper}>
      <div style={styles.podioDestellos}>
        {['✨', '🌟', '⭐', '✨', '🌟'].map((s, i) => <span key={i} style={styles.destello}>{s}</span>)}
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

  // ── Componente de sub-pestañas reutilizable ──
  const SubTabs = ({ grupos, grupoActivo, onSelect, colorActivo = '#6b46c1' }) => (
    <div style={styles.subTabsContainer}>
      {grupos.map(nombre => {
        const esActivo = nombre === grupoActivo;
        return (
          <button
            key={nombre}
            onClick={() => onSelect(nombre)}
            style={esActivo
              ? { ...styles.subTabBase, ...styles.subTabActive, color: colorActivo, borderColor: colorActivo }
              : styles.subTabBase
            }
          >
            {nombre}
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🏆 Torneo de Frontón</h1>
        <p style={styles.subtitle}>Día del Padre</p>
      </header>

      <div style={styles.tabsContainer}>
        <button onClick={() => setTab('grupos')} style={tab === 'grupos' ? styles.tabActive : styles.tab}>Fase 1</button>
        <button onClick={() => setTab('tabla')} style={tab === 'tabla' ? styles.tabActive : styles.tab}>Tabla</button>
        <button onClick={() => setTab('cuartos_fase')} style={tab === 'cuartos_fase' ? styles.tabActive : styles.tab}>Cuartos</button>
        <button onClick={() => setTab('semifinal')} style={tab === 'semifinal' ? styles.tabActive : styles.tab}>Semifinal</button>
        <button onClick={() => setTab('gran_final')} style={tab === 'gran_final' ? styles.tabActive : styles.tab}>Gran Final</button>
      </div>

      {/* ── FASE 1: GRUPOS con sub-pestañas ── */}
      {tab === 'grupos' && gruposFase1.length > 0 && (
        <>
          <SubTabs
            grupos={gruposFase1}
            grupoActivo={grupoActivoFase1}
            onSelect={setSubTabGrupos}
            colorActivo="#6b46c1"
          />
          {(() => {
            const partidosDelGrupo = partidosFase1.filter(p => p.nombre_grupo === grupoActivoFase1);
            return (
              <section style={styles.groupCard}>
                <h2 style={styles.groupTitle}>{grupoActivoFase1}</h2>
                <TablaPosicionesGrupo nombreGrupo={grupoActivoFase1} limiteClasificacion={2} />
                <div style={styles.divider} />
                <p style={styles.seccionLabel}>Partidos</p>
                <div style={styles.matchesGrid}>
                  {partidosDelGrupo.map((p, i) => renderMatchCard(p, [], `Partido ${i + 1}`, true))}
                </div>
              </section>
            );
          })()}
        </>
      )}

      {/* ── TABLA GENERAL ── */}
      {tab === 'tabla' && (
        <section style={styles.groupCard}>
          <h2 style={{ ...styles.groupTitle, textAlign: 'center' }}>Tabla General Consolidada (Fase 1)</h2>
          <p style={{ fontSize: '0.85rem', color: '#718096', textAlign: 'center', marginBottom: '15px' }}>Top 2 de cada grupo avanzan a la Fase 2</p>
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

      {/* ── FASE 2: CUARTOS con sub-pestañas ── */}
      {tab === 'cuartos_fase' && (
        <div style={styles.finalPhaseSection}>
          {!fase1Terminada ? (
            <div style={styles.lockedPhase}>🔒 Completa la totalidad de los partidos de la Fase 1 para habilitar el Sorteo de Grupos de Cuartos.</div>
          ) : (
            <>
              <div style={{ ...styles.groupCard, backgroundColor: '#f0fff4', border: '1px solid #c6f6d5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontWeight: '700', color: '#22543d' }}>Sorteo de Cuartos de Final</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#2f855a' }}>Distribuye las 8 parejas en 2 nuevos grupos de forma aleatoria.</p>
                </div>
                <button onClick={() => sortearFaseCuartos(partidosCuartos, clasificadosFase1)} style={styles.btnSorteo}>🎲 Ejecutar Sorteo</button>
              </div>

              {gruposCuartos.length > 0 && (
                <>
                  <SubTabs
                    grupos={gruposCuartos}
                    grupoActivo={grupoActivoCuartos}
                    onSelect={setSubTabCuartos}
                    colorActivo="#2b6cb0"
                  />
                  {(() => {
                    const partidosDelGrupo = partidosCuartos.filter(p => p.nombre_grupo === grupoActivoCuartos);
                    return (
                      <section style={styles.groupCard}>
                        <h2 style={{ ...styles.groupTitle, color: '#2b6cb0' }}>{grupoActivoCuartos}</h2>
                        <TablaPosicionesGrupo nombreGrupo={grupoActivoCuartos} limiteClasificacion={2} />
                        <div style={styles.divider} />
                        <p style={styles.seccionLabel}>Partidos de Grupo</p>
                        <div style={styles.matchesGrid}>
                          {partidosDelGrupo.map((p, i) => renderMatchCard(p, clasificadosFase1, `Partido ${i + 1}`, false))}
                        </div>
                      </section>
                    );
                  })()}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── SEMIFINAL ── */}
      {tab === 'semifinal' && (
        <div style={styles.finalPhaseSection}>
          {!cuartosTerminado ? (
            <div style={styles.lockedPhase}>🔒 Completa todos los partidos de Cuartos para habilitar la Semifinal.</div>
          ) : (
            <section style={{ ...styles.groupCard, border: '2px solid #bee3f8' }}>
              <h2 style={{ ...styles.groupTitle, color: '#2b6cb0', textAlign: 'center', marginBottom: '4px' }}>
                🥊 Semifinal
              </h2>
              <p style={{ ...styles.faseInfo, textAlign: 'center' }}>Los 2 mejores de cada grupo de Cuartos se cruzan</p>

              {/* Cuadro de clasificados */}
              {clasificadosCuartos.length >= 4 && (
                <div style={styles.semiBracketCard}>
                  <div style={styles.semiBracketCol}>
                    <span style={styles.semiBracketLabel}>Semifinal 1</span>
                    <div style={styles.semiBracketRow}>
                      <span style={styles.semiBracketBadge}>1° {gruposCuartos[0] || 'G1'}</span>
                      <span style={styles.semiBracketNombre}>{clasificadosCuartos[0].nombre}</span>
                    </div>
                    <div style={styles.semiBracketVs}>vs</div>
                    <div style={styles.semiBracketRow}>
                      <span style={{ ...styles.semiBracketBadge, backgroundColor: '#ebf8ff', color: '#2b6cb0' }}>
                        2° {gruposCuartos[1] || 'G2'}
                      </span>
                      <span style={styles.semiBracketNombre}>{clasificadosCuartos[3].nombre}</span>
                    </div>
                  </div>
                  <div style={styles.semiBracketDivisor} />
                  <div style={styles.semiBracketCol}>
                    <span style={styles.semiBracketLabel}>Semifinal 2</span>
                    <div style={styles.semiBracketRow}>
                      <span style={styles.semiBracketBadge}>1° {gruposCuartos[1] || 'G2'}</span>
                      <span style={styles.semiBracketNombre}>{clasificadosCuartos[2].nombre}</span>
                    </div>
                    <div style={styles.semiBracketVs}>vs</div>
                    <div style={styles.semiBracketRow}>
                      <span style={{ ...styles.semiBracketBadge, backgroundColor: '#ebf8ff', color: '#2b6cb0' }}>
                        2° {gruposCuartos[0] || 'G1'}
                      </span>
                      <span style={styles.semiBracketNombre}>{clasificadosCuartos[1].nombre}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Botón armar: solo si no existen aún los partidos */}
              {clasificadosCuartos.length >= 4 && partidosSemifinal.length === 0 && (
                <button
                  onClick={() => setupSemifinal(clasificadosCuartos)}
                  style={{ ...styles.btnAssign, marginBottom: '16px' }}
                >
                  ⚔️ Armar Cuadro de Semifinal
                </button>
              )}

              {/* Tarjetas de partido */}
              {partidosSemifinal.length > 0 && (
                <>
                  <div style={styles.divider} />
                  <p style={styles.seccionLabel}>Partidos</p>
                  <div style={styles.matchesGrid}>
                    {partidosSemifinal.map((p, i) =>
                      renderMatchCard(p, clasificadosCuartos, `Semifinal ${i + 1}`, false)
                    )}
                  </div>

                  {/* Botón reset fase completa */}
                  <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <button
                      onClick={() => resetearFase('semifinal')}
                      style={styles.btnResetFase}
                    >
                       Resetear Semifinal completa
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      )}

      {/* ── GRAN FINAL ── */}
      {tab === 'gran_final' && (
        <div style={styles.finalPhaseSection}>
          {!semifinalTerminado ? (
            <div style={styles.lockedPhase}>🔒 Completa los partidos de Semifinal para habilitar la Gran Final.</div>
          ) : (
            <section style={{ ...styles.groupCard, border: '2px solid #ecc94b', overflow: 'hidden' }}>
              <h2 style={{ ...styles.groupTitle, color: '#b7791f', textAlign: 'center', marginBottom: '4px' }}>
                🏆 LA GRAN FINAL 🏆
              </h2>
              <p style={{ ...styles.faseInfo, textAlign: 'center' }}>Ganadores de Semifinal 1 vs Semifinal 2 · Set único a 21 puntos</p>

              {/* No existe el partido final aún → crearlo automáticamente */}
              {!partidoFinal && clasificadosFinal.length >= 2 && (
                <div style={{ textAlign: 'center', padding: '15px' }}>
                  <p style={{ fontWeight: '600', marginBottom: '10px' }}>
                    Finalistas: <strong>{clasificadosFinal[0].nombre}</strong> vs <strong>{clasificadosFinal[1].nombre}</strong>
                  </p>
                  <button
                    onClick={() => setupFinal(clasificadosFinal)}
                    style={styles.btnAssign}
                  >
                    🏆 Armar Gran Final
                  </button>
                </div>
              )}

              {/* El partido existe pero aún no tiene parejas asignadas (fallback manual) */}
              {partidoFinal && (!partidoFinal.pareja1_id || !partidoFinal.pareja2_id) && clasificadosFinal.length >= 2 && (
                <div style={{ textAlign: 'center', padding: '15px' }}>
                  <p style={{ fontWeight: '600' }}>Finalistas: {clasificadosFinal[0].nombre} y {clasificadosFinal[1].nombre}</p>
                  <button
                    onClick={() => accionPartido({ id: partidoFinal.id, pareja1_id: clasificadosFinal[0].id, pareja2_id: clasificadosFinal[1].id })}
                    style={styles.btnAssign}
                  >
                    Fijar Rivales en la Final
                  </button>
                </div>
              )}

              {/* Tarjeta de partido */}
              {partidoFinal && partidoFinal.pareja1_id && partidoFinal.pareja2_id && (
                <>
                  <div style={styles.matchesGrid}>
                    {renderMatchCard(partidoFinal, clasificadosFinal, `Partido por el Campeonato`, false)}
                  </div>

                  {/* Botón reset Gran Final */}
                  <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <button
                      onClick={() => resetearFase('final')}
                      style={styles.btnResetFase}
                    >
                      🗑️ Resetear Gran Final
                    </button>
                  </div>
                </>
              )}

              {/* Podio ganador */}
              {hayGanadorFinal && (
                <div style={{ marginTop: '20px' }}>
                  <PodioGanador />
                </div>
              )}
            </section>
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
  tab: { flex: 1, padding: '10px 5px', textAlign: 'center', border: 'none', background: 'transparent', color: '#4a5568', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', transition: '0.2s', fontSize: '0.78rem' },
  tabActive: { flex: 1, padding: '10px 5px', textAlign: 'center', border: 'none', background: '#fff', color: '#2b6cb0', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', fontSize: '0.78rem' },

  // ── Sub-pestañas ──
  subTabsContainer: { display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '2px' },
  subTabBase: { flex: '1 1 0', minWidth: '80px', padding: '9px 12px', textAlign: 'center', border: '1.5px solid #e2e8f0', background: '#fff', color: '#718096', fontWeight: '600', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap', transition: 'all 0.15s' },
  subTabActive: { background: '#faf5ff', borderColor: '#6b46c1', color: '#6b46c1', boxShadow: '0 1px 4px rgba(107,70,193,0.15)' },

  headerFlex: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px', borderBottom: '2px solid #edf2f7', paddingBottom: '10px' },
  groupCard: { backgroundColor: '#fff', borderRadius: '12px', padding: '15px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  groupTitle: { margin: '0 0 12px 0', color: '#2d3748', fontSize: '1.2rem', fontWeight: '700' },
  divider: { height: '1px', backgroundColor: '#edf2f7', margin: '16px 0' },
  seccionLabel: { fontSize: '0.8rem', fontWeight: '700', color: '#718096', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px 0' },
  faseInfo: { fontSize: '0.8rem', color: '#718096', margin: '0 0 12px 0' },
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
  matchesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' },
  matchCard: { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', backgroundColor: '#faf5ff' },
  matchCardPlayed: { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', backgroundColor: '#f7fafc', opacity: 0.9 },
  matchTitle: { margin: '0 0 10px 0', fontSize: '0.9rem', color: '#718096' },
  matchTeams: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' },
  teamLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' },
  scoreInput: { width: '50px', padding: '6px', textAlign: 'center', border: '1px solid #cbd5e0', borderRadius: '4px' },
  select: { width: '100%', padding: '8px', marginBottom: '8px', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '0.9rem' },
  btnAssign: { width: '100%', padding: '10px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
  btnWarning: { flex: 1, padding: '8px', backgroundColor: '#fffaf0', color: '#dd6b20', border: '1px solid #fbd38d', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' },
  btnSave: { flex: 2, padding: '8px', backgroundColor: '#6b46c1', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
  btnUpdate: { flex: 1, padding: '8px', backgroundColor: '#edf2f7', color: '#4a5568', border: '1px solid #cbd5e0', borderRadius: '6px', cursor: 'pointer' },
  btnReset: { flex: 1, padding: '8px', backgroundColor: '#fed7d7', color: '#c53030', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  btnSorteo: { padding: '8px 16px', backgroundColor: '#38a169', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' },
  btnResetFase: { padding: '8px 20px', backgroundColor: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem' },
  finalPhaseSection: {},
  lockedPhase: { textAlign: 'center', padding: '20px', backgroundColor: '#edf2f7', borderRadius: '8px', color: '#718096', fontWeight: '500', marginTop: '20px' },

  // ── Cuadro de semifinal ──
  semiBracketCard: { display: 'flex', gap: '12px', backgroundColor: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: '10px', padding: '14px', marginBottom: '16px' },
  semiBracketCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' },
  semiBracketLabel: { fontSize: '0.72rem', fontWeight: '800', color: '#2b6cb0', textTransform: 'uppercase', letterSpacing: '1px' },
  semiBracketRow: { display: 'flex', alignItems: 'center', gap: '6px' },
  semiBracketBadge: { flexShrink: 0, fontSize: '0.65rem', fontWeight: '700', backgroundColor: '#c3dafe', color: '#3730a3', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' },
  semiBracketNombre: { fontSize: '0.82rem', fontWeight: '600', color: '#1a365d' },
  semiBracketVs: { fontSize: '0.7rem', fontWeight: '700', color: '#718096', textAlign: 'center', margin: '1px 0' },
  semiBracketDivisor: { width: '1px', backgroundColor: '#bee3f8', borderRadius: '4px' },

  semiDbWarning: { backgroundColor: '#fffbeb', border: '1px solid #f6e05e', borderRadius: '8px', padding: '12px 14px', color: '#744210', fontSize: '0.85rem', marginBottom: '16px', lineHeight: 1.5 },
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