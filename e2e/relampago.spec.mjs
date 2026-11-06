// Flujo completo del Campeonato Relámpago desde el panel de admin
import { test, expect } from '@playwright/test';
import { crearTorneoPrueba, eliminarTorneoPrueba, iniciarSesion, datosTorneo, huella, PAREJAS, ESCENARIO_DESEMPATE } from './utilidades.mjs';

let torneo;
let huellaMary;

test.beforeAll(async ({ request }) => {
  huellaMary = await huella(request, 'campeonato-mary');
  torneo = await crearTorneoPrueba(request);
});

test.afterAll(async ({ request }) => {
  await eliminarTorneoPrueba(request, torneo);
  // El torneo anterior no se toca en ningún momento
  expect(await huella(request, 'campeonato-mary')).toBe(huellaMary);
});

test('sin sesión, el panel pide clave y las APIs rechazan escrituras', async ({ page, request }) => {
  await page.goto(`/t/${torneo.slug}/admin`);
  await expect(page).toHaveURL(new RegExp(`/t/${torneo.slug}/login\\?rol=admin`));

  await page.getByTestId('login-clave').fill('clave-mala');
  await page.getByTestId('login-entrar').click();
  await expect(page.locator('p[role=alert]')).toHaveText('Clave incorrecta');

  const { partidos } = await datosTorneo(request, torneo.slug);
  const res = await request.put('/api/partidos', { data: { torneo_id: torneo.id, id: partidos[0].id, sets: [[15, 1], [15, 1]] } });
  expect(res.status()).toBe(401);

  // La clave de árbitro no abre el panel de admin
  await page.getByTestId('login-clave').fill('2222');
  await page.getByTestId('login-entrar').click();
  await expect(page.locator('p[role=alert]')).toHaveText('Clave incorrecta');
});

test('liga completa con desempates, final y campeón', async ({ page, context }) => {
  await page.goto(`/t/${torneo.slug}/login?rol=admin`);
  await page.getByTestId('login-clave').fill('1111');
  await page.getByTestId('login-entrar').click();
  await expect(page).toHaveURL(new RegExp(`/t/${torneo.slug}/admin$`));

  // Vista pública abierta en paralelo: debe actualizarse sola, sin recargar
  const publica = await context.newPage();
  await publica.goto(`/t/${torneo.slug}`);
  await expect(publica.getByText('En vivo', { exact: true })).toBeVisible();

  const { partidos } = await datosTorneo(page.request, torneo.slug);
  const liga = partidos.filter(p => p.fase === 'liga');

  // Validación: 2-0 y además un tercer set → error claro
  const dialogos = [];
  page.on('dialog', d => { dialogos.push(d.message()); d.accept(); });
  const primero = liga[0];
  for (const [i, [a, b]] of [[15, 10], [15, 12], [15, 3]].entries()) {
    await page.getByTestId(`set-${primero.id}-${i + 1}-1`).fill(String(a));
    await page.getByTestId(`set-${primero.id}-${i + 1}-2`).fill(String(b));
  }
  await page.getByTestId(`guardar-${primero.id}`).click();
  await expect.poll(() => dialogos.at(-1)).toContain('ya estaba decidido');
  await page.getByTestId(`set-${primero.id}-3-1`).fill('');
  await page.getByTestId(`set-${primero.id}-3-2`).fill('');

  // Cargar los 6 partidos del escenario de desempate
  for (const [n, p] of liga.entries()) {
    for (const [i, [a, b]] of ESCENARIO_DESEMPATE[n].entries()) {
      await page.getByTestId(`set-${p.id}-${i + 1}-1`).fill(String(a));
      await page.getByTestId(`set-${p.id}-${i + 1}-2`).fill(String(b));
    }
    await page.getByTestId(`guardar-${p.id}`).click();
    await expect(page.getByTestId(`guardar-${p.id}`)).toHaveText('Corregir');
  }

  // Tabla: A gana por diferencia de sets; C supera a B por diferencia de puntos
  await page.getByTestId('tab-tabla').click();
  const filas = page.getByTestId('fila-tabla');
  await expect(filas.getByTestId('nombre-pareja')).toHaveText([PAREJAS[0], PAREJAS[2], PAREJAS[1], PAREJAS[3]]);
  await expect(filas.getByTestId('puntos')).toHaveText(['4', '4', '4', '0']);
  await expect(filas.getByTestId('dif-sets')).toHaveText(['+3', '+1', '+1', '-5']);
  await expect(filas.getByTestId('dif-puntos')).toHaveText(['+12', '+11', '-2', '-21']);

  // La vista pública ya refleja la tabla sin recargar
  await publica.getByRole('button', { name: 'Tabla' }).click();
  await expect(publica.locator('tbody tr').first()).toContainText(PAREJAS[0]);
  await expect(publica.locator('tbody tr').nth(1)).toContainText(PAREJAS[2]);

  // Final: 1° vs 2°, al mejor de 3 a 21
  await page.getByTestId('tab-final').click();
  await page.getByTestId('armar-final').click();
  await expect(page.getByText('Partido por el campeonato')).toBeVisible();
  const final = (await datosTorneo(page.request, torneo.slug)).partidos.find(p => p.fase === 'final');
  expect([final.nombre_pareja1, final.nombre_pareja2]).toEqual([PAREJAS[0], PAREJAS[2]]);

  for (const [i, [a, b]] of [[21, 18], [19, 21], [21, 15]].entries()) {
    await page.getByTestId(`set-${final.id}-${i + 1}-1`).fill(String(a));
    await page.getByTestId(`set-${final.id}-${i + 1}-2`).fill(String(b));
  }
  await page.getByTestId(`guardar-${final.id}`).click();
  await expect(page.getByTestId('campeon')).toHaveText(PAREJAS[0]);

  await publica.getByRole('button', { name: 'Resumen' }).click();
  await expect(publica.getByText('🏆 Campeón')).toBeVisible();
  await expect(publica.getByRole('heading', { name: PAREJAS[0] })).toBeVisible();
});
