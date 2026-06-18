import pool from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [posiciones] = await pool.query('SELECT * FROM vista_posiciones');
    
    const [partidos] = await pool.query(`
      SELECT 
        p.id, p.grupo_id, g.nombre AS nombre_grupo, g.cancha, g.hora_inicio,
        p.pareja1_id, pa1.nombre AS nombre_pareja1,
        p.pareja2_id, pa2.nombre AS nombre_pareja2,
        p.puntos_pareja1, p.puntos_pareja2, p.jugado, p.fase
      FROM partidos p
      LEFT JOIN grupos g ON p.grupo_id = g.id
      LEFT JOIN parejas pa1 ON p.pareja1_id = pa1.id
      LEFT JOIN parejas pa2 ON p.pareja2_id = pa2.id
      ORDER BY FIELD(p.fase, 'grupos', 'cuartos', 'semifinal', 'final'), p.grupo_id, p.id
    `);

    return NextResponse.json({ posiciones, partidos });
  } catch (error) {
    console.error("Detalle del error SQL:", error);
    return NextResponse.json({ error: 'Error al cargar datos' }, { status: 500 });
  }
}