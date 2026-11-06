// Paleta y estilos del panel de administración (marca Ranked), compartidos por todos los formatos

// Paleta de marca Ranked
export const C = {
  navy: '#0B0F1E',
  card: '#131A2E',
  card2: '#1A2238',
  borde: '#252F4A',
  texto: '#F6F6F6',
  suave: '#A3ABC2',
  tenue: '#6B7490',
  lima: '#ADF238',
  limaFondo: 'rgba(173,242,56,0.10)',
  limaBorde: 'rgba(173,242,56,0.35)',
  rojo: '#FF5C6C',
  rojoFondo: 'rgba(255,92,108,0.12)',
  ambar: '#F5B83D',
  ambarFondo: 'rgba(245,184,61,0.12)',
  oro: '#F5C542',
};
export const FUENTE_TITULO = 'var(--font-titulo), var(--font-texto), system-ui, sans-serif';

export const titulo = { fontFamily: FUENTE_TITULO, fontStyle: 'italic', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' };
export const boton = { border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' };
export const badgeCirculo = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', fontSize: '0.75rem', fontWeight: '700' };

export const styles = {
  loading: { display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1rem', color: C.suave, backgroundColor: C.navy },
  container: { maxWidth: '820px', margin: '0 auto', padding: '10px 12px 16px', backgroundColor: C.navy, color: C.texto, minHeight: '100vh', boxSizing: 'border-box' },

  // ── Cabecera ──
  header: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '18px 0 20px', marginBottom: '16px', borderBottom: `1px solid ${C.borde}` },
  logo: { width: 'min(220px, 60vw)', height: 'auto' },
  headerTexto: { textAlign: 'center' },
  title: { ...titulo, margin: 0, color: C.texto, fontSize: '1.9rem', lineHeight: 1.05 },
  subtitle: { margin: '4px 0 0', color: C.lima, fontSize: '0.85rem', fontWeight: '600', letterSpacing: '0.5px' },
  linkPublico: { padding: '6px 14px', border: `1px solid ${C.limaBorde}`, borderRadius: '999px', color: C.lima, fontSize: '0.75rem', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', textDecoration: 'none' },

  // ── Pestañas ──
  tabsContainer: { display: 'flex', gap: '4px', backgroundColor: C.card, border: `1px solid ${C.borde}`, borderRadius: '10px', padding: '4px', marginBottom: '12px', overflowX: 'auto' },
  tab: { ...titulo, fontWeight: '700', flex: '1 0 auto', padding: '10px 12px', textAlign: 'center', border: 'none', background: 'transparent', color: C.suave, borderRadius: '7px', cursor: 'pointer', fontSize: '0.95rem', whiteSpace: 'nowrap' },
  tabActive: { ...titulo, fontWeight: '800', flex: '1 0 auto', padding: '10px 12px', textAlign: 'center', border: 'none', background: C.lima, color: C.navy, borderRadius: '7px', cursor: 'pointer', fontSize: '0.95rem', whiteSpace: 'nowrap' },

  // ── Sub-pestañas ──
  subTabsContainer: { display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '2px' },
  subTabBase: { ...titulo, fontWeight: '700', flex: '1 1 0', minWidth: '84px', padding: '9px 12px', textAlign: 'center', border: `1.5px solid ${C.borde}`, background: C.card, color: C.suave, borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', whiteSpace: 'nowrap' },
  subTabActive: { background: C.limaFondo },

  // ── Tarjetas y secciones ──
  groupCard: { backgroundColor: C.card, border: `1px solid ${C.borde}`, borderRadius: '14px', padding: '14px', marginBottom: '14px' },
  groupTitle: { ...titulo, margin: '0 0 12px 0', color: C.texto, fontSize: '1.45rem' },
  divider: { height: '1px', backgroundColor: C.borde, margin: '16px 0' },
  seccionLabel: { fontSize: '0.75rem', fontWeight: '700', color: C.suave, textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 10px 0' },
  faseInfo: { fontSize: '0.85rem', color: C.suave, margin: '0 0 12px 0' },
  estrella: { color: C.lima, marginLeft: '6px', fontSize: '0.85rem' },

  // ── Tabla de posiciones por grupo ──
  tablaPosWrapper: { backgroundColor: C.card2, borderRadius: '10px', overflow: 'hidden', border: `1px solid ${C.borde}` },
  tablaPosHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: `1px solid ${C.borde}` },
  tablaPosTitle: { fontSize: '0.75rem', fontWeight: '700', color: C.suave, textTransform: 'uppercase', letterSpacing: '1.5px' },
  tablaPosLegend: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: C.suave },
  legendDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: C.lima, display: 'inline-block' },
  tablaPos: { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' },
  tablaPosHead: {},
  thPos: { padding: '8px 6px', textAlign: 'center', color: C.tenue, fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' },
  thPosLeft: { padding: '8px 6px', textAlign: 'left', color: C.tenue, fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' },
  rowClasifica: { borderTop: `1px solid ${C.borde}`, backgroundColor: C.limaFondo },
  rowNormal: { borderTop: `1px solid ${C.borde}` },
  tdPos: { padding: '9px 6px', textAlign: 'center', color: C.texto, fontVariantNumeric: 'tabular-nums' },
  tdPosNombre: { padding: '9px 6px', textAlign: 'left', color: C.texto, fontWeight: '600' },
  badgeClasifica: { ...badgeCirculo, backgroundColor: C.lima, color: C.navy },
  badgeNormal: { ...badgeCirculo, backgroundColor: C.borde, color: C.suave },

  // ── Tabla general ──
  tableWrapper: { overflowX: 'auto', marginBottom: '10px' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' },
  th: { padding: '8px', color: C.tenue, fontSize: '0.75rem', borderBottom: `1px solid ${C.borde}` },
  thCenter: { padding: '8px', textAlign: 'center', color: C.tenue, fontSize: '0.75rem', borderBottom: `1px solid ${C.borde}` },
  rowStandard: { borderBottom: `1px solid ${C.borde}` },
  rowQualified: { borderBottom: `1px solid ${C.borde}`, backgroundColor: C.limaFondo },
  tdMain: { padding: '9px 8px', fontWeight: '600', color: C.texto },
  tdCenter: { padding: '9px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' },
  tdBold: { padding: '9px 8px', textAlign: 'center', fontWeight: '700', fontVariantNumeric: 'tabular-nums' },
  badgeGrupo: { ...titulo, backgroundColor: C.borde, color: C.texto, padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' },

  // ── Partidos ──
  matchesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' },
  matchCard: { border: `1px solid ${C.borde}`, borderRadius: '12px', padding: '12px', backgroundColor: C.card2 },
  matchCardPlayed: { border: `1px solid ${C.borde}`, borderRadius: '12px', padding: '12px', backgroundColor: C.card },
  matchTitle: { ...titulo, fontWeight: '700', margin: '0 0 10px 0', fontSize: '0.9rem', color: C.suave },
  matchTeams: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' },
  teamLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '0.92rem', borderRadius: '8px', padding: '4px 6px' },
  scoreInput: { width: '54px', padding: '7px 4px', textAlign: 'center', border: `1.5px solid ${C.borde}`, borderRadius: '8px', backgroundColor: C.navy, color: C.texto, fontSize: '1.05rem', fontWeight: '700', fontFamily: 'inherit' },
  select: { width: '100%', padding: '9px', marginBottom: '8px', border: `1px solid ${C.borde}`, borderRadius: '8px', fontSize: '0.9rem', backgroundColor: C.navy, color: C.texto, fontFamily: 'inherit' },

  // ── Botones ──
  btnAssign: { ...boton, width: '100%', padding: '11px', backgroundColor: C.lima, color: C.navy, marginTop: '10px' },
  btnSave: { ...boton, flex: 2, padding: '9px', backgroundColor: C.lima, color: C.navy },
  btnWarning: { ...boton, flex: 1, padding: '9px', backgroundColor: C.ambarFondo, color: C.ambar, border: `1px solid ${C.ambar}`, fontSize: '0.8rem' },
  btnUpdate: { ...boton, flex: 1, padding: '9px', backgroundColor: 'transparent', color: C.texto, border: `1px solid ${C.borde}`, fontWeight: '600' },
  btnReset: { ...boton, flex: 1, padding: '9px', backgroundColor: C.rojoFondo, color: C.rojo, fontWeight: '600' },
  btnSorteo: { ...boton, padding: '10px 18px', backgroundColor: C.lima, color: C.navy, fontSize: '0.9rem', whiteSpace: 'nowrap' },
  btnResetFase: { ...boton, padding: '9px 20px', backgroundColor: 'transparent', color: C.rojo, border: `1px solid ${C.rojo}`, fontWeight: '600', fontSize: '0.8rem' },

  // ── Fases ──
  finalPhaseSection: {},
  lockedPhase: { textAlign: 'center', padding: '22px', backgroundColor: C.card, border: `1px dashed ${C.borde}`, borderRadius: '12px', color: C.suave, fontWeight: '500', marginTop: '8px' },
  avisoHuerfana: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px', marginTop: '12px', padding: '14px 16px', backgroundColor: C.ambarFondo, border: `1px solid ${C.ambar}`, borderRadius: '12px', color: C.ambar, fontSize: '0.9rem', lineHeight: 1.45 },
  sorteoCard: { display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.limaFondo, border: `1px solid ${C.limaBorde}`, borderRadius: '14px', padding: '16px', marginBottom: '20px' },
  sorteoTitulo: { ...titulo, margin: 0, color: C.lima, fontSize: '1.2rem' },
  sorteoTexto: { margin: '4px 0 0', fontSize: '0.85rem', color: C.suave, maxWidth: '460px' },

  // ── Cuadro de semifinal ──
  semiBracketCard: { display: 'flex', gap: '12px', backgroundColor: C.card2, border: `1px solid ${C.borde}`, borderRadius: '12px', padding: '14px', marginBottom: '16px' },
  semiBracketCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' },
  semiBracketLabel: { ...titulo, fontSize: '0.85rem', color: C.lima },
  semiBracketRow: { display: 'flex', alignItems: 'center', gap: '6px' },
  semiBracketBadge: { flexShrink: 0, fontSize: '0.65rem', fontWeight: '700', backgroundColor: C.lima, color: C.navy, padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' },
  semiBracketBadge2: { flexShrink: 0, fontSize: '0.65rem', fontWeight: '700', backgroundColor: C.borde, color: C.texto, padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' },
  semiBracketNombre: { fontSize: '0.85rem', fontWeight: '600', color: C.texto },
  semiBracketVs: { fontSize: '0.7rem', fontWeight: '700', color: C.tenue, textAlign: 'center', margin: '1px 0' },
  semiBracketDivisor: { width: '1px', backgroundColor: C.borde, borderRadius: '4px' },

  // ── Podio del campeón ──
  podioWrapper: { background: `linear-gradient(145deg, ${C.card2} 0%, #1f2437 55%, #2a2a1c 100%)`, border: `2px solid ${C.oro}`, borderRadius: '16px', padding: '20px 16px', boxShadow: '0 6px 24px rgba(245,197,66,0.18)' },
  podioDestellos: { display: 'flex', justifyContent: 'space-around', marginBottom: '10px' },
  destello: { fontSize: '1.4rem' },
  podioCuerpo: { display: 'flex', gap: '16px', alignItems: 'stretch' },
  podioIzq: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' },
  podioCorona: { fontSize: '2.8rem', lineHeight: 1, marginBottom: '2px' },
  podioBadge: { backgroundColor: C.oro, color: C.navy, fontSize: '0.65rem', fontWeight: '800', letterSpacing: '2px', padding: '3px 10px', borderRadius: '20px' },
  podioNombre: { ...titulo, margin: '6px 0 2px 0', fontSize: '1.4rem', color: C.texto, textAlign: 'center', lineHeight: 1.1 },
  podioMarcador: { display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px', fontFamily: FUENTE_TITULO },
  podioScore: { fontSize: '2.2rem', fontWeight: '800', color: C.lima },
  podioSeparador: { fontSize: '1.2rem', color: C.tenue, fontWeight: '300' },
  podioScoreSub: { fontSize: '1.6rem', fontWeight: '700', color: C.suave },
  podioSegundo: { fontSize: '0.78rem', color: C.suave, margin: '2px 0 0 0', textAlign: 'center' },
  podioDivisor: { width: '1px', backgroundColor: C.oro, opacity: 0.4, borderRadius: '4px', minHeight: '120px' },
  podioDer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  fotoContainer: { position: 'relative', width: '100%', maxWidth: '160px' },
  fotoGanador: { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '12px', border: `3px solid ${C.oro}`, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', display: 'block' },
  btnEliminarFoto: { position: 'absolute', top: '-8px', right: '-8px', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: C.rojo, color: 'white', border: 'none', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', padding: 0 },
  fotoPlaceholder: { width: '100%', maxWidth: '160px', aspectRatio: '1', border: `2px dashed ${C.oro}`, borderRadius: '12px', backgroundColor: 'rgba(245,197,66,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', padding: '10px', boxSizing: 'border-box' },
  fotoIcono: { fontSize: '2rem', lineHeight: 1 },
  fotoTexto: { fontSize: '0.72rem', color: C.suave, textAlign: 'center', lineHeight: 1.3 },
  btnCambiarFoto: { ...boton, padding: '6px 14px', backgroundColor: 'transparent', color: C.oro, border: `1px solid ${C.oro}`, borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' },
  podioTrofeo: { ...titulo, textAlign: 'center', fontSize: '1rem', color: C.oro, marginTop: '16px' },

  // ── Reglas ──
  reglasLista: { margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  reglaItem: { color: C.suave, fontSize: '0.92rem', lineHeight: 1.45, paddingLeft: '4px' },
  reglaTitulo: { ...titulo, display: 'block', color: C.lima, fontSize: '1.05rem' },
  reglasPuntos: { margin: 0, paddingLeft: '20px', color: C.suave, fontSize: '0.92rem', lineHeight: 1.6 },

  footer: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 0 4px', color: C.tenue, fontSize: '0.75rem', letterSpacing: '1px', textTransform: 'uppercase' },
  footerLink: { color: C.suave, fontWeight: '700', textDecoration: 'none' },
};
