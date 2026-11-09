import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';
import { obtenerTorneoPorId } from '../../../../lib/torneo';
import { rolEnTorneo, puedeAdministrar } from '../../../../lib/auth';
import { normalizarReglas } from '../../../../lib/formatos';
import { notificarCambio } from '../../../../lib/torneo-en-vivo';

export const dynamic = 'force-dynamic';
const error = (mensaje, status = 400) => NextResponse.json({ error: mensaje }, { status });

// PUT { torneo_id, reglas: { [fase]: { mejorDe, puntosSet, ventaja, maximo } } }
// Guarda las reglas de puntuación del torneo (admin o super admin). Con `reglas: null` vuelve a las del formato.
// No toca resultados ya guardados; el árbitro y el público reciben el cambio al instante por la transmisión.
export async function PUT(request) {
  try {
    const body = await request.json();
    const torneo = await obtenerTorneoPorId(Number(body.torneo_id));
    if (!torneo) return error('Torneo no válido');
    const rol = await rolEnTorneo(torneo.id);
    if (!puedeAdministrar(rol)) return error(rol ? 'Solo el admin puede cambiar las reglas' : 'Inicia sesión para continuar', rol ? 403 : 401);

    let guardar = null;
    if (body.reglas !== null) {
      const v = normalizarReglas(body.reglas, torneo.formato);
      if (v.error) return error(v.error);
      guardar = JSON.stringify(v.reglas);
    }
    await pool.query('UPDATE torneo SET reglas = ? WHERE id = ?', [guardar, torneo.id]);
    notificarCambio(torneo.id);
    return NextResponse.json({ ok: true, reglas: guardar ? JSON.parse(guardar) : null });
  } catch (e) {
    console.error('Error al guardar reglas:', e);
    return error('Error interno', 500);
  }
}
