import path from 'path';
import { mkdir, readdir, stat, rename, writeFile, unlink } from 'fs/promises';

// Directorio persistente para archivos subidos (sobrevive a los deploys).
// Prioridad: UPLOADS_DIR explícito > volumen de Railway (variable que Railway
// inyecta automáticamente al montar un volumen) > carpeta local para desarrollo.
export const UPLOADS_DIR =
  process.env.UPLOADS_DIR ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  'data/uploads'; // relativa al directorio de trabajo

export const TIPOS_IMAGEN = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MIME_POR_EXT = Object.fromEntries(Object.entries(TIPOS_IMAGEN).map(([mime, ext]) => [ext, mime]));

// Busca el archivo `<nombre>.<ext>` guardado (la extensión depende del tipo subido)
export async function buscarArchivo(nombre) {
  let archivos;
  try {
    archivos = await readdir(UPLOADS_DIR);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const archivo = archivos.find(f => path.parse(f).name === nombre && MIME_POR_EXT[path.parse(f).ext.slice(1)]);
  if (!archivo) return null;
  const ruta = path.join(UPLOADS_DIR, archivo);
  const { mtimeMs, size } = await stat(ruta);
  return { ruta, mime: MIME_POR_EXT[path.extname(archivo).slice(1)], mtimeMs, size };
}

// Escritura atómica: se escribe a un temporal y se renombra, así nunca se sirve un archivo a medias
export async function guardarArchivo(nombre, ext, buffer) {
  if (process.env.NODE_ENV === 'production' && !process.env.UPLOADS_DIR && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    console.warn(`[storage] Sin volumen configurado: ${nombre} se guarda en ${UPLOADS_DIR} y se perderá en el próximo deploy.`);
  }
  await mkdir(UPLOADS_DIR, { recursive: true });
  const destino = path.join(UPLOADS_DIR, `${nombre}.${ext}`);
  const temporal = `${destino}.${process.pid}.tmp`;
  await writeFile(temporal, buffer);
  await rename(temporal, destino);
  // Quita versiones previas con otra extensión
  for (const otraExt of Object.values(TIPOS_IMAGEN)) {
    if (otraExt !== ext) await unlink(path.join(UPLOADS_DIR, `${nombre}.${otraExt}`)).catch(() => {});
  }
}

export async function eliminarArchivo(nombre) {
  for (const ext of Object.values(TIPOS_IMAGEN)) {
    await unlink(path.join(UPLOADS_DIR, `${nombre}.${ext}`)).catch(() => {});
  }
}
