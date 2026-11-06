"use client";
// Estado de un torneo en tiempo real por Server-Sent Events, con reconexión ante conexiones "zombi"
import { useEffect, useState } from 'react';

// El servidor manda un latido cada 10 s; sin noticias en este tiempo la conexión se da por muerta
const SILENCIO_MAXIMO_MS = 25000;

export function useTorneoEnVivo(slug) {
  const [datos, setDatos] = useState(null);
  const [conexion, setConexion] = useState('conectando');

  useEffect(() => {
    let fuente;
    let reintento;
    let ultimoMensaje = Date.now();

    const conectar = () => {
      ultimoMensaje = Date.now();
      fuente = new EventSource(`/api/torneo/stream?torneo=${encodeURIComponent(slug)}`);
      fuente.onopen = () => setConexion('en-vivo');
      fuente.addEventListener('latido', () => { ultimoMensaje = Date.now(); });
      fuente.addEventListener('torneo', (evento) => {
        ultimoMensaje = Date.now();
        setDatos(JSON.parse(evento.data));
        setConexion('en-vivo');
      });
      fuente.onerror = () => {
        setConexion('reconectando');
        if (fuente.readyState === EventSource.CLOSED) {
          clearTimeout(reintento);
          reintento = setTimeout(conectar, 5000);
        }
      };
    };

    const reconectarSiSilencio = () => {
      if (Date.now() - ultimoMensaje > SILENCIO_MAXIMO_MS) {
        setConexion('reconectando');
        clearTimeout(reintento);
        fuente?.close();
        conectar();
      }
    };
    const vigilante = setInterval(reconectarSiSilencio, 5000);
    const alVolverVisible = () => { if (document.visibilityState === 'visible') reconectarSiSilencio(); };
    document.addEventListener('visibilitychange', alVolverVisible);

    conectar();
    return () => {
      fuente?.close();
      clearInterval(vigilante);
      clearTimeout(reintento);
      document.removeEventListener('visibilitychange', alVolverVisible);
    };
  }, [slug]);

  return { datos, conexion };
}
