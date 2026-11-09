"use client";
import { useEffect, useState, useRef } from 'react';

import { C, styles } from './admin-estilos';
import CabeceraAdmin from './CabeceraAdmin';
import EditorReglas from './EditorReglas';

// Formato Ranked 16 parejas (Campeonato Mary): todos los partidos a set único de 21
const PUNTOS_SET = 21;

export default function AdminRanked16({ torneo, torneos }) {
  const [data, setData] = useState({ torneo: null, posiciones: [], partidos: [] });
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('grupos');
  const [subTabGrupos, setSubTabGrupos] = useState(null);
  const [subTabCuartos, setSubTabCuartos] = useState(null);
  const [fotoUrl, setFotoUrl] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const fileInputRef = useRef(null);

  const cargarDatos = async () => {
    try {
      const res = await fetch(`/api/torneo?torneo=${torneo.slug}`);
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
      const res = await fetch(`/api/foto?torneo_id=${torneo.id}`);
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
      body: JSON.stringify({ ...payload, torneo_id: torneo.id })
    });
    cargarDatos();
  };

  const guardarResultado = (id) => {
    const p1 = document.getElementById(`p1-${id}`).value;
    const p2 = document.getElementById(`p2-${id}`).value;
    if (p1 === "" || p2 === "") return alert("Ingresa ambos puntajes.");
    const n1 = parseInt(p1), n2 = parseInt(p2);
    if (n1 < 0 || n2 < 0) return alert("Los puntajes no pueden ser negativos.");
    if (n1 === n2) return alert("No puede haber empate: el set se juega hasta que una pareja gane.");
    if (Math.max(n1, n2) < PUNTOS_SET && !confirm(`El set es a ${PUNTOS_SET} puntos y ninguna pareja llegó a ${PUNTOS_SET}. ¿Guardar igual?`)) return;
    if (!confirmarCambioConSiguienteArmada(id)) return;
    accionPartido({ id, puntos_pareja1: n1, puntos_pareja2: n2 });
  };

  // Nombre de la fase siguiente si ya fue armada (sorteo hecho o partidos creados), o null
  const faseSiguienteArmada = (fase) => {
    if (fase === 'grupos' && data.partidos.some(p => p.fase === 'cuartos' && p.pareja1_id)) return 'Fase 2';
    if (fase === 'cuartos' && data.partidos.some(p => p.fase === 'semifinal')) return 'Semifinal';
    if (fase === 'semifinal' && data.partidos.some(p => p.fase === 'final')) return 'Final';
    return null;
  };

  // Cambiar un resultado puede alterar la clasificación con la que se armó la fase siguiente
  const confirmarCambioConSiguienteArmada = (id) => {
    const partido = data.partidos.find(p => p.id === id);
    const siguiente = partido && faseSiguienteArmada(partido.fase);
    return !siguiente || confirm(
      `La ${siguiente} ya está armada con la clasificación actual. Si este cambio altera quién clasifica, ` +
      `tendrás que anular la ${siguiente} y volver a armarla. ¿Continuar?`
    );
  };

  const anularSorteo = async () => {
    if (!confirm('¿Anular el sorteo de la Fase 2? Se vaciarán las 2 series y se borrarán sus resultados.')) return;
    await accionPartido({ vaciar_fase: 'cuartos' });
  };

  const asignarParejas = (id) => {
    const s1 = document.getElementById(`s1-${id}`).value;
    const s2 = document.getElementById(`s2-${id}`).value;
    if (!s1 || !s2 || s1 === s2) return alert("Selecciona dos parejas distintas.");
    accionPartido({ id, pareja1_id: parseInt(s1), pareja2_id: parseInt(s2) });
  };

const sortearFaseCuartos = async (partidosCuartos, clasificadosFase1) => {
    const partidosVacios = partidosCuartos.filter(p => !p.pareja1_id || !p.pareja2_id);
    if (partidosVacios.length === 0) return alert("Todas las parejas ya están asignadas en las series de la Fase 2.");

    if (clasificadosFase1.length < 8) {
      return alert("Se necesitan las 8 parejas clasificadas de la Fase de Grupos para realizar el sorteo.");
    }

    // ESCENARIO 1: Si todos los partidos están vacíos, creamos el Round Robin matemático perfecto
    if (partidosVacios.length === partidosCuartos.length) {
      const mezclados = [...clasificadosFase1].sort(() => Math.random() - 0.5);
      const grupoA = mezclados.slice(0, 4);
      const grupoB = mezclados.slice(4, 8);

      const idGruposCuartos = [...new Set(partidosCuartos.map(p => p.grupo_id))].sort((a, b) => a - b);
      if (idGruposCuartos.length < 2) return alert("Falta configurar las 2 series de la Fase 2 en la base de datos.");

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
          promesas.push(fetch('/api/partidos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ torneo_id: torneo.id, id: partidosG1[idx].id, pareja1_id: grupoA[cruce.p1Idx].id, pareja2_id: grupoA[cruce.p2Idx].id }) }));
        }
      });

      const partidosG2 = partidosCuartos.filter(p => p.grupo_id === idGrupo2);
      crucesRelativos.forEach((cruce, idx) => {
        if (partidosG2[idx]) {
          promesas.push(fetch('/api/partidos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ torneo_id: torneo.id, id: partidosG2[idx].id, pareja1_id: grupoB[cruce.p1Idx].id, pareja2_id: grupoB[cruce.p2Idx].id }) }));
        }
      });

      await Promise.all(promesas);
    } 
    // Con partidos asignados a medias no se puede sortear sin mezclar parejas de series distintas
    else {
      return alert("Hay partidos de la Fase 2 ya asignados. Usa \"Anular sorteo\" y vuelve a sortear, o completa los que faltan a mano.");
    }
    
    cargarDatos();
  };

  // ── Crea los 2 partidos de semifinal en la BD con las parejas ya asignadas ──
  const setupSemifinal = async (clasificadosCuartos) => {
    if (clasificadosCuartos.length < 4) {
      return alert("Se necesitan las 4 parejas clasificadas de la Fase 2.");
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
            torneo_id: torneo.id,
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
        torneo_id: torneo.id,
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
      body: JSON.stringify({ fase, torneo_id: torneo.id })
    });
    cargarDatos();
  };

  const manejarFoto = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    setSubiendoFoto(true);
    try {
      const formData = new FormData();
      formData.append('imagen', archivo);
      const res = await fetch(`/api/foto?torneo_id=${torneo.id}`, { method: 'POST', body: formData });
      const json = await res.json();
      if (json.ok) setFotoUrl(json.url);
      else alert(json.error || 'Error al subir la foto');
    } catch (err) {
      alert('Error de red al subir la foto');
    } finally {
      setSubiendoFoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const eliminarFoto = async () => {
    await fetch(`/api/foto?torneo_id=${torneo.id}`, { method: 'DELETE' });
    setFotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (cargando) return (
    <div style={styles.loading}>
      <img src="/brand/ranked-mark.png" alt="Ranked" style={{ width: '72px', height: 'auto' }} />
      <span>Cargando torneo…</span>
    </div>
  );

  const partidosFase1 = data.partidos.filter(p => p.fase === 'grupos');
  const partidosCuartos = data.partidos.filter(p => p.fase === 'cuartos');
  const partidosSemifinal = data.partidos.filter(p => p.fase === 'semifinal');
  const partidoFinal = data.partidos.find(p => p.fase === 'final');

  const gruposFase1 = [...new Set(partidosFase1.map(p => p.nombre_grupo))];
  const gruposCuartos = [...new Set(partidosCuartos.map(p => p.nombre_grupo))];

  const fase1Terminada = partidosFase1.length > 0 && partidosFase1.every(p => p.jugado === 1);
  // En cascada: una fase solo cuenta como terminada si la anterior también lo está
  const cuartosTerminado = fase1Terminada && partidosCuartos.length > 0 && partidosCuartos.every(p => p.jugado === 1);
  const semifinalTerminado = cuartosTerminado && partidosSemifinal.length > 0 && partidosSemifinal.every(p => p.jugado === 1);
  const sorteoHecho = partidosCuartos.some(p => p.pareja1_id);

  // Aviso para una fase que quedó armada aunque la anterior ya no está completa (p. ej. tras resetear resultados)
  const avisoFaseHuerfana = (texto, etiquetaBoton, accion) => (
    <div style={styles.avisoHuerfana}>
      <p style={{ margin: 0 }}>⚠️ {texto}</p>
      <button onClick={accion} style={styles.btnResetFase}>{etiquetaBoton}</button>
    </div>
  );

const clasificadosFase1 = gruposFase1.flatMap(g =>
    data.posiciones
      .filter(p => p.nombre_grupo === g)
      .sort((a, b) => {
        if (b.pg !== a.pg) return b.pg - a.pg;
        return b.diferencia_puntos - a.diferencia_puntos;
      })
      .slice(0, 2)
      .map(p => ({ id: p.pareja_id, nombre: p.nombre_pareja }))
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
      // 1. Primero ordenamos por Partidos Ganados (PG) de mayor a menor
      if (b.pg !== a.pg) return b.pg - a.pg;
      // 2. Si empatan en PG, desempatamos por Diferencia de Puntos
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
              <th style={styles.thPos} title="Puntos a Favor">PF</th>
              <th style={styles.thPos} title="Puntos en Contra">PC</th>
              <th style={styles.thPos}>Dif</th>
            </tr>
          </thead>
          <tbody>
            {posicionesGrupo.map((pos, idx) => {
              const clasifica = hayPartidosJugados && idx < limiteClasificacion;
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
                  <td style={styles.tdPosNombre}>
                    {pos.nombre_pareja}
                    {pos.cabeza_serie === 1 && <span style={styles.estrella} title="Cabeza de serie">★</span>}
                  </td>
                  <td style={styles.tdPos}>{pj}</td>
                  <td style={styles.tdPos}>{pos.pg}</td>
                  {/* Nuevas columnas de acumulados */}
                  <td style={styles.tdPos}>{pos.puntos_favor ?? 0}</td>
                  <td style={styles.tdPos}>{pos.puntos_contra ?? 0}</td>
                  <td style={{ ...styles.tdPos, fontWeight: '700', color: pos.diferencia_puntos > 0 ? C.lima : pos.diferencia_puntos < 0 ? C.rojo : C.suave }}>
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
    // Detectamos si es una fase de eliminación directa o un formato de grupos (Round Robin)
    const esEliminacion = partido.fase === 'semifinal' || partido.fase === 'final';
    const idsAsignados = data.partidos.filter(p => p.fase === partido.fase).flatMap(p => [p.pareja1_id, p.pareja2_id]).filter(id => id !== null);
    
    // En Grupos/Cuartos una pareja juega varias veces, por lo que NO debemos ocultarlas de la lista
    const opcionesLibres = esEliminacion 
      ? opcionesParejas.filter(pareja => !idsAsignados.includes(pareja.id))
      : opcionesParejas;

    if (!partido.pareja1_id || !partido.pareja2_id) {
      return (
        <div key={partido.id} style={styles.matchCard}>
          <h4 style={styles.matchTitle}>{tituloPartido}</h4>
          {esFaseGrupos ? (
            <p style={{ fontSize: '0.85rem', color: C.tenue, fontStyle: 'italic', margin: 0 }}>Esperando asignación...</p>
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
          {/* Los inputs no son controlados: el key incluye el resultado guardado para que se regeneren
              cuando llega un cambio desde otro dispositivo y no queden mostrando valores viejos */}
          <div style={{ ...styles.teamLine, backgroundColor: p1Gana ? C.limaFondo : 'transparent' }}>
            <span style={{ fontWeight: p1Gana ? '700' : '500', color: p1Gana ? C.lima : C.texto }}>{partido.nombre_pareja1}</span>
            <input key={`p1-${partido.id}-${partido.jugado}-${partido.puntos_pareja1}`} type="number" inputMode="numeric" min="0" aria-label={`Puntos ${partido.nombre_pareja1}`} id={`p1-${partido.id}`} defaultValue={partido.jugado ? partido.puntos_pareja1 : ''} style={{ ...styles.scoreInput, borderColor: p1Gana ? C.lima : C.borde }} />
          </div>
          <div style={{ ...styles.teamLine, backgroundColor: p2Gana ? C.limaFondo : 'transparent' }}>
            <span style={{ fontWeight: p2Gana ? '700' : '500', color: p2Gana ? C.lima : C.texto }}>{partido.nombre_pareja2}</span>
            <input key={`p2-${partido.id}-${partido.jugado}-${partido.puntos_pareja2}`} type="number" inputMode="numeric" min="0" aria-label={`Puntos ${partido.nombre_pareja2}`} id={`p2-${partido.id}`} defaultValue={partido.jugado ? partido.puntos_pareja2 : ''} style={{ ...styles.scoreInput, borderColor: p2Gana ? C.lima : C.borde }} />
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
            <button onClick={() => confirmarCambioConSiguienteArmada(partido.id) && accionPartido({ id: partido.id, reset: true })} style={styles.btnReset}>Reset</button>
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
  const SubTabs = ({ grupos, grupoActivo, onSelect, colorActivo = C.lima }) => (
    <div className="tabs-scroll" style={styles.subTabsContainer}>
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
      <CabeceraAdmin torneo={data.torneo || torneo} torneos={torneos} />

      <nav className="tabs-scroll" style={styles.tabsContainer}>
        {[
          ['grupos', 'Fase 1'],
          ['tabla', 'Tabla'],
          ['cuartos_fase', 'Fase 2'],
          ['semifinal', 'Semifinal'],
          ['gran_final', 'Final'],
          ['reglas', 'Reglas'],
        ].map(([id, etiqueta]) => (
          <button key={id} onClick={() => setTab(id)} style={tab === id ? styles.tabActive : styles.tab}>{etiqueta}</button>
        ))}
      </nav>

      {/* ── FASE 1: GRUPOS con sub-pestañas ── */}
      {tab === 'grupos' && gruposFase1.length > 0 && (
        <>
          <SubTabs
            grupos={gruposFase1}
            grupoActivo={grupoActivoFase1}
            onSelect={setSubTabGrupos}
          />
          {(() => {
            const partidosDelGrupo = partidosFase1.filter(p => p.nombre_grupo === grupoActivoFase1);
            
            // Lógica para ordenar los 6 partidos y dar descanso a los jugadores (Round Robin Óptimo)
            // BD original: 0(AB), 1(AC), 2(AD), 3(BC), 4(BD), 5(CD)
            // Nuevo Orden: 0(AB), 5(CD), 1(AC), 4(BD), 2(AD), 3(BC)
            const ordenIdeal = [0, 5, 1, 4, 2, 3];
            const partidosOrdenados = partidosDelGrupo.length === 6
              ? ordenIdeal.map(idx => partidosDelGrupo[idx]).filter(Boolean)
              : partidosDelGrupo; // Fallback por si algún grupo tiene menos de 6 partidos

            return (
              <section style={styles.groupCard}>
                <h2 style={styles.groupTitle}>{grupoActivoFase1}</h2>
                <TablaPosicionesGrupo nombreGrupo={grupoActivoFase1} limiteClasificacion={2} />
                <div style={styles.divider} />
                <p style={styles.seccionLabel}>Partidos</p>
                <div style={styles.matchesGrid}>
                  {partidosOrdenados.map((p, i) => renderMatchCard(p, [], `Partido ${i + 1}`, true))}
                </div>
              </section>
            );
          })()}
        </>
      )}

      {/* ── TABLA GENERAL ── */}
      {tab === 'tabla' && (
        <section style={styles.groupCard}>
          <h2 style={{ ...styles.groupTitle, textAlign: 'center' }}>Tabla General · Fase 1</h2>
          <p style={{ ...styles.faseInfo, textAlign: 'center', marginBottom: '15px' }}>Ordenado por partidos ganados y diferencia de puntos</p>
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
                {tablaGeneral.map((pos, idx) => {
                  // 1. Verificamos si en el grupo de esta pareja ya se jugó al menos un partido
                  const grupoIniciado = partidosFase1.some(p => p.nombre_grupo === pos.nombre_grupo && p.jugado === 1);
                  
                  // 2. Solo pintamos de verde si el grupo ya empezó a jugarse Y la pareja está en el Top 2
                  const esClasificado = grupoIniciado && clasificadosFase1.some(c => c.id === pos.pareja_id);

                  return (
                    <tr key={pos.pareja_id} style={esClasificado ? styles.rowQualified : styles.rowStandard}>
                      <td style={styles.tdCenter}><strong>{idx + 1}</strong></td>
                      <td style={styles.tdMain}>
                        {pos.nombre_pareja}
                        {pos.cabeza_serie === 1 && <span style={styles.estrella} title="Cabeza de serie">★</span>}
                      </td>
                      <td style={styles.tdCenter}><span style={styles.badgeGrupo}>{pos.nombre_grupo.replace('GRUPO ', '')}</span></td>
                      <td style={styles.tdCenter}>{pos.pg}</td>
                      <td style={styles.tdBold}>{pos.diferencia_puntos}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── FASE 2: CUARTOS con sub-pestañas ── */}
      {tab === 'cuartos_fase' && (
        <div style={styles.finalPhaseSection}>
          {!fase1Terminada ? (
            <>
              <div style={styles.lockedPhase}>🔒 Completa todos los partidos de la Fase 1 para habilitar el sorteo de la Fase 2.</div>
              {sorteoHecho && avisoFaseHuerfana(
                'Hay un sorteo de la Fase 2 hecho con una clasificación anterior, pero la Fase 1 ya no está completa. No es válido: anúlalo y vuelve a sortear al terminar la Fase 1.',
                'Anular sorteo de la Fase 2',
                anularSorteo,
              )}
            </>
          ) : (
            <>
              <div style={styles.sorteoCard}>
                <div>
                  <h3 style={styles.sorteoTitulo}>Sorteo de la Fase 2</h3>
                  <p style={styles.sorteoTexto}>Reparte al azar las 8 parejas clasificadas en 2 series de 4. Todos contra todos; pasan los 2 mejores de cada serie.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {sorteoHecho && <button onClick={anularSorteo} style={styles.btnResetFase}>Anular sorteo</button>}
                  <button onClick={() => sortearFaseCuartos(partidosCuartos, clasificadosFase1)} style={styles.btnSorteo}>🎲 Sortear</button>
                </div>
              </div>

              {gruposCuartos.length > 0 && (
                <>
                  <SubTabs
                    grupos={gruposCuartos}
                    grupoActivo={grupoActivoCuartos}
                    onSelect={setSubTabCuartos}
                  />
                  {(() => {
                    const partidosDelGrupo = partidosCuartos.filter(p => p.nombre_grupo === grupoActivoCuartos);
                    return (
                      <section style={styles.groupCard}>
                        <h2 style={styles.groupTitle}>{grupoActivoCuartos}</h2>
                        <TablaPosicionesGrupo nombreGrupo={grupoActivoCuartos} limiteClasificacion={2} />
                        <div style={styles.divider} />
                        <p style={styles.seccionLabel}>Partidos de la serie</p>
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
            <>
              <div style={styles.lockedPhase}>🔒 Completa todos los partidos de la Fase 2 para habilitar la Semifinal.</div>
              {partidosSemifinal.length > 0 && avisoFaseHuerfana(
                'Hay partidos de Semifinal armados con una clasificación anterior, pero la Fase 2 ya no está completa. Resetéalos y vuelve a armar la Semifinal al terminar la Fase 2.',
                'Resetear Semifinal',
                () => resetearFase('semifinal'),
              )}
            </>
          ) : (
            <section style={{ ...styles.groupCard, borderColor: C.limaBorde }}>
              <h2 style={{ ...styles.groupTitle, textAlign: 'center', marginBottom: '4px' }}>
                Semifinal
              </h2>
              <p style={{ ...styles.faseInfo, textAlign: 'center' }}>1° de una serie contra el 2° de la otra · Set único a {PUNTOS_SET}</p>

              {/* Cuadro de clasificados */}
              {clasificadosCuartos.length >= 4 && (
                <div style={styles.semiBracketCard}>
                  <div style={styles.semiBracketCol}>
                    <span style={styles.semiBracketLabel}>Semifinal 1</span>
                    <div style={styles.semiBracketRow}>
                      <span style={styles.semiBracketBadge}>1° {gruposCuartos[0] || 'Serie 1'}</span>
                      <span style={styles.semiBracketNombre}>{clasificadosCuartos[0].nombre}</span>
                    </div>
                    <div style={styles.semiBracketVs}>vs</div>
                    <div style={styles.semiBracketRow}>
                      <span style={styles.semiBracketBadge2}>
                        2° {gruposCuartos[1] || 'Serie 2'}
                      </span>
                      <span style={styles.semiBracketNombre}>{clasificadosCuartos[3].nombre}</span>
                    </div>
                  </div>
                  <div style={styles.semiBracketDivisor} />
                  <div style={styles.semiBracketCol}>
                    <span style={styles.semiBracketLabel}>Semifinal 2</span>
                    <div style={styles.semiBracketRow}>
                      <span style={styles.semiBracketBadge}>1° {gruposCuartos[1] || 'Serie 2'}</span>
                      <span style={styles.semiBracketNombre}>{clasificadosCuartos[2].nombre}</span>
                    </div>
                    <div style={styles.semiBracketVs}>vs</div>
                    <div style={styles.semiBracketRow}>
                      <span style={styles.semiBracketBadge2}>
                        2° {gruposCuartos[0] || 'Serie 1'}
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
            <>
              <div style={styles.lockedPhase}>🔒 Completa los partidos de Semifinal para habilitar la Gran Final.</div>
              {partidoFinal && avisoFaseHuerfana(
                'Hay una Final armada con resultados anteriores, pero la Semifinal ya no está completa. Resetéala y vuelve a armarla al terminar la Semifinal.',
                'Resetear Gran Final',
                () => resetearFase('final'),
              )}
            </>
          ) : (
            <section style={{ ...styles.groupCard, border: `2px solid ${C.oro}`, overflow: 'hidden' }}>
              <h2 style={{ ...styles.groupTitle, color: C.oro, textAlign: 'center', marginBottom: '4px' }}>
                🏆 La Gran Final
              </h2>
              <p style={{ ...styles.faseInfo, textAlign: 'center' }}>Ganadores de Semifinal 1 vs Semifinal 2 · Set único a {PUNTOS_SET} puntos</p>

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

      {/* ── REGLAS ── */}
      {tab === 'reglas' && (
        <section style={styles.groupCard}>
          <h2 style={styles.groupTitle}>Formato y reglas</h2>
          <ol style={styles.reglasLista}>
            {[
              ['Fase 1 · Grupos', '4 grupos de 4 parejas, con una cabeza de serie (★) por grupo. Todos contra todos. Clasifican las 2 mejores de cada grupo: 8 parejas.'],
              ['Fase 2 · Series', 'Las 8 clasificadas se sortean al azar en 2 series de 4. Todos contra todos. Clasifican las 2 mejores de cada serie.'],
              ['Semifinal', '1° de la Serie 1 vs 2° de la Serie 2, y 1° de la Serie 2 vs 2° de la Serie 1.'],
              ['Final', 'Los ganadores de cada semifinal juegan por el campeonato.'],
            ].map(([titulo, texto]) => (
              <li key={titulo} style={styles.reglaItem}>
                <strong style={styles.reglaTitulo}>{titulo}</strong>
                <span>{texto}</span>
              </li>
            ))}
          </ol>
          <div style={styles.divider} />
          <p style={styles.seccionLabel}>Puntuación y desempate</p>
          <ul style={styles.reglasPuntos}>
            <li>Todos los partidos se juegan a <strong style={{ color: C.lima }}>1 set de {PUNTOS_SET} puntos</strong>.</li>
            <li>En grupos y series se ordena por <strong>partidos ganados (PG)</strong>.</li>
            <li>Si hay empate en PG, decide la <strong>diferencia de puntos (Dif)</strong>: puntos a favor menos puntos en contra.</li>
          </ul>
        </section>
      )}
      {tab === 'reglas' && <EditorReglas torneo={data.torneo || torneo} />}

      <footer style={styles.footer}>
        <span>Powered by <a href="https://geeky-tech.es" target="_blank" rel="noopener" style={styles.footerLink}>Geeky Tech</a></span>
      </footer>
    </div>
  );
}
