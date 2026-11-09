"use client";
// Hora "del servidor" en el navegador, actualizada cada segundo, para los cronómetros de los sets.
// `desfase` = hora del servidor − hora local, medido con cada mensaje de la transmisión.
import { useEffect, useState } from 'react';

export function useAhora(desfase = 0, activo = true) {
  const [local, setLocal] = useState(() => Date.now());
  useEffect(() => {
    if (!activo) return;
    const t = setInterval(() => setLocal(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activo]);
  return local + desfase;
}
