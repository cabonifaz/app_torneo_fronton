"use client";
import { useState } from 'react';
import { C, styles, boton } from './admin-estilos';
import { Organizador } from './CabeceraAdmin';

const TEXTOS = {
  admin: { titulo: 'Acceso de administración', ayuda: 'Ingresa la clave de admin de este torneo.' },
  arbitro: { titulo: 'Acceso de árbitro', ayuda: 'Ingresa la clave de árbitro de este torneo.' },
  super: { titulo: 'Super admin', ayuda: 'Gestión de todos los torneos.' },
};

export default function Login({ rol, torneo = null, destino }) {
  const [clave, setClave] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol, slug: torneo?.slug, clave }),
      });
      const r = await res.json().catch(() => ({}));
      if (res.ok) { window.location.href = destino; return; }
      setError(r.error || 'No se pudo iniciar sesión');
    } catch {
      setError('Sin conexión. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ ...styles.container, maxWidth: '420px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <form onSubmit={entrar} style={{ ...styles.groupCard, display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'stretch' }}>
        <img src="/brand/ranked-wordmark.png" alt="Ranked" style={{ width: '160px', height: 'auto', alignSelf: 'center' }} />
        {torneo && (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ ...styles.title, fontSize: '1.5rem' }}>{torneo.nombre}</h1>
            {torneo.subtitulo && <p style={styles.subtitle}>{torneo.subtitulo}</p>}
            {torneo.organizador && <Organizador nombre={torneo.organizador} />}
          </div>
        )}
        <div>
          <h2 style={{ ...styles.groupTitle, fontSize: '1.15rem', margin: 0 }}>{TEXTOS[rol].titulo}</h2>
          <p style={{ ...styles.faseInfo, margin: '4px 0 0' }}>{TEXTOS[rol].ayuda}</p>
        </div>
        <input
          type="password" autoComplete="current-password" autoFocus required
          value={clave} onChange={e => setClave(e.target.value)}
          aria-label="Clave" placeholder="Clave" data-testid="login-clave"
          style={{ ...styles.select, marginBottom: 0, fontSize: '1.2rem', padding: '14px', textAlign: 'center', letterSpacing: '2px' }}
        />
        {error && <p role="alert" style={{ margin: 0, color: C.rojo, fontSize: '0.9rem', textAlign: 'center' }}>{error}</p>}
        <button type="submit" disabled={enviando || !clave} data-testid="login-entrar"
          style={{ ...boton, padding: '14px', fontSize: '1.05rem', backgroundColor: C.lima, color: C.navy, opacity: enviando || !clave ? 0.6 : 1 }}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
