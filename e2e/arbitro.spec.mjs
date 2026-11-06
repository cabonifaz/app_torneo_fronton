// Pantalla del árbitro (se ejecuta también con viewport de móvil): marcador punto a punto en vivo
import { test, expect } from '@playwright/test';
import { crearTorneoPrueba, eliminarTorneoPrueba, datosTorneo, saltarGuias, PAREJAS } from './utilidades.mjs';

let torneo;
test.beforeAll(async ({ request }) => { torneo = await crearTorneoPrueba(request); });
test.afterAll(async ({ request }) => { await eliminarTorneoPrueba(request, torneo); });

const sumar = async (page, lado, veces) => {
  for (let i = 0; i < veces; i++) await page.getByTestId(`arbitro-sumar-${lado}`).click();
};

test('el árbitro lleva un partido y la vista pública lo ve en vivo', async ({ page, browser }) => {
  await saltarGuias(page.context());
  // El árbitro solo con su clave: entra a su pantalla, pero no al panel de admin
  await page.goto(`/t/${torneo.slug}/arbitro`);
  await expect(page).toHaveURL(/login\?rol=arbitro/);
  await page.getByTestId('login-clave').fill('2222');
  await page.getByTestId('login-entrar').click();
  await expect(page.getByText('Árbitro · elige tu partido')).toBeVisible();
  const admin = await page.request.post('/api/partidos', { data: { torneo_id: torneo.id, fase: 'final', pareja1_id: 1, pareja2_id: 2 } });
  expect(admin.status()).toBe(403);

  // Espectador en otro navegador (sin sesión)
  const espectador = await (await browser.newContext()).newPage();
  await espectador.goto(`/t/${torneo.slug}`);

  const { partidos } = await datosTorneo(page.request, torneo.slug);
  const partido = partidos.find(p => p.fase === 'liga');
  await page.getByTestId(`arbitro-partido-${partido.id}`).click();

  // Set 1: 15-9 con un error corregido con "−" y otro con "Deshacer"
  await sumar(page, 1, 15);
  await sumar(page, 2, 10);
  await page.getByTestId('arbitro-restar-2').click();
  await expect(page.getByTestId('arbitro-puntos-2')).toHaveText('9');
  await sumar(page, 1, 1);
  await page.getByTestId('arbitro-deshacer').click();
  await expect(page.getByTestId('arbitro-puntos-1')).toHaveText('15');
  await expect(page.getByTestId('arbitro-estado')).toHaveText('✓ Guardado');

  // El espectador ve el partido en juego y el marcador, sin recargar
  await expect(espectador.getByText(/En juego/).first()).toBeVisible();
  await expect(espectador.locator('li', { hasText: PAREJAS[0] }).first()).toContainText('15');

  await page.getByTestId('arbitro-cerrar-set').click();
  await expect(page.getByTestId('arbitro-puntos-1')).toHaveText('0');

  // Set 2: 15-13 → partido decidido 2-0
  await sumar(page, 2, 13);
  await sumar(page, 1, 15);
  await page.getByTestId('arbitro-cerrar-set').click();
  page.once('dialog', d => d.accept());
  await page.getByTestId('arbitro-finalizar').click();
  await expect(page.getByTestId('arbitro-terminado')).toContainText(PAREJAS[0]);

  const guardado = (await datosTorneo(page.request, torneo.slug)).partidos.find(p => p.id === partido.id);
  expect(guardado).toMatchObject({ jugado: 1, en_juego: 0, sets_pareja1: 2, sets_pareja2: 0, detalle_sets: [[15, 9], [15, 13]] });

  // Con el partido finalizado el árbitro ya no puede modificarlo
  const tarde = await page.request.put('/api/partidos', { data: { torneo_id: torneo.id, id: partido.id, marcador_vivo: { cerrados: [], actual: [1, 0] } } });
  expect(tarde.status()).toBe(409);

  // El espectador ve el resultado final en la tabla
  await espectador.getByRole('button', { name: 'Tabla' }).click();
  await expect(espectador.locator('tbody tr').first()).toContainText(PAREJAS[0]);
});
