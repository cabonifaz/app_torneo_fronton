import { NextResponse } from 'next/server';
import { obtenerDatosTorneo, resolverTorneo } from '../../../lib/torneo';

export const dynamic = 'force-dynamic';

// GET /api/torneo?torneo=<slug>  (sin slug: el torneo más reciente)
export async function GET(request) {
  try {
    const torneo = await resolverTorneo(request.nextUrl.searchParams.get('torneo'));
    if (!torneo) return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 });
    return NextResponse.json(await obtenerDatosTorneo(torneo.id));
  } catch (error) {
    console.error("Detalle del error SQL:", error);
    return NextResponse.json({ error: 'Error al cargar datos' }, { status: 500 });
  }
}
