"use client";
// Reglas de puntuación del torneo, por fase: al mejor de cuántos sets, a cuántos puntos y cómo se cierra el set
// (seco: gana el primero que llega · con ventaja de 2, con tope opcional). Las ve el árbitro y el público al instante.
import { useState } from 'react';
import { C, styles, boton, titulo } from './admin-estilos';
import { FORMATOS, ETIQUETAS_FASE, reglasFase, reglasDeTorneo, textoReglas } from '../lib/formatos';

const json = { 'Content-Type': 'application/json' };

// Si las reglas cambian (incluso al guardar aquí: vuelven por la transmisión), el formulario se rearma con
// las vigentes; el mensaje de confirmación vive fuera para sobrevivir a ese rearme.
export default function EditorReglas({ torneo }) {
  const [mensaje, setMensaje] = useState(null);
  return (
    <section style={styles.groupCard} data-testid="editor-reglas">
      <h2 style={styles.groupTitle}>Reglas de puntuación</h2>
      <p style={styles.faseInfo}>
        Por cada fase: cuántos sets, a cuántos puntos y cómo se cierra el set. Rige al instante para el árbitro y el público; los resultados ya guardados no cambian.
      </p>
      <Formulario key={JSON.stringify(torneo.reglas ?? null)} torneo={torneo} onMensaje={setMensaje} />
      {mensaje && (
        <p role="status" data-testid="reglas-mensaje" style={{ ...styles.faseInfo, margin: '12px 0 0', color: mensaje.tipo === 'ok' ? C.lima : C.rojo, fontWeight: 600 }}>{mensaje.texto}</p>
      )}
    </section>
  );
}

function Formulario({ torneo, onMensaje: setMensaje }) {
  const fases = Object.keys(FORMATOS[torneo.formato]?.fases || {});
  const [form, setForm] = useState(() => Object.fromEntries(fases.map(f => {
    const r = reglasFase(torneo, f);
    return [f, { mejorDe: String(r.mejorDe), puntosSet: String(r.puntosSet), ventaja: String(r.ventaja), maximo: r.maximo ? String(r.maximo) : '' }];
  })));
  const [guardando, setGuardando] = useState(false);
  const personalizadas = Object.keys(reglasDeTorneo(torneo)).length > 0;

  const poner = (fase, campo, valor) => setForm(prev => ({ ...prev, [fase]: { ...prev[fase], [campo]: valor } }));
  const vista = (fase) => {
    const f = form[fase];
    return { mejorDe: Number(f.mejorDe), puntosSet: Number(f.puntosSet) || 0, ventaja: Number(f.ventaja), maximo: f.ventaja === '2' && f.maximo !== '' ? Number(f.maximo) : null };
  };

  const enviar = async (reglas) => {
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch('/api/torneo/reglas', { method: 'PUT', headers: json, body: JSON.stringify({ torneo_id: torneo.id, reglas }) });
      const r = await res.json().catch(() => ({}));
      if (res.status === 401) { window.location.assign(`/t/${torneo.slug}/login?rol=admin`); return; }
      setMensaje(res.ok
        ? { tipo: 'ok', texto: reglas ? 'Reglas guardadas. El árbitro y el público ya las ven.' : 'Se restauraron las reglas del formato.' }
        : { tipo: 'error', texto: r.error || 'No se pudieron guardar las reglas' });
    } finally {
      setGuardando(false);
    }
  };
  const guardar = () => enviar(Object.fromEntries(fases.map(f => [f, { ...form[f], maximo: form[f].maximo === '' ? null : form[f].maximo }])));
  const restaurar = () => confirm('¿Volver a las reglas del formato para todas las fases?') && enviar(null);

  const campo = { ...styles.select, width: '72px', marginBottom: 0, padding: '7px', textAlign: 'center', fontWeight: 700 };
  const etiqueta = { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: C.texto };
  const opcion = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: C.texto, cursor: 'pointer' };

  return (
    <>
      <div style={{ display: 'grid', gap: '12px' }}>
        {fases.map(fase => {
          const f = form[fase];
          const v = vista(fase);
          return (
            <div key={fase} style={{ ...styles.matchCard, display: 'grid', gap: '10px' }} data-testid={`regla-${fase}`}>
              <strong style={{ ...titulo, color: C.lima, fontSize: '1.05rem' }}>{ETIQUETAS_FASE[fase] || fase}</strong>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <label style={etiqueta}>
                  Al mejor de
                  <select value={f.mejorDe} onChange={e => poner(fase, 'mejorDe', e.target.value)} style={campo} data-testid={`regla-${fase}-mejorDe`}>
                    {[1, 3, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  {f.mejorDe === '1' ? 'set' : 'sets'}
                </label>
                <label style={etiqueta}>
                  Set a
                  <input type="number" inputMode="numeric" min="5" max="50" value={f.puntosSet} onChange={e => poner(fase, 'puntosSet', e.target.value)} style={campo} data-testid={`regla-${fase}-puntosSet`} />
                  puntos
                </label>
              </div>
              <div style={{ display: 'grid', gap: '8px' }} role="radiogroup" aria-label={`Cierre del set · ${ETIQUETAS_FASE[fase] || fase}`}>
                <label style={opcion}>
                  <input type="radio" name={`ventaja-${fase}`} value="1" checked={f.ventaja === '1'} onChange={() => poner(fase, 'ventaja', '1')} data-testid={`regla-${fase}-seco`} />
                  <span><strong>Seco:</strong> gana el primero que llega a {v.puntosSet || '…'} (a {Math.max(0, v.puntosSet - 1)} iguales, el siguiente punto decide).</span>
                </label>
                <label style={opcion}>
                  <input type="radio" name={`ventaja-${fase}`} value="2" checked={f.ventaja === '2'} onChange={() => poner(fase, 'ventaja', '2')} data-testid={`regla-${fase}-ventaja`} />
                  <span><strong>Con ventaja:</strong> desde {v.puntosSet || '…'} hay que ganar por 2 puntos de diferencia.</span>
                </label>
                {f.ventaja === '2' && (
                  <label style={{ ...etiqueta, marginLeft: '26px', flexWrap: 'wrap' }}>
                    Tope
                    <input type="number" inputMode="numeric" min={v.puntosSet + 1} max="99" placeholder="sin tope" value={f.maximo} onChange={e => poner(fase, 'maximo', e.target.value)} style={campo} data-testid={`regla-${fase}-maximo`} />
                    <span style={{ color: C.suave, fontSize: '0.8rem' }}>el primero que llega al tope gana el set (vacío = sin tope)</span>
                  </label>
                )}
              </div>
              <p style={{ ...styles.faseInfo, margin: 0 }}>
                Así se juega: <span style={{ color: C.texto, fontWeight: 600 }} data-testid={`regla-${fase}-resumen`}>{textoReglas(v)}</span>
              </p>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
        <button onClick={guardar} disabled={guardando} style={{ ...styles.btnAssign, marginTop: 0, flex: 2, width: 'auto' }} data-testid="reglas-guardar">
          {guardando ? 'Guardando…' : 'Guardar reglas'}
        </button>
        {personalizadas && (
          <button onClick={restaurar} disabled={guardando} style={{ ...boton, flex: 1, padding: '11px', background: 'transparent', color: C.suave, border: `1px solid ${C.borde}` }} data-testid="reglas-restaurar">
            Volver a las del formato
          </button>
        )}
      </div>
    </>
  );
}
