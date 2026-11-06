"use client";
import { C, styles } from './admin-estilos';

// Ranked es la marca de la plataforma; el organizador de cada torneo se muestra como "Organiza".
// `torneos` solo llega cuando la sesión es de super admin (puede saltar entre torneos).
export default function CabeceraAdmin({ torneo, torneos = [] }) {
  const opciones = torneos.some(t => t.id === torneo.id) ? torneos : [torneo, ...torneos];
  const base = `/t/${encodeURIComponent(torneo.slug)}`;

  const salir = async () => {
    await fetch('/api/auth', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ torneo_id: torneo.id }) });
    window.location.href = `${base}/login?rol=admin`;
  };

  return (
    <header style={styles.header}>
      <img src="/brand/ranked-wordmark.png" alt="Ranked" style={styles.logo} />
      <div style={styles.headerTexto}>
        <h1 style={styles.title}>{torneo.nombre || 'Torneo de Frontón'}</h1>
        {torneo.subtitulo && <p style={styles.subtitle}>{torneo.subtitulo}</p>}
        {torneo.organizador && <Organizador nombre={torneo.organizador} />}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
        {torneos.length > 0 && opciones.length > 1 && (
          <select
            aria-label="Cambiar de torneo"
            value={torneo.slug}
            onChange={e => { window.location.href = `/t/${encodeURIComponent(e.target.value)}/admin`; }}
            style={selector}
          >
            {opciones.map(t => <option key={t.id} value={t.slug}>{t.nombre}{t.subtitulo ? ` · ${t.subtitulo}` : ''}{t.es_prueba ? ' (prueba)' : ''}</option>)}
          </select>
        )}
        <a href={base} target="_blank" rel="noopener" style={styles.linkPublico}>● Vista pública</a>
        <a href={`${base}/arbitro`} target="_blank" rel="noopener" style={styles.linkPublico}>Árbitro</a>
        {torneos.length > 0 && <a href="/superadmin" style={styles.linkPublico}>Super admin</a>}
        <button onClick={salir} style={{ ...styles.linkPublico, background: 'transparent', color: C.suave, borderColor: C.borde, cursor: 'pointer', fontFamily: 'inherit' }}>Salir</button>
      </div>
    </header>
  );
}

// Sello del organizador: el wordmark de Front On (cursiva, verde) sin depender de su archivo de logo
export function Organizador({ nombre, compacto = false }) {
  const esFrontOn = /front\s*on/i.test(nombre);
  return (
    <p style={{ margin: compacto ? 0 : '8px 0 0', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: C.suave }}>
      Organiza
      <span style={esFrontOn ? frontOn : { color: C.texto, fontWeight: 700 }}>{esFrontOn ? 'FRONT ON' : nombre}</span>
    </p>
  );
}

const frontOn = {
  fontFamily: 'var(--font-titulo), system-ui, sans-serif',
  fontStyle: 'italic',
  fontWeight: 800,
  fontSize: '1.05rem',
  letterSpacing: '0.5px',
  color: '#FFFFFF',
  backgroundColor: '#1D7A2E',
  padding: '1px 9px 2px',
  borderRadius: '6px',
  boxShadow: 'inset 0 -3px 0 #46D33F',
};

const selector = {
  padding: '6px 10px',
  borderRadius: '999px',
  border: `1px solid ${C.borde}`,
  backgroundColor: C.card,
  color: C.texto,
  fontSize: '0.8rem',
  fontFamily: 'inherit',
  maxWidth: '100%',
};
