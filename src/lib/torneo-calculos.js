// Cálculos derivados del estado del torneo (sin dependencias de servidor: se usan en el navegador)

export const FASES = {
  grupos: 'Fase 1 · Grupos',
  cuartos: 'Fase 2 · Series',
  semifinal: 'Semifinal',
  final: 'Final',
};

// Orden de juego dentro de un grupo de 4 para dar descanso entre partidos.
// En BD: 0(1-2) 1(1-3) 2(1-4) 3(2-3) 4(2-4) 5(3-4) → se juega 1-2, 3-4, 1-3, 2-4, 1-4, 2-3
const ORDEN_RONDA = [0, 5, 1, 4, 2, 3];

export const ordenarPosiciones = (a, b) => b.pg - a.pg || b.diferencia_puntos - a.diferencia_puntos;

export function ordenarPartidosGrupo(partidos) {
  return partidos.length === 6 ? ORDEN_RONDA.map(i => partidos[i]) : partidos;
}

export const nombresGrupos = (partidos, fase) => [...new Set(partidos.filter(p => p.fase === fase).map(p => p.nombre_grupo))];

export function ganador(partido) {
  if (!partido?.jugado) return null;
  return partido.puntos_pareja1 > partido.puntos_pareja2
    ? { id: partido.pareja1_id, nombre: partido.nombre_pareja1 }
    : { id: partido.pareja2_id, nombre: partido.nombre_pareja2 };
}

// Tabla de un grupo o serie, con partidos jugados por pareja
export function tablaGrupo(datos, nombreGrupo) {
  const partidosGrupo = datos.partidos.filter(p => p.nombre_grupo === nombreGrupo);
  return datos.posiciones
    .filter(p => p.nombre_grupo === nombreGrupo)
    .sort(ordenarPosiciones)
    .map(pos => ({
      ...pos,
      pj: partidosGrupo.filter(p => p.jugado === 1 && (p.pareja1_id === pos.pareja_id || p.pareja2_id === pos.pareja_id)).length,
    }));
}

export function resumenTorneo(datos) {
  const { partidos } = datos;
  const deFase = fase => partidos.filter(p => p.fase === fase);
  const terminada = lista => lista.length > 0 && lista.every(p => p.jugado === 1);

  const grupos = nombresGrupos(partidos, 'grupos');
  const series = nombresGrupos(partidos, 'cuartos');
  const semis = deFase('semifinal');
  const final = deFase('final')[0] || null;

  const clasificadosFase1 = grupos.flatMap(g => tablaGrupo(datos, g).slice(0, 2).map((p, i) => ({ ...p, puesto: i + 1 })));
  const [serie1, serie2] = series.map(s => tablaGrupo(datos, s));
  const seriesTerminadas = terminada(deFase('cuartos'));

  // Cruces de semifinal: 1° S1 vs 2° S2 y 1° S2 vs 2° S1 (provisionales hasta que se creen en BD)
  const crucesSemis = [
    { etiqueta1: `1° ${series[0] || 'Serie 1'}`, etiqueta2: `2° ${series[1] || 'Serie 2'}`, pareja1: serie1?.[0], pareja2: serie2?.[1] },
    { etiqueta1: `1° ${series[1] || 'Serie 2'}`, etiqueta2: `2° ${series[0] || 'Serie 1'}`, pareja1: serie2?.[0], pareja2: serie1?.[1] },
  ].map((cruce, i) => ({ ...cruce, partido: semis[i] || null, definitivo: seriesTerminadas }));

  let faseActual = 'grupos';
  if (final) faseActual = 'final';
  else if (semis.length) faseActual = 'semifinal';
  else if (deFase('cuartos').some(p => p.pareja1_id)) faseActual = 'cuartos';

  const partidosFase = deFase(faseActual);
  const campeon = final?.jugado ? ganador(final) : null;

  // Próximos: en grupos/series, el siguiente pendiente de cada uno según el orden de juego
  const pendientes = p => p.pareja1_id && p.pareja2_id && !p.jugado;
  const proximos = ['grupos', 'cuartos'].includes(faseActual)
    ? nombresGrupos(partidos, faseActual).flatMap(g => ordenarPartidosGrupo(partidos.filter(p => p.nombre_grupo === g)).filter(pendientes).slice(0, 1))
    : partidosFase.filter(pendientes);

  const ultimos = partidos
    .filter(p => p.jugado === 1)
    .sort((a, b) => new Date(b.actualizado_en || 0) - new Date(a.actualizado_en || 0) || b.id - a.id)
    .slice(0, 6);

  return {
    grupos, series, semis, final, campeon, faseActual,
    progreso: { jugados: partidosFase.filter(p => p.jugado === 1).length, total: partidosFase.length },
    fase1Terminada: terminada(deFase('grupos')),
    clasificadosFase1, crucesSemis, proximos, ultimos,
  };
}
