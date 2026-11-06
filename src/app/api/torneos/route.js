import { NextResponse } from 'next/server';
import { listarTorneos } from '../../../lib/torneo';

export const dynamic = 'force-dynamic';

// GET /api/torneos → lista para el selector de torneos (?pruebas=1 incluye los de prueba)
export async function GET(request) {
  try {
    return NextResponse.json(await listarTorneos({ incluirPruebas: request.nextUrl.searchParams.get('pruebas') === '1' }));
  } catch (error) {
    console.error('Error listando torneos:', error);
    return NextResponse.json({ error: 'Error al listar torneos' }, { status: 500 });
  }
}
