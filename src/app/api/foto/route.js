// src/app/api/foto/route.js
// Foto del campeón de cada torneo: ?torneo_id=<id> (por defecto el 1, por compatibilidad)
import { NextResponse } from 'next/server';
import { buscarArchivo, guardarArchivo, eliminarArchivo, TIPOS_IMAGEN } from '../../../lib/storage';
import { nombreFotoCampeon } from '../../../lib/torneo';
import { rolEnTorneo, puedeAdministrar } from '../../../lib/auth';

const sinPermiso = () => NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB

export const dynamic = 'force-dynamic';

const torneoId = request => Number(request.nextUrl.searchParams.get('torneo_id')) || 1;
const urlFoto = (id, foto) => `/api/foto/imagen?torneo_id=${id}&t=${Math.round(foto.mtimeMs)}`;

// GET: devuelve si existe la foto y la URL para mostrarla
export async function GET(request) {
  try {
    const id = torneoId(request);
    const foto = await buscarArchivo(nombreFotoCampeon(id));
    return NextResponse.json({ existe: !!foto, url: foto ? urlFoto(id, foto) : null });
  } catch (error) {
    console.error('Error leyendo foto:', error);
    return NextResponse.json({ error: 'Error al leer la foto' }, { status: 500 });
  }
}

// POST: guarda la foto enviada como multipart/form-data (campo "imagen")
export async function POST(request) {
  if (!puedeAdministrar(await rolEnTorneo(torneoId(request)))) return sinPermiso();
  try {
    const id = torneoId(request);
    const formData = await request.formData();
    const archivo = formData.get('imagen');
    if (!archivo || typeof archivo === 'string') {
      return NextResponse.json({ error: 'No se recibió imagen' }, { status: 400 });
    }

    const ext = TIPOS_IMAGEN[archivo.type];
    if (!ext) return NextResponse.json({ error: 'Formato no soportado (usa JPG, PNG o WEBP)' }, { status: 415 });
    if (archivo.size > TAMANO_MAXIMO) return NextResponse.json({ error: 'La imagen supera los 10 MB' }, { status: 413 });

    await guardarArchivo(nombreFotoCampeon(id), ext, Buffer.from(await archivo.arrayBuffer()));
    const foto = await buscarArchivo(nombreFotoCampeon(id));
    return NextResponse.json({ ok: true, url: urlFoto(id, foto) });
  } catch (error) {
    console.error('Error guardando foto:', error);
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
  }
}

// DELETE: elimina la foto
export async function DELETE(request) {
  if (!puedeAdministrar(await rolEnTorneo(torneoId(request)))) return sinPermiso();
  try {
    await eliminarArchivo(nombreFotoCampeon(torneoId(request)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error eliminando foto:', error);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
