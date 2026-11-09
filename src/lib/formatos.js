// Formatos de torneo soportados y reglas de puntuación (sin dependencias de servidor: se usan en el navegador)

// Regla de una fase: mejorDe (1, 3 o 5 sets), puntosSet (a cuántos puntos se juega el set),
// ventaja (1 = seco: gana el primero que llega · 2 = hay que ganar por 2 desde puntosSet),
// maximo (solo con ventaja 2: tope de puntos, el primero que llega al tope gana · null = sin tope).
// Cada torneo puede cambiar estos valores por fase (columna torneo.reglas); si no, rigen los del formato.
export const FORMATOS = {
  // Campeonato Mary: 4 grupos de 4 → 2 series de 4 → semifinal → final, todo a set único de 21
  ranked16: {
    nombre: 'Ranked 16 parejas',
    fases: {
      grupos: { mejorDe: 1, puntosSet: 21, ventaja: 1, maximo: null },
      cuartos: { mejorDe: 1, puntosSet: 21, ventaja: 1, maximo: null },
      semifinal: { mejorDe: 1, puntosSet: 21, ventaja: 1, maximo: null },
      final: { mejorDe: 1, puntosSet: 21, ventaja: 1, maximo: null },
    },
  },
  // Campeonato Relámpago: 4 parejas todos contra todos (2 canchas) → final entre las 2 mejores
  relampago4: {
    nombre: 'Relámpago 4 parejas',
    fases: {
      liga: { mejorDe: 3, puntosSet: 15, ventaja: 1, maximo: null },
      final: { mejorDe: 3, puntosSet: 21, ventaja: 1, maximo: null },
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

const REGLA_BASE = { mejorDe: 1, puntosSet: 21, ventaja: 1, maximo: null };

// Reglas propias del torneo (la columna JSON puede llegar como objeto o como texto)
export function reglasDeTorneo(torneo) {
  const r = torneo?.reglas;
  if (!r) return {};
  if (typeof r === 'string') { try { return JSON.parse(r) || {}; } catch { return {}; } }
  return typeof r === 'object' ? r : {};
}

// Reglas vigentes de una fase: base ← formato ← ajustes del torneo. Acepta el torneo o solo el nombre del formato.
export function reglasFase(torneo, fase) {
  const formato = typeof torneo === 'string' ? torneo : torneo?.formato;
  const propias = typeof torneo === 'object' ? reglasDeTorneo(torneo)[fase] : null;
  return { ...REGLA_BASE, ...(FORMATOS[formato]?.fases[fase] || {}), ...(propias || {}) };
}

// Valida las reglas que manda el admin y devuelve { error } o { reglas } listas para guardar
export function normalizarReglas(entrada, formato) {
  const fases = FORMATOS[formato]?.fases;
  if (!fases) return { error: 'Formato de torneo desconocido' };
  if (!entrada || typeof entrada !== 'object') return { error: 'Reglas no válidas' };
  const salida = {};
  for (const [fase, r] of Object.entries(entrada)) {
    if (!fases[fase]) return { error: `Fase desconocida: ${fase}` };
    const nombre = ETIQUETAS_FASE[fase] || fase;
    const mejorDe = Number(r?.mejorDe), puntosSet = Number(r?.puntosSet), ventaja = Number(r?.ventaja ?? 1);
    const sinTope = r?.maximo === null || r?.maximo === undefined || r?.maximo === '';
    const maximo = sinTope ? null : Number(r.maximo);
    if (![1, 3, 5].includes(mejorDe)) return { error: `${nombre}: el partido debe ser al mejor de 1, 3 o 5 sets.` };
    if (!Number.isInteger(puntosSet) || puntosSet < 5 || puntosSet > 50) return { error: `${nombre}: el set debe ser a entre 5 y 50 puntos.` };
    if (![1, 2].includes(ventaja)) return { error: `${nombre}: el cierre debe ser seco o con ventaja de 2.` };
    if (ventaja === 2 && maximo !== null && (!Number.isInteger(maximo) || maximo <= puntosSet || maximo > 99)) {
      return { error: `${nombre}: el tope debe ser mayor que ${puntosSet} (o vacío para jugar sin tope).` };
    }
    salida[fase] = { mejorDe, puntosSet, ventaja, maximo: ventaja === 2 ? maximo : null };
  }
  return { reglas: salida };
}

// ¿Quién ganó el set con este marcador según la regla? 0 | 1 | null (sigue en juego)
export function setGanado(marcador, { puntosSet, ventaja = 1, maximo = null }) {
  if (!Array.isArray(marcador)) return null;
  const [a, b] = marcador;
  const lider = a > b ? 0 : b > a ? 1 : null;
  if (lider === null) return null;
  const [mas, menos] = lider === 0 ? [a, b] : [b, a];
  if (mas < puntosSet) return null;
  if (ventaja <= 1 || mas - menos >= ventaja) return lider;
  if (maximo && mas >= maximo) return lider;
  return null;
}

// Situación del set en curso para avisar al árbitro y al público.
// → null | { codigo: 'ganado', lado, decisivo } | { codigo: 'punto', puntos: [{ lado, decisivo }] } | { codigo: 'iguales', texto }
// `setsGanados` = [sets de la pareja 1, sets de la pareja 2]: decide si el punto/set es también de partido.
export function situacionSet(actual, reglas, setsGanados = [0, 0]) {
  if (!Array.isArray(actual)) return null;
  const necesarios = Math.ceil((reglas.mejorDe || 1) / 2);
  const decisivo = lado => (setsGanados[lado] || 0) + 1 >= necesarios;
  const ganado = setGanado(actual, reglas);
  if (ganado !== null) return { codigo: 'ganado', lado: ganado, decisivo: decisivo(ganado) };
  const puntos = [0, 1]
    .filter(lado => setGanado(lado === 0 ? [actual[0] + 1, actual[1]] : [actual[0], actual[1] + 1], reglas) === lado)
    .map(lado => ({ lado, decisivo: decisivo(lado) }));
  if (puntos.length) return { codigo: 'punto', puntos };
  if (reglas.ventaja > 1 && actual[0] === actual[1] && actual[0] >= reglas.puntosSet - 1) {
    return { codigo: 'iguales', texto: `Iguales a ${actual[0]} · se gana por ${reglas.ventaja}${reglas.maximo ? ` (tope ${reglas.maximo})` : ''}` };
  }
  return null;
}

// Texto corto de la situación: "Punto de set · Los Veteranos", "Punto de partido para ambos", "Set ganado · …"
export function textoSituacion(sit, nombres = ['Pareja 1', 'Pareja 2']) {
  if (!sit) return '';
  if (sit.codigo === 'iguales') return sit.texto;
  if (sit.codigo === 'ganado') return `${sit.decisivo ? 'Partido ganado' : 'Set ganado'} · ${nombres[sit.lado]}`;
  const etiqueta = p => (p.decisivo ? 'Punto de partido' : 'Punto de set');
  if (sit.puntos.length === 2 && sit.puntos[0].decisivo === sit.puntos[1].decisivo) return `${etiqueta(sit.puntos[0])} para ambos`;
  return sit.puntos.map(p => `${etiqueta(p)} · ${nombres[p.lado]}`).join(' / ');
}

// Cómo se cierra el set, en palabras: "a 15, gana el primero que llega" · "a 15, se gana por 2 (tope 20)"
export function textoCierre({ puntosSet, ventaja = 1, maximo = null }) {
  if (ventaja <= 1) return `a ${puntosSet}, gana el primero que llega`;
  return `a ${puntosSet}, se gana por ${ventaja}${maximo ? ` (tope ${maximo})` : ', sin tope'}`;
}
// Versión mínima para etiquetas: "a 15 seco" · "a 15 +2 · tope 20"
export function textoCierreCorto({ puntosSet, ventaja = 1, maximo = null }) {
  if (ventaja <= 1) return `a ${puntosSet} seco`;
  return `a ${puntosSet} +${ventaja}${maximo ? ` · tope ${maximo}` : ''}`;
}
// Regla completa: "Mejor de 3 sets a 15, se gana por 2 (tope 20)"
export function textoReglas(r) {
  return `${r.mejorDe === 1 ? 'Set único' : `Mejor de ${r.mejorDe} sets`} ${textoCierre(r)}`;
}

// Valida los sets de un partido al mejor de N.
// `sets` es una lista de [puntos pareja 1, puntos pareja 2]; los sets vacíos (null/'') al final se ignoran.
// Devuelve { error } o { sets, sets1, sets2, puntos1, puntos2, avisos }.
export function validarSets(sets, reglas) {
  const { mejorDe } = reglas;
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

  // Un set que no cierra según la regla se acepta (abandono, acuerdo…) pero se avisa
  const avisos = jugados
    .map(([a, b], i) => (setGanado([a, b], reglas) === null ? `Set ${i + 1}: ${a}-${b} no cierra el set (es ${textoCierre(reglas)}).` : null))
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
export function validarMarcadorVivo(marcador, reglas) {
  const { mejorDe } = reglas;
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
    // El set en curso no puede seguir después de ganado: con un punto menos del líder ya debía estar cerrado
    const lider = actual[0] > actual[1] ? 0 : actual[1] > actual[0] ? 1 : null;
    if (lider !== null) {
      const previo = lider === 0 ? [actual[0] - 1, actual[1]] : [actual[0], actual[1] - 1];
      if (setGanado(previo, reglas) !== null) return { error: `El set ya estaba ganado ${previo[0]}-${previo[1]}: ciérralo o corrige el puntaje` };
    }
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

// ── Cronómetro por set ──
// Milisegundos transcurridos del set en curso según los campos del partido y la hora de referencia
export function tiempoSetActual(p, ahora = Date.now()) {
  const acumulado = p.reloj_acumulado || 0;
  return p.reloj_estado === 'en_juego' && p.reloj_inicio ? acumulado + Math.max(0, ahora - Number(p.reloj_inicio)) : acumulado;
}

export function formatearTiempo(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Estado legible para el público: por empezar / en juego / pausado / entre sets / finalizado.
// Con el torneo se añade `situacion` (punto de set, set ganado, iguales) según la regla de la fase.
export function estadoPartido(p, ahora = Date.now(), torneo = null) {
  if (p.jugado === 1) return { codigo: 'finalizado', texto: 'Finalizado' };
  if (!p.pareja1_id || !p.pareja2_id) return { codigo: 'por_definir', texto: 'Por definir' };
  const m = marcadorDePartido(p);
  const setN = m.cerrados.length + 1;
  const tiempo = formatearTiempo(tiempoSetActual(p, ahora));
  const reglas = torneo ? reglasFase(torneo, p.fase) : null;
  const situacion = reglas && m.actual ? situacionSet(m.actual, reglas, [p.sets_pareja1 || 0, p.sets_pareja2 || 0]) : null;
  if (p.reloj_estado === 'en_juego') return { codigo: 'en_juego', texto: `En juego · Set ${setN} · ${tiempo}`, tiempo, setN, situacion, reglas };
  if (p.reloj_estado === 'pausado') return { codigo: 'pausado', texto: `Pausado · Set ${setN} · ${tiempo}`, tiempo, setN, situacion, reglas };
  if (p.reloj_estado === 'entre_sets' || m.cerrados.length > 0) return { codigo: 'entre_sets', texto: `Set ${m.cerrados.length} terminado · por empezar el set ${setN}`, setN, reglas };
  return { codigo: 'por_empezar', texto: 'Por empezar', setN, reglas };
}
