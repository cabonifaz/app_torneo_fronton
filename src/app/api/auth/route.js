import { NextResponse } from 'next/server';
import { resolverTorneo, obtenerClaves } from '../../../lib/torneo';
import {
  COOKIE_SUPER, cookieTorneo, crearToken, opcionesCookie, verificarClave, verificarClaveSuper,
  registrarIntento, limpiarIntentos,
} from '../../../lib/auth';

const ROLES = ['admin', 'arbitro', 'super'];
const ip = request => request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';

// POST { rol: 'admin' | 'arbitro' | 'super', slug?, clave }
export async function POST(request) {
  try {
    const { rol, slug, clave } = await request.json();
    if (!ROLES.includes(rol)) return NextResponse.json({ error: 'Rol no válido' }, { status: 400 });

    const claveIntentos = `${ip(request)}|${rol}|${slug || ''}`;
    if (!registrarIntento(claveIntentos)) {
      return NextResponse.json({ error: 'Demasiados intentos. Espera unos minutos.' }, { status: 429 });
    }

    if (rol === 'super') {
      if (!verificarClaveSuper(clave)) return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 });
      limpiarIntentos(claveIntentos);
      const token = crearToken('super');
      const res = NextResponse.json({ ok: true });
      res.cookies.set(COOKIE_SUPER, token.valor, opcionesCookie(token.maxAge));
      return res;
    }

    const torneo = slug ? await resolverTorneo(slug) : null;
    if (!torneo) return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 });
    const claves = await obtenerClaves(torneo.id);
    const guardada = rol === 'admin' ? claves.clave_admin : claves.clave_arbitro;
    if (!guardada) return NextResponse.json({ error: 'Este acceso aún no tiene clave. Pídela al super admin.' }, { status: 403 });
    // La clave de admin también abre la pantalla del árbitro (el admin puede arbitrar)
    const valida = verificarClave(clave, guardada) || (rol === 'arbitro' && verificarClave(clave, claves.clave_admin));
    if (!valida) return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 });

    limpiarIntentos(claveIntentos);
    const rolFinal = rol === 'arbitro' && verificarClave(clave, claves.clave_admin) ? 'admin' : rol;
    const token = crearToken(rolFinal, torneo.id);
    const res = NextResponse.json({ ok: true, rol: rolFinal });
    res.cookies.set(cookieTorneo(torneo.id), token.valor, opcionesCookie(token.maxAge));
    return res;
  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE { torneo_id? } → cierra la sesión del torneo (o la de super admin si no se indica torneo)
export async function DELETE(request) {
  const { torneo_id } = await request.json().catch(() => ({}));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(torneo_id ? cookieTorneo(torneo_id) : COOKIE_SUPER, '', opcionesCookie(0));
  return res;
}
