// Autenticación: claves por torneo (admin / árbitro) y super admin global.
// Las sesiones son cookies httpOnly firmadas con HMAC (AUTH_SECRET); no se guardan en BD.
import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';
import { cookies } from 'next/headers';

const DURACION_S = { super: 12 * 3600, admin: 24 * 3600, arbitro: 24 * 3600 };
export const COOKIE_SUPER = 'ranked_super';
export const cookieTorneo = torneoId => `ranked_t${Number(torneoId)}`;

function secreto() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('Falta AUTH_SECRET (mínimo 32 caracteres)');
  return s;
}

// ── Claves (hash scrypt con sal) ──
export function hashClave(clave) {
  const sal = randomBytes(16).toString('hex');
  return `${sal}:${scryptSync(String(clave), sal, 32).toString('hex')}`;
}

export function verificarClave(clave, guardado) {
  if (!guardado || !clave) return false;
  const [sal, hash] = guardado.split(':');
  if (!sal || !hash) return false;
  const calculado = scryptSync(String(clave), sal, 32);
  const esperado = Buffer.from(hash, 'hex');
  return esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
}

export function verificarClaveSuper(clave) {
  const real = process.env.SUPERADMIN_CLAVE;
  if (!real || !clave) return false;
  // Comparar hashes de igual longitud evita filtrar la longitud de la clave
  const a = createHash('sha256').update(String(clave)).digest();
  const b = createHash('sha256').update(real).digest();
  return timingSafeEqual(a, b);
}

// ── Tokens de sesión: base64url(json).firma ──
const firmar = datos => createHmac('sha256', secreto()).update(datos).digest('base64url');

export function crearToken(rol, torneoId = null) {
  const datos = Buffer.from(JSON.stringify({ rol, t: torneoId, exp: Math.floor(Date.now() / 1000) + DURACION_S[rol] })).toString('base64url');
  return { valor: `${datos}.${firmar(datos)}`, maxAge: DURACION_S[rol] };
}

function leerToken(valor) {
  if (!valor || !valor.includes('.')) return null;
  const [datos, firma] = valor.split('.');
  const esperada = Buffer.from(firmar(datos));
  const recibida = Buffer.from(firma || '');
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const sesion = JSON.parse(Buffer.from(datos, 'base64url').toString());
    return sesion.exp > Date.now() / 1000 ? sesion : null;
  } catch {
    return null;
  }
}

export const opcionesCookie = maxAge => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});

// Rol efectivo sobre un torneo: 'super' | 'admin' | 'arbitro' | null
export async function rolEnTorneo(torneoId) {
  const almacen = await cookies();
  if (leerToken(almacen.get(COOKIE_SUPER)?.value)?.rol === 'super') return 'super';
  if (torneoId == null) return null;
  const sesion = leerToken(almacen.get(cookieTorneo(torneoId))?.value);
  return sesion && Number(sesion.t) === Number(torneoId) ? sesion.rol : null;
}

export const esSuper = async () => (await rolEnTorneo(null)) === 'super';

// Permisos: el admin (y el super) pueden todo en su torneo; el árbitro solo cargar marcadores
export const puedeAdministrar = rol => rol === 'super' || rol === 'admin';
export const puedeArbitrar = rol => puedeAdministrar(rol) || rol === 'arbitro';

// ── Límite de intentos de login (en memoria, por IP y destino) ──
const intentos = globalThis.__intentosLogin ??= new Map();
const VENTANA_MS = 10 * 60 * 1000;
const MAX_INTENTOS = 8;

export function registrarIntento(clave) {
  const ahora = Date.now();
  const lista = (intentos.get(clave) || []).filter(t => ahora - t < VENTANA_MS);
  lista.push(ahora);
  intentos.set(clave, lista);
  return lista.length <= MAX_INTENTOS;
}
export const limpiarIntentos = clave => intentos.delete(clave);
