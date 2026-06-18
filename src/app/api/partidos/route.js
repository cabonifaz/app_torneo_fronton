import pool from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function PUT(request) {
  try {
    const { id, puntos_pareja1, puntos_pareja2, pareja1_id, pareja2_id, reset, reset_parejas } = await request.json();

    if (reset_parejas) {
      await pool.query('UPDATE partidos SET pareja1_id = NULL, pareja2_id = NULL, jugado = 0, puntos_pareja1 = 0, puntos_pareja2 = 0 WHERE id = ?', [id]);
    } else if (reset) {
      await pool.query('UPDATE partidos SET jugado = 0, puntos_pareja1 = 0, puntos_pareja2 = 0 WHERE id = ?', [id]);
    } else if (pareja1_id && pareja2_id) {
      await pool.query('UPDATE partidos SET pareja1_id = ?, pareja2_id = ? WHERE id = ?', [pareja1_id, pareja2_id, id]);
    } else {
      await pool.query('UPDATE partidos SET puntos_pareja1 = ?, puntos_pareja2 = ?, jugado = 1 WHERE id = ?', [puntos_pareja1, puntos_pareja2, id]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { fase, pareja1_id, pareja2_id } = await request.json();

    await pool.query(
      'INSERT INTO partidos (fase, pareja1_id, pareja2_id, grupo_id, puntos_pareja1, puntos_pareja2, jugado) VALUES (?, ?, ?, NULL, 0, 0, 0)',
      [fase, pareja1_id, pareja2_id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al insertar partido:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { fase } = await request.json();

    await pool.query(
      'DELETE FROM partidos WHERE fase = ?',
      [fase]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al eliminar partidos:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}