"use client";
// Banco de pruebas: crea torneos Relámpago de prueba, simula resultados y muestra la vista en vivo al lado
import { useEffect, useState } from 'react';
import { C, styles, boton, titulo } from '../../componentes/admin-estilos';

const ACCIONES = [
  { accion: 'simular_ronda', etiqueta: '▶ Simular siguiente ronda', ayuda: 'Resultados al azar para los 2 partidos de la ronda pendiente.' },
  { accion: 'simular_liga', etiqueta: '⏭ Simular toda la liga', ayuda: 'Completa al azar los partidos pendientes del todos contra todos.' },
  { accion: 'escenario_desempate', etiqueta: '⚖ Escenario: desempates', ayuda: 'Triple empate a 4 pts: A gana por diferencia de sets; C supera a B por diferencia de puntos. Esperado: A, C, B, D.' },
  { accion: 'escenario_empate_total', etiqueta: '⚠ Escenario: empate total', ayuda: 'A, B y C iguales en todo: la tabla avisa y la final se elige a mano.' },
  { accion: 'armar_final', etiqueta: '🏆 Armar final', ayuda: 'Crea la final con el 1° y el 2° de la tabla.' },
  { accion: 'simular_final', etiqueta: '🎲 Simular final', ayuda: 'Resultado al azar al mejor de 3 sets a 21.' },
  { accion: 'reiniciar', etiqueta: '↺ Borrar resultados', ayuda: 'Deja la liga sin jugar y borra la final.', peligro: true },
];

export default function Playground() {
  const [torneos, setTorneos] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = async (seleccionarId) => {
    const lista = await (await fetch('/api/playground', { cache: 'no-store' })).json();
    setTorneos(Array.isArray(lista) ? lista : []);
    setSeleccionado(prev => lista.find(t => t.id === (seleccionarId ?? prev?.id)) || lista[0] || null);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, []);

  const ejecutar = async (accion, torneoId = seleccionado?.id) => {
    setOcupado(true);
    setMensaje(null);
    try {
      const res = await fetch('/api/playground', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, torneo_id: torneoId }) });
      const r = await res.json();
      setMensaje(res.ok ? { ok: true, texto: r.mensaje || `Torneo creado: ${r.slug}` } : { ok: false, texto: r.error });
      await cargar(accion === 'crear' ? r.id : undefined);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div style={{ ...styles.container, maxWidth: '1280px' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h1 style={{ ...styles.title, fontSize: '1.6rem' }}>Playground</h1>
          <p style={{ ...styles.faseInfo, margin: '4px 0 0' }}>Torneos de prueba aislados (no aparecen en el selector ni afectan a torneos reales). BD: staging. Claves de prueba: admin 1111 · árbitro 2222.</p>
        </div>
        <button onClick={() => ejecutar('crear')} disabled={ocupado} style={{ ...boton, padding: '10px 16px', backgroundColor: C.lima, color: C.navy }} data-testid="pg-crear">
          + Nuevo torneo Relámpago de prueba
        </button>
      </header>

      {mensaje && (
        <p role="status" data-testid="pg-mensaje" style={{ margin: '0 0 16px', padding: '10px 14px', borderRadius: '10px', fontSize: '0.9rem',
          color: mensaje.ok ? C.lima : C.rojo, backgroundColor: mensaje.ok ? C.limaFondo : C.rojoFondo }}>
          {mensaje.texto}
        </p>
      )}

      {torneos.length === 0 ? (
        <div style={styles.lockedPhase}>No hay torneos de prueba. Crea uno para empezar.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
          <section style={{ ...styles.groupCard, flex: '1 1 300px', maxWidth: '100%' }}>
            <label style={styles.seccionLabel} htmlFor="pg-torneo">Torneo de prueba</label>
            <select id="pg-torneo" value={seleccionado?.id || ''} onChange={e => setSeleccionado(torneos.find(t => t.id === Number(e.target.value)))} style={styles.select}>
              {torneos.map(t => <option key={t.id} value={t.id}>{t.nombre} · {t.slug}</option>)}
            </select>
            {seleccionado && (
              <>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '4px 0 16px' }}>
                  <a href={`/t/${seleccionado.slug}/admin`} target="_blank" rel="noopener" style={styles.linkPublico}>Abrir panel ↗</a>
                  <a href={`/t/${seleccionado.slug}`} target="_blank" rel="noopener" style={styles.linkPublico}>Abrir en vivo ↗</a>
                  <a href={`/t/${seleccionado.slug}/arbitro`} target="_blank" rel="noopener" style={styles.linkPublico}>Abrir árbitro ↗</a>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {ACCIONES.map(a => (
                    <div key={a.accion}>
                      <button onClick={() => ejecutar(a.accion)} disabled={ocupado} data-testid={`pg-${a.accion}`}
                        style={{ ...boton, width: '100%', padding: '10px', textAlign: 'left', backgroundColor: a.peligro ? C.rojoFondo : C.card2,
                          color: a.peligro ? C.rojo : C.texto, border: `1px solid ${a.peligro ? C.rojo : C.borde}` }}>
                        {a.etiqueta}
                      </button>
                      <p style={{ margin: '4px 2px 0', fontSize: '0.75rem', color: C.tenue }}>{a.ayuda}</p>
                    </div>
                  ))}
                  <button onClick={() => confirm('¿Eliminar este torneo de prueba?') && ejecutar('eliminar')} disabled={ocupado}
                    style={{ ...boton, marginTop: '8px', padding: '8px', backgroundColor: 'transparent', color: C.tenue, border: `1px dashed ${C.borde}` }}>
                    Eliminar torneo de prueba
                  </button>
                </div>
              </>
            )}
          </section>

          {seleccionado && (
            <section style={{ ...styles.groupCard, padding: 0, overflow: 'hidden', flex: '3 1 560px', minWidth: 0 }}>
              <p style={{ ...titulo, margin: 0, padding: '10px 14px', fontSize: '0.9rem', color: C.suave, borderBottom: `1px solid ${C.borde}` }}>Vista pública en vivo</p>
              {/* El key fuerza a recargar al cambiar de torneo; la vista se actualiza sola por SSE */}
              <iframe key={seleccionado.slug} src={`/t/${seleccionado.slug}`} title="Vista en vivo"
                style={{ width: '100%', height: '78vh', border: 0, display: 'block', background: C.navy }} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
