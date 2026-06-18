// src/app/api/foto/route.js
import { writeFile, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const FOTO_PATH = path.join(process.cwd(), 'public', 'foto_campeon.jpg');

// GET: devuelve si existe la foto
export async function GET() {
  const existe = existsSync(FOTO_PATH);
  return NextResponse.json({ existe, url: existe ? `/foto_campeon.jpg?t=${Date.now()}` : null });
}

// POST: guarda la foto enviada como base64
export async function POST(request) {
  try {
    const { imagen } = await request.json();
    if (!imagen) return NextResponse.json({ error: 'No se recibió imagen' }, { status: 400 });

    // imagen viene como "data:image/jpeg;base64,/9j/..."
    const base64Data = imagen.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await writeFile(FOTO_PATH, buffer);
    return NextResponse.json({ ok: true, url: `/foto_campeon.jpg?t=${Date.now()}` });
  } catch (error) {
    console.error('Error guardando foto:', error);
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
  }
}

// DELETE: elimina la foto
export async function DELETE() {
  try {
    if (existsSync(FOTO_PATH)) await unlink(FOTO_PATH);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}