// src/app/api/foto/imagen/route.js
// Sirve la foto desde el volumen persistente (fuera de /public, que es de solo lectura tras el build)
import { readFile } from 'fs/promises';
import { buscarArchivo } from '../../../../lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const foto = await buscarArchivo('foto_campeon');
  if (!foto) return new Response('No encontrada', { status: 404 });

  return new Response(await readFile(foto.ruta), {
    headers: {
      'Content-Type': foto.mime,
      'Content-Length': String(foto.size),
      // La URL lleva ?t=<mtime>, así que cada versión nueva cambia de URL
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
