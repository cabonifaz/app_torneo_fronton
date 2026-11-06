import { NextResponse } from 'next/server';
import { ejecutarAccion, listarTorneosPrueba, playgroundHabilitado, ErrorPlayground } from '../../../lib/playground';

export const dynamic = 'force-dynamic';

// Deshabilitado salvo PLAYGROUND_HABILITADO=1 (solo en .env.local; nunca en producción)
const noDisponible = () => NextResponse.json({ error: 'Playground deshabilitado' }, { status: 404 });

export async function GET() {
  if (!playgroundHabilitado()) return noDisponible();
  return NextResponse.json(await listarTorneosPrueba());
}

// POST { accion, torneo_id?, parejas? }
export async function POST(request) {
  if (!playgroundHabilitado()) return noDisponible();
  try {
    return NextResponse.json({ ok: true, ...(await ejecutarAccion(await request.json())) });
  } catch (error) {
    if (error instanceof ErrorPlayground) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[playground]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
