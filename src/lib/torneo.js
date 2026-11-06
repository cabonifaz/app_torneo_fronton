import pool from './db.js';

const COLUMNAS_TORNEO = 'id, slug, nombre, subtitulo, formato, organizador, es_prueba';

// Torneos para el selector (los de prueba solo si se piden)
export async function listarTorneos({ incluirPruebas = false } = {}) {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS_TORNEO} FROM torneo ${incluirPruebas ? '' : 'WHERE es_prueba = 0'} ORDER BY id DESC`
  );
  return filas;
}

// Torneo por slug; sin slug, el más reciente que no sea de prueba
export async function resolverTorneo(slug) {
  const [[torneo]] = slug
    ? await pool.query(`SELECT ${COLUMNAS_TORNEO} FROM torneo WHERE slug = ?`, [slug])
    : await pool.query(`SELECT ${COLUMNAS_TORNEO} FROM torneo WHERE es_prueba = 0 ORDER BY id DESC LIMIT 1`);
  return torneo || null;
}

export async function obtenerTorneoPorId(id) {
  const [[torneo]] = await pool.query(`SELECT ${COLUMNAS_TORNEO} FROM torneo WHERE id = ?`, [id]);
  return torneo || null;
}

// Estado completo de un torneo: lo usan la API de administración y la transmisión en vivo
export async function obtenerDatosTorneo(torneoId) {
  const [[posiciones], [partidos], torneo] = await Promise.all([
    // Orden explícito: la vista no garantiza orden y la transmisión en vivo compara por hash
    pool.query('SELECT * FROM vista_posiciones WHERE torneo_id = ? ORDER BY grupo_id, pareja_id', [torneoId]),
    pool.query(`
      SELECT
        p.id, p.grupo_id, g.nombre AS nombre_grupo, g.cancha, g.hora_inicio,
        p.pareja1_id, pa1.nombre AS nombre_pareja1,
        p.pareja2_id, pa2.nombre AS nombre_pareja2,
        p.puntos_pareja1, p.puntos_pareja2, p.sets_pareja1, p.sets_pareja2, p.detalle_sets,
        p.jugado, p.en_juego, p.fase, p.actualizado_en
      FROM partidos p
      LEFT JOIN grupos g ON p.grupo_id = g.id
      LEFT JOIN parejas pa1 ON p.pareja1_id = pa1.id
      LEFT JOIN parejas pa2 ON p.pareja2_id = pa2.id
      WHERE p.torneo_id = ?
      ORDER BY FIELD(p.fase, 'grupos', 'liga', 'cuartos', 'semifinal', 'final'), p.grupo_id, p.id
    `, [torneoId]),
    obtenerTorneoPorId(torneoId),
  ]);

  return { torneo, posiciones, partidos };
}

export async function obtenerParejas(torneoId) {
  const [filas] = await pool.query('SELECT id, nombre, grupo_id, cabeza_serie FROM parejas WHERE torneo_id = ? ORDER BY id', [torneoId]);
  return filas;
}

// Nombre del archivo de la foto del campeón: el torneo 1 conserva el nombre que ya tenía en el volumen
export const nombreFotoCampeon = torneoId => (Number(torneoId) === 1 ? 'foto_campeon' : `foto_campeon_${Number(torneoId)}`);

// ── Claves de acceso (nunca se envían al navegador: solo se consultan para verificar) ──
export async function obtenerClaves(torneoId) {
  const [[fila]] = await pool.query('SELECT clave_admin, clave_arbitro FROM torneo WHERE id = ?', [torneoId]);
  return fila || null;
}

// Para el super admin: torneos con indicadores de si tienen claves y cuántos partidos llevan
export async function listarTorneosSuper() {
  const [filas] = await pool.query(`
    SELECT t.${COLUMNAS_TORNEO.split(', ').join(', t.')}, t.creado_en,
      t.clave_admin IS NOT NULL AS tiene_clave_admin, t.clave_arbitro IS NOT NULL AS tiene_clave_arbitro,
      (SELECT COUNT(*) FROM partidos p WHERE p.torneo_id = t.id) AS partidos,
      (SELECT COUNT(*) FROM partidos p WHERE p.torneo_id = t.id AND p.jugado = 1) AS jugados
    FROM torneo t ORDER BY t.es_prueba, t.id DESC`);
  return filas;
}
