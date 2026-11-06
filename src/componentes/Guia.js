"use client";
// Guía paso a paso + manual de uso para los roles con funciones (super admin, admin, árbitro).
// La guía se abre sola la primera vez en cada dispositivo; el botón "?" la repite o abre el manual.
import { useCallback, useEffect, useState } from 'react';
import { GUIAS } from './guias-contenido';

const C = { navy: '#0B0F1E', card: '#131A2E', borde: '#252F4A', texto: '#F6F6F6', suave: '#A3ABC2', lima: '#ADF238' };
const clave = id => `ranked_guia_${id}_v1`;

function leerVista(id) {
  try { return localStorage.getItem(clave(id)) === '1'; } catch { return true; } // sin almacenamiento: no insistir
}
function marcarVista(id) {
  try { localStorage.setItem(clave(id), '1'); } catch { /* modo privado */ }
}

export default function Guia({ id }) {
  const guia = GUIAS[id];
  const [paso, setPaso] = useState(null); // null = cerrada
  const [menu, setMenu] = useState(false);
  const [manual, setManual] = useState(false);
  const [rect, setRect] = useState(null);

  // Primera vez: abrir sola (tras un instante, para que la pantalla termine de pintarse)
  useEffect(() => {
    if (!guia || leerVista(id)) return;
    const t = setTimeout(() => setPaso(0), 700);
    return () => clearTimeout(t);
  }, [id, guia]);

  const actual = paso !== null ? guia.pasos[paso] : null;

  // Ubicar el elemento del paso: llevarlo a la vista y seguir su posición
  const medir = useCallback(() => {
    const el = actual?.selector ? document.querySelector(actual.selector) : null;
    setRect(el ? el.getBoundingClientRect() : null);
  }, [actual]);

  useEffect(() => {
    if (!actual) return;
    const el = actual.selector ? document.querySelector(actual.selector) : null;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(medir, 350);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => { clearTimeout(t); window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true); };
  }, [actual, medir]);

  if (!guia) return null;

  const cerrar = () => { marcarVista(id); setPaso(null); };
  const siguiente = () => (paso + 1 < guia.pasos.length ? setPaso(paso + 1) : cerrar());

  // La tarjeta va abajo, salvo que el elemento resaltado esté en la mitad inferior de la pantalla
  const tarjetaArriba = rect && rect.top + rect.height / 2 > window.innerHeight / 2;
  const margen = 6;

  return (
    <>
      <button
        onClick={() => setMenu(m => !m)}
        aria-label="Ayuda: guía paso a paso y manual de uso"
        aria-expanded={menu}
        data-testid="guia-boton"
        style={{
          position: 'fixed', right: 14, bottom: 'calc(14px + env(safe-area-inset-bottom))', zIndex: 900,
          width: 48, height: 48, borderRadius: '50%', border: `2px solid ${C.lima}`, background: C.navy, color: C.lima,
          fontSize: '1.3rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.5)', fontFamily: 'inherit',
          ...(guia.botonArriba ? { bottom: 'auto', right: 'auto', left: 14, top: 'calc(70px + env(safe-area-inset-top))', width: 40, height: 40, fontSize: '1.1rem' } : {}),
        }}
      >?</button>

      {menu && (
        <div role="menu" style={{
          position: 'fixed', right: 14, zIndex: 901, display: 'flex', flexDirection: 'column', gap: 6, padding: 8,
          background: C.card, border: `1px solid ${C.borde}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          ...(guia.botonArriba ? { right: 'auto', left: 14, top: 'calc(116px + env(safe-area-inset-top))' } : { bottom: 'calc(70px + env(safe-area-inset-bottom))' }),
        }}>
          <button role="menuitem" style={opcionMenu} onClick={() => { setMenu(false); setPaso(0); }} data-testid="guia-paso-a-paso">▶ Paso a paso</button>
          <button role="menuitem" style={opcionMenu} onClick={() => { setMenu(false); setManual(true); }} data-testid="guia-manual">📖 Manual de uso</button>
        </div>
      )}

      {actual && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} data-testid="guia-paso">
          {/* Foco: un recuadro transparente con una sombra enorme que oscurece el resto */}
          {rect ? (
            <div style={{
              position: 'fixed', top: rect.top - margen, left: rect.left - margen, width: rect.width + margen * 2, height: rect.height + margen * 2,
              borderRadius: 12, border: `2px solid ${C.lima}`, boxShadow: '0 0 0 9999px rgba(5, 8, 18, 0.72)', transition: 'all 0.25s ease', pointerEvents: 'none',
            }} />
          ) : <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 18, 0.72)' }} />}

          <div role="dialog" aria-modal="true" aria-labelledby="guia-titulo" style={{
            position: 'fixed', left: '50%', transform: 'translateX(-50%)', width: 'min(440px, calc(100vw - 24px))',
            ...(rect ? (tarjetaArriba ? { top: 'calc(12px + env(safe-area-inset-top))' } : { bottom: 'calc(12px + env(safe-area-inset-bottom))' }) : { top: '50%', transform: 'translate(-50%, -50%)' }),
            background: C.card, border: `1px solid ${C.lima}`, borderRadius: 14, padding: 16, color: C.texto, boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
          }}>
            <p style={{ margin: 0, color: C.suave, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              {guia.nombre} · Paso {paso + 1} de {guia.pasos.length}
            </p>
            <h2 id="guia-titulo" style={{ margin: '4px 0 6px', fontFamily: 'var(--font-titulo), sans-serif', fontStyle: 'italic', fontWeight: 800, textTransform: 'uppercase', fontSize: '1.2rem', color: C.lima }}>
              {actual.titulo}
            </h2>
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.45, color: C.texto }}>{actual.texto}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
              <button onClick={cerrar} style={{ ...botonGuia, background: 'transparent', color: C.suave, border: 'none', padding: '10px 4px' }} data-testid="guia-saltar">Saltar guía</button>
              <span style={{ flex: 1 }} />
              {paso > 0 && <button onClick={() => setPaso(paso - 1)} style={{ ...botonGuia, background: 'transparent', color: C.texto }}>Atrás</button>}
              <button onClick={siguiente} style={{ ...botonGuia, background: C.lima, color: C.navy, borderColor: C.lima }} data-testid="guia-siguiente">
                {paso + 1 < guia.pasos.length ? 'Siguiente' : '¡Listo!'}
              </button>
            </div>
          </div>
        </div>
      )}

      {manual && <Manual guia={guia} onCerrar={() => setManual(false)} />}
    </>
  );
}

function Manual({ guia, onCerrar }) {
  useEffect(() => {
    const alTeclear = e => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(5, 8, 18, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }} onClick={onCerrar}>
      <div role="dialog" aria-modal="true" aria-labelledby="manual-titulo" data-testid="guia-manual-contenido" onClick={e => e.stopPropagation()} style={{
        width: 'min(640px, 100vw)', maxHeight: '88dvh', overflowY: 'auto', background: C.card, color: C.texto,
        borderRadius: '18px 18px 0 0', border: `1px solid ${C.borde}`, padding: '18px 18px calc(18px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: -18, background: C.card, padding: '4px 0 10px', marginTop: -4 }}>
          <h2 id="manual-titulo" style={{ flex: 1, margin: 0, fontFamily: 'var(--font-titulo), sans-serif', fontStyle: 'italic', fontWeight: 800, textTransform: 'uppercase', fontSize: '1.3rem' }}>
            Manual · {guia.nombre}
          </h2>
          <button onClick={onCerrar} aria-label="Cerrar manual" style={{ ...botonGuia, padding: '8px 12px' }}>✕</button>
        </div>
        {guia.manual.map(seccion => (
          <section key={seccion.titulo} style={{ marginTop: 14 }}>
            <h3 style={{ margin: '0 0 6px', color: C.lima, fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{seccion.titulo}</h3>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, color: C.suave, fontSize: '0.92rem', lineHeight: 1.45 }}>
              {seccion.items.map((item, i) => <li key={i}>{item}</li>)}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

const botonGuia = { padding: '10px 16px', borderRadius: 10, border: `1px solid ${C.borde}`, fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' };
const opcionMenu = { ...botonGuia, background: C.navy, color: C.texto, textAlign: 'left', whiteSpace: 'nowrap' };
