import pool from './db';

// Estado completo del torneo: lo usan la API de administración y la transmisión en vivo
export async function obtenerDatosTorneo() {
  const [[posiciones], [partidos], [[torneo]]] = await Promise.all([
    // Orden explícito: la vista no garantiza orden y la transmisión en vivo compara por hash
    pool.query('SELECT * FROM vista_posiciones ORDER BY nombre_grupo, pareja_id'),
    pool.query(`
      SELECT
        p.id, p.grupo_id, g.nombre AS nombre_grupo, g.cancha, g.hora_inicio,
        p.pareja1_id, pa1.nombre AS nombre_pareja1,
        p.pareja2_id, pa2.nombre AS nombre_pareja2,
        p.puntos_pareja1, p.puntos_pareja2, p.jugado, p.fase, p.actualizado_en
      FROM partidos p
      LEFT JOIN grupos g ON p.grupo_id = g.id
      LEFT JOIN parejas pa1 ON p.pareja1_id = pa1.id
      LEFT JOIN parejas pa2 ON p.pareja2_id = pa2.id
      ORDER BY FIELD(p.fase, 'grupos', 'cuartos', 'semifinal', 'final'), p.grupo_id, p.id
    `),
    pool.query('SELECT nombre, subtitulo FROM torneo WHERE id = 1'),
  ]);

  return { torneo: torneo || null, posiciones, partidos };
}
