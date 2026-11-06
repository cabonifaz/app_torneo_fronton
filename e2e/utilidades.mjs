import { expect } from '@playwright/test';

export const CLAVES = { admin: '1111', arbitro: '2222' };
// Parejas que crea el playground, en orden: A, B, C, D
export const PAREJAS = ['Los Veteranos', 'Dupla Capullana', 'Revés de Oro', 'Pared Firme'];

// Escenario de desempate (mismo que el playground): orden esperado A, C, B, D
export const ESCENARIO_DESEMPATE = [
  [[15, 10], [15, 12]],
  [[15, 8], [10, 15], [15, 9]],
  [[15, 13], [11, 15], [13, 15]],
  [[15, 12], [15, 13]],
  [[15, 11], [15, 11]],
  [[15, 14], [14, 15], [15, 14]],
];

export async function crearTorneoPrueba(request) {
  const res = await request.post('/api/playground', { data: { accion: 'crear' } });
  expect(res.ok(), 'El playground debe estar habilitado (PLAYGROUND_HABILITADO=1)').toBeTruthy();
  return res.json(); // { id, slug }
}

export async function eliminarTorneoPrueba(request, torneo) {
  if (torneo) await request.post('/api/playground', { data: { accion: 'eliminar', torneo_id: torneo.id } });
}

// Inicia sesión por API: la cookie queda en el contexto del navegador de la página
export async function iniciarSesion(page, slug, rol) {
  const res = await page.request.post('/api/auth', { data: { rol, slug, clave: CLAVES[rol] } });
  expect(res.ok()).toBeTruthy();
}

export async function datosTorneo(request, slug) {
  return (await request.get(`/api/torneo?torneo=${slug}`)).json();
}

// Firma estable de un torneo para comprobar que no cambió
export async function huella(request, slug) {
  const d = await datosTorneo(request, slug);
  return JSON.stringify(d.partidos.map(p => [p.id, p.pareja1_id, p.pareja2_id, p.puntos_pareja1, p.puntos_pareja2, p.jugado, p.en_juego]));
}

// Marca las guías como ya vistas (si no, la guía de la primera vez cubre la pantalla)
export async function saltarGuias(context) {
  await context.addInitScript(() => {
    for (const id of ['admin-relampago', 'arbitro-lista', 'arbitro-marcador', 'superadmin']) {
      try { localStorage.setItem(`ranked_guia_${id}_v1`, '1'); } catch {}
    }
  });
}
