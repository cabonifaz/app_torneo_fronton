// src/app/api/torneo/stream/route.js
// Server-Sent Events: envía el estado del torneo cada vez que cambia
import { suscribir } from '../../../../lib/torneo-en-vivo';

export const dynamic = 'force-dynamic';

const LATIDO_MS = 20000; // evita que proxies cierren la conexión por inactividad

export async function GET(request) {
  const codificador = new TextEncoder();
  let cancelar = () => {};

  const stream = new ReadableStream({
    async start(controller) {
      const escribir = (texto) => {
        try { controller.enqueue(codificador.encode(texto)); } catch { cancelar(); }
      };
      // El navegador reintenta a los 3 s si se corta la conexión
      escribir('retry: 3000\n\n');

      let desuscribir = () => {};
      const latido = setInterval(() => escribir(': latido\n\n'), LATIDO_MS);
      cancelar = () => {
        clearInterval(latido);
        desuscribir();
        try { controller.close(); } catch {}
      };
      request.signal.addEventListener('abort', () => cancelar());

      try {
        desuscribir = await suscribir((json) => escribir(`event: torneo\ndata: ${json}\n\n`));
        if (request.signal.aborted) cancelar();
      } catch (error) {
        console.error('[en-vivo] Error al suscribir:', error.message);
        escribir('event: error\ndata: {}\n\n');
        cancelar();
      }
    },
    cancel() {
      cancelar();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
