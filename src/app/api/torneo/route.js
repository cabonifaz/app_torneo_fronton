import { NextResponse } from 'next/server';
import { obtenerDatosTorneo } from '../../../lib/torneo';

export async function GET() {
  try {
    return NextResponse.json(await obtenerDatosTorneo());
  } catch (error) {
    console.error("Detalle del error SQL:", error);
    return NextResponse.json({ error: 'Error al cargar datos' }, { status: 500 });
  }
}
