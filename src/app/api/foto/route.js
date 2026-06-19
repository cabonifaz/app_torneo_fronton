import pool from '../../../lib/db';
import { NextResponse } from 'next/server';

// GET: devuelve si existe la foto leyendo desde la base de datos
export async function GET() {
  try {
    const [rows] = await pool.query('SELECT imagen FROM foto_campeon LIMIT 1');
    
    if (rows.length > 0) {
      // Devolvemos el string en Base64 directo. El tag <img> de React lo lee nativamente.
      return NextResponse.json({ existe: true, url: rows[0].imagen });
    }
    
    return NextResponse.json({ existe: false, url: null });
  } catch (error) {
    console.error("Error leyendo foto de BD:", error);
    return NextResponse.json({ existe: false, url: null });
  }
}

// POST: guarda la foto enviada como base64 en la base de datos
export async function POST(request) {
  try {
    const { imagen } = await request.json();
    if (!imagen) return NextResponse.json({ error: 'No se recibió imagen' }, { status: 400 });

    // 1. Limpiamos la tabla para asegurarnos de que solo exista UNA foto de campeón
    await pool.query('TRUNCATE TABLE foto_campeon');
    
    // 2. Insertamos la nueva imagen (incluyendo el prefijo data:image/...)
    await pool.query('INSERT INTO foto_campeon (imagen) VALUES (?)', [imagen]);

    // Devolvemos la misma imagen como URL para que el frontend la muestre inmediatamente
    return NextResponse.json({ ok: true, url: imagen });
  } catch (error) {
    console.error('Error guardando foto en BD:', error);
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
  }
}

// DELETE: elimina la foto de la base de datos
export async function DELETE() {
  try {
    await pool.query('TRUNCATE TABLE foto_campeon');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error eliminando foto de BD:', error);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}