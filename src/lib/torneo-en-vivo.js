import { createHash } from 'crypto';
import { obtenerDatosTorneo } from './torneo';
import { buscarArchivo } from './storage';

// Difusión en tiempo real del estado del torneo.
// Un único sondeo a la BD por proceso (sin importar cuántos espectadores haya) que solo
// emite a los suscriptores cuando el estado cambia. Se detiene cuando no queda nadie conectado.
const INTERVALO_MS = 2000;

// En desarrollo el módulo se recarga (HMR); guardarlo en globalThis evita duplicar el sondeo
const estado = globalThis.__torneoEnVivo ??= {
  suscriptores: new Set(),
  temporizador: null,
  consultando: false,
  arranque: null, // promesa de la captura inicial compartida
  ultimo: null, // { hash, json }
};

async function capturar() {
  const datos = await obtenerDatosTorneo();
  const foto = await buscarArchivo('foto_campeon');
  const json = JSON.stringify({ ...datos, foto: foto ? `/api/foto/imagen?t=${Math.round(foto.mtimeMs)}` : null });
  return { hash: createHash('sha1').update(json).digest('hex'), json };
}

async function sondear() {
  if (estado.consultando) return; // si la BD va lenta, no apilar consultas
  estado.consultando = true;
  try {
    const actual = await capturar();
    if (actual.hash === estado.ultimo?.hash) return;
    estado.ultimo = actual;
    for (const enviar of estado.suscriptores) enviar(actual.json);
  } catch (error) {
    console.error('[en-vivo] Error consultando el torneo:', error.message);
  } finally {
    estado.consultando = false;
  }
}

export async function suscribir(enviar) {
  // Sin sondeo activo el último estado puede estar desactualizado: capturar antes de arrancar.
  // Si llegan muchos espectadores a la vez, todos esperan la misma captura inicial.
  if (!estado.temporizador) {
    estado.arranque ??= capturar()
      .then((actual) => {
        estado.ultimo = actual;
        estado.temporizador ??= setInterval(sondear, INTERVALO_MS);
      })
      .finally(() => { estado.arranque = null; });
    await estado.arranque;
  }
  // El recién llegado recibe el estado actual de inmediato
  estado.suscriptores.add(enviar);
  enviar(estado.ultimo.json);

  return () => {
    estado.suscriptores.delete(enviar);
    if (estado.suscriptores.size === 0) {
      clearInterval(estado.temporizador);
      estado.temporizador = null;
    }
  };
}
