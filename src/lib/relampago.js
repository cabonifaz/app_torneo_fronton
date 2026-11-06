// Cálculos del formato Relámpago (4 parejas todos contra todos + final). Se usa en navegador y servidor.
import { FORMATOS, ganadorPartido } from './formatos.js';

const F = FORMATOS.relampago4;

// Rondas de un todos contra todos de 4 con 2 canchas. Los partidos se guardan en este orden:
// ronda 1: 1-2 y 3-4 · ronda 2: 1-3 y 2-4 · ronda 3: 1-4 y 2-3
export const CRUCES_LIGA = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];

export function rondaYCancha(indice) {
  return { ronda: Math.floor(indice / F.canchas) + 1, cancha: (indice % F.canchas) + 1 };
}

// Criterios de la clasificación, en orden: puntos, diferencia de sets, diferencia de puntos
const comparar = (a, b) => b.puntos - a.puntos || b.dif_sets - a.dif_sets || b.diferencia_puntos - a.diferencia_puntos;

export function tablaLiga(datos) {
  const partidosLiga = datos.partidos.filter(p => p.fase === 'liga');
  const filas = datos.posiciones
    .map(pos => {
      const pj = partidosLiga.filter(p => p.jugado === 1 && (p.pareja1_id === pos.pareja_id || p.pareja2_id === pos.pareja_id)).length;
      return {
        ...pos,
        pj,
        pp: pj - pos.pg,
        puntos: pos.pg * F.puntosVictoria + (pj - pos.pg) * F.puntosDerrota,
        dif_sets: pos.sets_favor - pos.sets_contra,
      };
    })
    .sort((a, b) => comparar(a, b) || a.pareja_id - b.pareja_id);

  // Empates que ningún criterio de las bases resuelve: los marca para que la organización decida
  return filas.map((f, i) => ({
    ...f,
    empateSinResolver: filas.some((otra, j) => j !== i && comparar(f, otra) === 0) && f.pj > 0,
  }));
}

export function resumenRelampago(datos) {
  const liga = datos.partidos.filter(p => p.fase === 'liga');
  const ligaTerminada = liga.length > 0 && liga.every(p => p.jugado === 1);
  const hayJugados = liga.some(p => p.jugado === 1);
  const tabla = tablaLiga(datos);

  // La final solo es válida si la liga está completa (si se resetea un resultado, queda "huérfana")
  const partidoFinal = datos.partidos.find(p => p.fase === 'final') || null;
  const final = ligaTerminada ? partidoFinal : null;
  const finalHuerfana = !ligaTerminada && !!partidoFinal;
  const finalistas = hayJugados ? tabla.slice(0, F.clasificanFinal) : [];
  // El 2° y el 3° empatados en todo: la final no se puede armar sola
  const corteEmpatado = hayJugados && tabla.length > F.clasificanFinal
    && comparar(tabla[F.clasificanFinal - 1], tabla[F.clasificanFinal]) === 0;

  const campeon = final?.jugado ? ganadorPartido(final) : null;

  // Próxima ronda: la primera con partidos pendientes (sus 2 partidos se juegan a la vez)
  const conIndice = liga.map((p, i) => ({ ...p, ...rondaYCancha(i) }));
  const rondaPendiente = conIndice.find(p => !p.jugado)?.ronda;
  let proximos = conIndice.filter(p => p.ronda === rondaPendiente && !p.jugado);
  if (ligaTerminada && final && !final.jugado) proximos = [final];

  const ultimos = [...liga, ...(final ? [final] : [])]
    .filter(p => p.jugado === 1)
    .sort((a, b) => new Date(b.actualizado_en || 0) - new Date(a.actualizado_en || 0) || b.id - a.id)
    .slice(0, 6);

  const faseActual = ligaTerminada ? 'final' : 'liga';
  const partidosFase = faseActual === 'liga' ? liga : final ? [final] : [];

  return {
    liga: conIndice, ligaTerminada, hayJugados, tabla,
    final, finalHuerfana, finalistas, corteEmpatado, campeon,
    proximos, ultimos, faseActual,
    progreso: { jugados: partidosFase.filter(p => p.jugado === 1).length, total: faseActual === 'final' ? 1 : liga.length },
  };
}
