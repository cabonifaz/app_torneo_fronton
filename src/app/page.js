// Portada: lista de torneos con su enlace público. Enlaces viejos /?torneo=<slug> → panel del torneo.
import { redirect } from 'next/navigation';
import { listarTorneos } from '../lib/torneo';
import { C, styles } from '../componentes/admin-estilos';
import { Organizador } from '../componentes/CabeceraAdmin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ranked · Torneos de Frontón' };

export default async function Page({ searchParams }) {
  const { torneo: slug } = await searchParams;
  if (slug) redirect(`/t/${encodeURIComponent(slug)}/admin`);

  const torneos = await listarTorneos();
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <img src="/brand/ranked-wordmark.png" alt="Ranked" style={styles.logo} />
        <h1 style={styles.title}>Torneos</h1>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {torneos.map(t => (
          <a key={t.id} href={`/t/${t.slug}`} style={{ ...styles.groupCard, marginBottom: 0, textDecoration: 'none', color: C.texto, display: 'block' }}>
            <h2 style={{ ...styles.groupTitle, margin: 0 }}>{t.nombre}</h2>
            {t.subtitulo && <p style={{ ...styles.subtitle, margin: '4px 0 0' }}>{t.subtitulo}</p>}
            {t.organizador && <Organizador nombre={t.organizador} />}
            <p style={{ margin: '10px 0 0', color: C.lima, fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>● Ver en vivo →</p>
          </a>
        ))}
        {torneos.length === 0 && <div style={styles.lockedPhase}>Aún no hay torneos publicados.</div>}
      </div>
      <footer style={styles.footer}>
        <span>Powered by <a href="https://geeky-tech.es" target="_blank" rel="noopener" style={styles.footerLink}>Geeky Tech</a> · <a href="/superadmin" style={styles.footerLink}>Super admin</a></span>
      </footer>
    </div>
  );
}
