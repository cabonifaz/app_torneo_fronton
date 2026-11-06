import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';
import { esSuper, hashClave } from '../../../../lib/auth';
import { listarTorneosSuper, obtenerTorneoPorId } from '../../../../lib/torneo';
import { crearTorneoRelampago } from '../../../../lib/crear-torneo';
import { notificarCambio } from '../../../../lib/torneo-en-vivo';

export const dynamic = 'force-dynamic';

const error = (mensaje, status = 400) => NextResponse.json({ error: mensaje }, { status });
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const texto = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const claveValida = c => typeof c === 'string' && c.length >= 4 && c.length <= 64;

async function soloSuper() {
  return (await esSuper()) ? null : error('Solo el super admin', 401);
}

export async function GET() {
  const denegado = await soloSuper();
  if (denegado) return denegado;
  return NextResponse.json(await listarTorneosSuper());
}

// POST: crea un torneo (por ahora formato Relámpago de 4 parejas)
export async function POST(request) {
  const denegado = await soloSuper();
  if (denegado) return denegado;
  try {
    const b = await request.json();
    const nombre = texto(b.nombre, 150);
    const slug = texto(b.slug, 60)?.toLowerCase();
    if (!nombre) return error('Falta el nombre');
    if (!slug || slug.length < 3 || !SLUG.test(slug)) return error('El enlace solo admite minúsculas, números y guiones (mínimo 3)');
    if (b.formato && b.formato !== 'relampago4') return error('Por ahora solo se pueden crear torneos Relámpago (4 parejas)');
    const parejas = Array.isArray(b.parejas) ? b.parejas.map((p, i) => texto(p, 150) || `Pareja ${i + 1}`) : [];
    for (const [campo, valor] of [['admin', b.clave_admin], ['árbitro', b.clave_arbitro]]) {
      if (valor && !claveValida(valor)) return error(`La clave de ${campo} debe tener entre 4 y 64 caracteres`);
    }

    const torneo = await crearTorneoRelampago({
      slug, nombre,
      subtitulo: texto(b.subtitulo, 150),
      organizador: texto(b.organizador, 100),
      cancha: texto(b.cancha, 50),
      horario: texto(b.horario, 100),
      parejas: parejas.length === 4 ? parejas : ['Pareja 1', 'Pareja 2', 'Pareja 3', 'Pareja 4'],
      esPrueba: !!b.es_prueba,
    });
    await pool.query('UPDATE torneo SET clave_admin = ?, clave_arbitro = ? WHERE id = ?', [
      b.clave_admin ? hashClave(b.clave_admin) : null,
      b.clave_arbitro ? hashClave(b.clave_arbitro) : null,
      torneo.id,
    ]);
    return NextResponse.json({ ok: true, ...torneo });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return error('Ya existe un torneo con ese enlace');
    console.error('[superadmin] crear torneo:', e);
    return error('Error interno', 500);
  }
}

// PUT { id, nombre?, subtitulo?, organizador?, es_prueba?, clave_admin?, clave_arbitro? }
export async function PUT(request) {
  const denegado = await soloSuper();
  if (denegado) return denegado;
  try {
    const b = await request.json();
    const torneo = await obtenerTorneoPorId(Number(b.id));
    if (!torneo) return error('Torneo no encontrado', 404);

    const cambios = [];
    const valores = [];
    const poner = (columna, valor) => { cambios.push(`${columna} = ?`); valores.push(valor); };
    if (b.nombre !== undefined) { const v = texto(b.nombre, 150); if (!v) return error('El nombre no puede quedar vacío'); poner('nombre', v); }
    if (b.subtitulo !== undefined) poner('subtitulo', texto(b.subtitulo, 150));
    if (b.organizador !== undefined) poner('organizador', texto(b.organizador, 100));
    if (b.es_prueba !== undefined) poner('es_prueba', b.es_prueba ? 1 : 0);
    for (const [campo, columna] of [['clave_admin', 'clave_admin'], ['clave_arbitro', 'clave_arbitro']]) {
      if (b[campo] === undefined) continue;
      if (b[campo] === null) { poner(columna, null); continue; } // quita el acceso
      if (!claveValida(b[campo])) return error('Las claves deben tener entre 4 y 64 caracteres');
      poner(columna, hashClave(b[campo]));
    }
    if (!cambios.length) return error('Nada que cambiar');

    await pool.query(`UPDATE torneo SET ${cambios.join(', ')} WHERE id = ?`, [...valores, torneo.id]);
    notificarCambio(torneo.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[superadmin] editar torneo:', e);
    return error('Error interno', 500);
  }
}

// DELETE { id, confirmar } → borra el torneo y todo su contenido. `confirmar` debe ser su enlace (slug).
export async function DELETE(request) {
  const denegado = await soloSuper();
  if (denegado) return denegado;
  try {
    const { id, confirmar } = await request.json();
    const torneo = await obtenerTorneoPorId(Number(id));
    if (!torneo) return error('Torneo no encontrado', 404);
    if (confirmar !== torneo.slug) return error(`Para borrar escribe el enlace exacto: ${torneo.slug}`);
    await pool.query('DELETE FROM torneo WHERE id = ?', [torneo.id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[superadmin] borrar torneo:', e);
    return error('Error interno', 500);
  }
}
