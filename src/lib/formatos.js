// Formatos de torneo soportados y reglas de puntuación (sin dependencias de servidor: se usan en el navegador)

export const FORMATOS = {
  // Campeonato Mary: 4 grupos de 4 → 2 series de 4 → semifinal → final, todo a set único de 21
  ranked16: {
    nombre: 'Ranked 16 parejas',
    fases: {
      grupos: { mejorDe: 1, puntosSet: 21 },
      cuartos: { mejorDe: 1, puntosSet: 21 },
      semifinal: { mejorDe: 1, puntosSet: 21 },
      final: { mejorDe: 1, puntosSet: 21 },
    },
  },
  // Campeonato Relámpago: 4 parejas todos contra todos (2 canchas) → final entre las 2 mejores
  relampago4: {
    nombre: 'Relámpago 4 parejas',
    fases: {
      liga: { mejorDe: 3, puntosSet: 15 },
      final: { mejorDe: 3, puntosSet: 21 },
    },
    puntosVictoria: 2,
    puntosDerrota: 0,
    clasificanFinal: 2,
    canchas: 2,
  },
};

export const ETIQUETAS_FASE = {
  grupos: 'Fase 1 · Grupos',
  cuartos: 'Fase 2 · Series',
  semifinal: 'Semifinal',
  final: 'Final',
  liga: 'Todos contra todos',
};

export function reglasFase(formato, fase) {
  return FORMATOS[formato]?.fases[fase] || { mejorDe: 1, puntosSet: 21 };
}

// Valida los sets de un partido al mejor de N.
// `sets` es una lista de [puntos pareja 1, puntos pareja 2]; los sets vacíos (null/'') al final se ignoran.
// Devuelve { error } o { sets, sets1, sets2, puntos1, puntos2, avisos }.
export function validarSets(sets, { mejorDe, puntosSet }) {
  const necesarios = Math.ceil(mejorDe / 2);
  const vacio = v => v === null || v === undefined || v === '';
  const jugados = [];

  for (let i = 0; i < (sets?.length || 0); i++) {
    const [a, b] = sets[i] || [];
    if (vacio(a) && vacio(b)) continue;
    if (vacio(a) || vacio(b)) return { error: `Set ${i + 1}: falta el puntaje de una de las parejas.` };
    const n1 = Number(a), n2 = Number(b);
    if (!Number.isInteger(n1) || !Number.isInteger(n2) || n1 < 0 || n2 < 0) return { error: `Set ${i + 1}: los puntajes deben ser números enteros positivos.` };
    if (n1 === n2) return { error: `Set ${i + 1}: no puede haber empate en un set.` };
    if (jugados.length !== i) return { error: `Set ${i + 1}: hay un set vacío antes. Carga los sets en orden.` };
    jugados.push([n1, n2]);
  }

  if (jugados.length === 0) return { error: 'Ingresa el puntaje de al menos un set.' };
  if (jugados.length > mejorDe) return { error: `El partido es al mejor de ${mejorDe}.` };

  let sets1 = 0, sets2 = 0;
  for (let i = 0; i < jugados.length; i++) {
    if (sets1 === necesarios || sets2 === necesarios) {
      return { error: `El partido ya estaba decidido antes del set ${i + 1}: borra ese set.` };
    }
    if (jugados[i][0] > jugados[i][1]) sets1++; else sets2++;
  }
  if (sets1 < necesarios && sets2 < necesarios) {
    return { error: `Partido incompleto: una pareja debe ganar ${necesarios} sets (va ${sets1}-${sets2}).` };
  }

  const avisos = jugados
    .map(([a, b], i) => (Math.max(a, b) < puntosSet ? `Set ${i + 1}: el set es a ${puntosSet} y nadie llegó a ${puntosSet}.` : null))
    .filter(Boolean);

  return {
    sets: jugados,
    sets1,
    sets2,
    puntos1: jugados.reduce((t, [a]) => t + a, 0),
    puntos2: jugados.reduce((t, [, b]) => t + b, 0),
    avisos,
  };
}

// Marcador en curso enviado por el árbitro: { cerrados: [[a,b], ...], actual: [a,b] | null }.
// Se guarda como detalle_sets = [...cerrados, actual]; sets_pareja1/2 cuentan solo los cerrados.
export function validarMarcadorVivo(marcador, { mejorDe }) {
  const necesarios = Math.ceil(mejorDe / 2);
  const entero = n => Number.isInteger(n) && n >= 0 && n <= 99;
  const cerrados = Array.isArray(marcador?.cerrados) ? marcador.cerrados : null;
  const actual = marcador?.actual ?? null;
  if (!cerrados || cerrados.length > mejorDe) return { error: 'Marcador no válido' };

  let sets1 = 0, sets2 = 0;
  for (const set of cerrados) {
    if (!Array.isArray(set) || !entero(set[0]) || !entero(set[1]) || set[0] === set[1]) return { error: 'Set cerrado no válido' };
    if (sets1 === necesarios || sets2 === necesarios) return { error: 'El partido ya estaba decidido' };
    if (set[0] > set[1]) sets1++; else sets2++;
  }
  const decidido = sets1 === necesarios || sets2 === necesarios;
  if (actual !== null) {
    if (decidido) return { error: 'El partido está decidido: finalízalo' };
    if (!Array.isArray(actual) || !entero(actual[0]) || !entero(actual[1])) return { error: 'Puntaje del set en curso no válido' };
  }
  const detalle = actual ? [...cerrados, actual] : cerrados;
  return {
    detalle, sets1, sets2, decidido,
    puntos1: detalle.reduce((t, s) => t + s[0], 0),
    puntos2: detalle.reduce((t, s) => t + s[1], 0),
  };
}

// Separa un partido en curso en sets cerrados y set actual (inversa de lo que guarda validarMarcadorVivo)
export function marcadorDePartido(p) {
  const detalle = Array.isArray(p.detalle_sets) ? p.detalle_sets : [];
  const nCerrados = (p.sets_pareja1 || 0) + (p.sets_pareja2 || 0);
  return { cerrados: detalle.slice(0, nCerrados), actual: detalle[nCerrados] || null };
}

// ¿Ganó la pareja 1? Con sets decide la cantidad de sets; sin sets (set único), los puntos
export function ganaPareja1(p) {
  return p.sets_pareja1 !== null && p.sets_pareja1 !== undefined
    ? p.sets_pareja1 > p.sets_pareja2
    : p.puntos_pareja1 > p.puntos_pareja2;
}

export function ganadorPartido(p) {
  if (!p?.jugado) return null;
  return ganaPareja1(p)
    ? { id: p.pareja1_id, nombre: p.nombre_pareja1 }
    : { id: p.pareja2_id, nombre: p.nombre_pareja2 };
}

// "15-10 · 12-15 · 15-13" desde el punto de vista de pareja 1 / pareja 2
export function textoSets(p) {
  return Array.isArray(p.detalle_sets) ? p.detalle_sets.map(([a, b]) => `${a}-${b}`).join(' · ') : '';
}
