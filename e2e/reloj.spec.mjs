// Cronómetro por set: lo controla el árbitro y el público ve el estado (por empezar / en juego / pausado / terminado)
import { test, expect } from '@playwright/test';
import { crearTorneoPrueba, eliminarTorneoPrueba, iniciarSesion, saltarGuias, datosTorneo } from './utilidades.mjs';

let torneo;
test.beforeAll(async ({ request }) => { torneo = await crearTorneoPrueba(request); });
test.afterAll(async ({ request }) => { await eliminarTorneoPrueba(request, torneo); });

const aSegundos = texto => { const [m, s] = texto.split(':').map(Number); return m * 60 + s; };

test('el reloj arranca con el primer punto, se pausa, se reanuda y guarda la duración del set', async ({ page, browser }) => {
  await saltarGuias(page.context());
  await iniciarSesion(page, torneo.slug, 'arbitro');
  const { partidos } = await datosTorneo(page.request, torneo.slug);
  const partido = partidos.find(p => p.fase === 'liga');

  const publico = await (await browser.newContext()).newPage();
  await publico.goto(`/t/${torneo.slug}`);
  await publico.getByRole('button', { name: 'Partidos' }).click();
  const tarjeta = publico.locator('li', { hasText: partido.nombre_pareja1 }).first();
  await expect(tarjeta.getByTestId('estado-partido')).toHaveText('Por empezar');

  await page.goto(`/t/${torneo.slug}/arbitro?partido=${partido.id}`);
  await expect(page.getByTestId('arbitro-tiempo')).toHaveText('0:00');
  await expect(page.getByTestId('arbitro-empezar')).toHaveText('▶ Empezar set');

  // El primer punto arranca el reloj sin tocar nada más
  await page.getByTestId('arbitro-sumar-1').click();
  await expect(page.getByTestId('arbitro-pausar')).toBeVisible();
  await expect(tarjeta.getByTestId('estado-partido')).toContainText('En juego · Set 1');
  await page.waitForTimeout(2200);
  await expect.poll(async () => aSegundos(await page.getByTestId('arbitro-tiempo').textContent())).toBeGreaterThanOrEqual(2);

  // Pausa: el tiempo se congela, los puntos quedan bloqueados y el público lo ve
  await page.getByTestId('arbitro-pausar').click();
  await expect(page.getByTestId('arbitro-empezar')).toHaveText('▶ Reanudar');
  const congelado = await page.getByTestId('arbitro-tiempo').textContent();
  await page.getByTestId('arbitro-sumar-1').click({ force: true }); // bloqueado por aria-disabled: un toque real no suma
  await expect(page.getByTestId('arbitro-puntos-1')).toHaveText('1');
  await expect(tarjeta.getByTestId('estado-partido')).toContainText('Pausado');
  await page.waitForTimeout(1500);
  expect(await page.getByTestId('arbitro-tiempo').textContent()).toBe(congelado);

  // Reanudar y cerrar el set: la duración queda guardada y el siguiente set espera a empezar
  await page.getByTestId('arbitro-empezar').click();
  await expect(page.getByTestId('arbitro-pausar')).toBeVisible();
  for (let i = 0; i < 14; i++) await page.getByTestId('arbitro-sumar-1').click();
  await page.getByTestId('arbitro-cerrar-set').click();
  await expect(page.getByTestId('arbitro-tiempo')).toHaveText('0:00');
  await expect(page.getByTestId('arbitro-empezar')).toHaveText('▶ Empezar set');
  await expect(tarjeta.getByTestId('estado-partido')).toContainText('Set 1 terminado · por empezar el set 2');

  const guardado = (await datosTorneo(page.request, torneo.slug)).partidos.find(p => p.id === partido.id);
  expect(guardado.reloj_estado).toBe('entre_sets');
  expect(guardado.duracion_sets).toHaveLength(1);
  expect(guardado.duracion_sets[0]).toBeGreaterThanOrEqual(2000);

  // Deshacer el cierre recupera el set y su tiempo, en pausa
  await page.getByTestId('arbitro-deshacer').click();
  await expect(page.getByTestId('arbitro-empezar')).toHaveText('▶ Reanudar');
  await expect.poll(async () => aSegundos(await page.getByTestId('arbitro-tiempo').textContent())).toBeGreaterThanOrEqual(2);

  // Empezar el set 2 a mano (sin puntos) también arranca el reloj
  await page.getByTestId('arbitro-cerrar-set').click();
  await page.getByTestId('arbitro-empezar').click();
  await expect(page.getByTestId('arbitro-pausar')).toBeVisible();
  await expect(tarjeta.getByTestId('estado-partido')).toContainText('En juego · Set 2');

  // Al finalizar, el público ve la duración de cada set
  for (let i = 0; i < 15; i++) await page.getByTestId('arbitro-sumar-2').click();
  await page.getByTestId('arbitro-cerrar-set').click();
  for (let i = 0; i < 15; i++) await page.getByTestId('arbitro-sumar-1').click();
  await page.getByTestId('arbitro-cerrar-set').click();
  page.once('dialog', d => d.accept());
  await page.getByTestId('arbitro-finalizar').click();
  await expect(page.getByTestId('arbitro-terminado')).toBeVisible();
  await expect(tarjeta.getByTestId('estado-partido')).toContainText(/Finalizado · \d+:\d\d \+ \d+:\d\d \+ \d+:\d\d/);
});
