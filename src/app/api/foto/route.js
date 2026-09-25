// src/app/api/foto/route.js
import { NextResponse } from 'next/server';
import { buscarArchivo, guardarArchivo, eliminarArchivo, TIPOS_IMAGEN } from '../../../lib/storage';

const NOMBRE_FOTO = 'foto_campeon';
const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB

export const dynamic = 'force-dynamic';

// GET: devuelve si existe la foto y la URL para mostrarla
export async function GET() {
  try {
    const foto = await buscarArchivo(NOMBRE_FOTO);
    return NextResponse.json({
      existe: !!foto,
      url: foto ? `/api/foto/imagen?t=${Math.round(foto.mtimeMs)}` : null,
    });
  } catch (error) {
    console.error('Error leyendo foto:', error);
    return NextResponse.json({ error: 'Error al leer la foto' }, { status: 500 });
  }
}

// POST: guarda la foto enviada como multipart/form-data (campo "imagen")
export async function POST(request) {
  try {
    const formData = await request.formData();
    const archivo = formData.get('imagen');
    if (!archivo || typeof archivo === 'string') {
      return NextResponse.json({ error: 'No se recibió imagen' }, { status: 400 });
    }

    const ext = TIPOS_IMAGEN[archivo.type];
    if (!ext) return NextResponse.json({ error: 'Formato no soportado (usa JPG, PNG o WEBP)' }, { status: 415 });
    if (archivo.size > TAMANO_MAXIMO) return NextResponse.json({ error: 'La imagen supera los 10 MB' }, { status: 413 });

    await guardarArchivo(NOMBRE_FOTO, ext, Buffer.from(await archivo.arrayBuffer()));
    const foto = await buscarArchivo(NOMBRE_FOTO);
    return NextResponse.json({ ok: true, url: `/api/foto/imagen?t=${Math.round(foto.mtimeMs)}` });
  } catch (error) {
    console.error('Error guardando foto:', error);
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
  }
}

// DELETE: elimina la foto
export async function DELETE() {
  try {
    await eliminarArchivo(NOMBRE_FOTO);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error eliminando foto:', error);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
