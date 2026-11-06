import pool from '../../../lib/db';
import { NextResponse } from 'next/server';
import { rolEnTorneo, puedeAdministrar } from '../../../lib/auth';
import { notificarCambio } from '../../../lib/torneo-en-vivo';

// PUT /api/parejas { torneo_id, id, nombre } → renombra una pareja (las inscripciones suelen llegar tarde)
export async function PUT(request) {
  try {
    const { torneo_id, id, nombre } = await request.json();
    if (!puedeAdministrar(await rolEnTorneo(torneo_id))) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    const limpio = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : '';
    if (!limpio || limpio.length > 150) return NextResponse.json({ error: 'Nombre no válido (1 a 150 caracteres)' }, { status: 400 });

    const [resultado] = await pool.query('UPDATE parejas SET nombre = ? WHERE id = ? AND torneo_id = ?', [limpio, id, torneo_id]);
    if (resultado.affectedRows === 0) return NextResponse.json({ error: 'Pareja no encontrada en este torneo' }, { status: 404 });
    notificarCambio(torneo_id);
    return NextResponse.json({ success: true, nombre: limpio });
  } catch (error) {
    console.error('Error renombrando pareja:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
