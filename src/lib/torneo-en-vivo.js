import { createHash } from 'crypto';
import { obtenerDatosTorneo, nombreFotoCampeon } from './torneo';
import { buscarArchivo } from './storage';

// Difusión en tiempo real del estado de cada torneo.
// Un único sondeo a la BD por torneo y proceso (sin importar cuántos espectadores haya) que solo
// emite a los suscriptores cuando el estado cambia. Se detiene cuando no queda nadie conectado.
const INTERVALO_MS = 2000;

// En desarrollo el módulo se recarga (HMR); guardarlo en globalThis evita duplicar los sondeos
const canales = globalThis.__torneosEnVivo ??= new Map();

function canal(torneoId) {
  if (!canales.has(torneoId)) {
    canales.set(torneoId, {
      suscriptores: new Set(),
      temporizador: null,
      consultando: false,
      arranque: null, // promesa de la captura inicial compartida
      ultimo: null, // { hash, json }
    });
  }
  return canales.get(torneoId);
}

async function capturar(torneoId) {
  const datos = await obtenerDatosTorneo(torneoId);
  const foto = await buscarArchivo(nombreFotoCampeon(torneoId));
  const json = JSON.stringify({ ...datos, foto: foto ? `/api/foto/imagen?torneo_id=${torneoId}&t=${Math.round(foto.mtimeMs)}` : null });
  return { hash: createHash('sha1').update(json).digest('hex'), json };
}

async function sondear(torneoId, estado) {
  if (estado.consultando) return; // si la BD va lenta, no apilar consultas
  estado.consultando = true;
  try {
    const actual = await capturar(torneoId);
    if (actual.hash === estado.ultimo?.hash) return;
    estado.ultimo = actual;
    for (const enviar of estado.suscriptores) enviar(actual.json);
  } catch (error) {
    console.error(`[en-vivo] Error consultando el torneo ${torneoId}:`, error.message);
  } finally {
    estado.consultando = false;
  }
}

// Tras una escritura: emitir ya a los espectadores en lugar de esperar al próximo sondeo.
// Funciona dentro del mismo proceso (una instancia en Railway); el sondeo sigue de respaldo.
export function notificarCambio(torneoId) {
  const estado = canales.get(Number(torneoId));
  if (estado?.temporizador) sondear(Number(torneoId), estado);
}

export async function suscribir(torneoId, enviar) {
  const estado = canal(torneoId);
  // Sin sondeo activo el último estado puede estar desactualizado: capturar antes de arrancar.
  // Si llegan muchos espectadores a la vez, todos esperan la misma captura inicial.
  if (!estado.temporizador) {
    estado.arranque ??= capturar(torneoId)
      .then((actual) => {
        estado.ultimo = actual;
        estado.temporizador ??= setInterval(() => sondear(torneoId, estado), INTERVALO_MS);
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
