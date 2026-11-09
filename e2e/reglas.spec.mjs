// Cierre del set configurable por torneo y por fase: seco (gana el primero que llega) o con ventaja de 2 y tope.
// El admin lo define; el árbitro y el público ven la regla al empezar y los avisos de punto de set / set ganado.
import { test, expect } from '@playwright/test';
import { crearTorneoPrueba, eliminarTorneoPrueba, iniciarSesion, saltarGuias, datosTorneo, PAREJAS } from './utilidades.mjs';

let torneo;
test.beforeAll(async ({ request }) => { torneo = await crearTorneoPrueba(request); });
test.afterAll(async ({ request }) => { await eliminarTorneoPrueba(request, torneo); });

const sumar = async (page, lado, veces) => {
  for (let i = 0; i < veces; i++) await page.getByTestId(`arbitro-sumar-${lado}`).click();
};

test('el admin configura ventaja de 2 con tope y el árbitro y el público ven la regla y los avisos', async ({ page, browser }) => {
  await saltarGuias(page.context());
  await iniciarSesion(page, torneo.slug, 'admin');
  await page.goto(`/t/${torneo.slug}/admin`);
  await page.getByTestId('tab-reglas').click();

  // Liga: a 15 con ventaja de 2 y tope 17. La final queda como viene en el formato (a 21, seco).
  await expect(page.getByTestId('regla-liga-resumen')).toHaveText('Mejor de 3 sets a 15, gana el primero que llega');
  await page.getByTestId('regla-liga-ventaja').check();
  await page.getByTestId('regla-liga-maximo').fill('17');
  await expect(page.getByTestId('regla-liga-resumen')).toHaveText('Mejor de 3 sets a 15, se gana por 2 (tope 17)');
  await page.getByTestId('reglas-guardar').click();
  await expect(page.getByTestId('reglas-mensaje')).toContainText('guardadas');

  const datos = await datosTorneo(page.request, torneo.slug);
  expect(datos.torneo.reglas).toEqual({
    liga: { mejorDe: 3, puntosSet: 15, ventaja: 2, maximo: 17 },
    final: { mejorDe: 3, puntosSet: 21, ventaja: 1, maximo: null },
  });

  // El servidor rechaza un tope que no supere el puntaje del set
  const malo = await page.request.put('/api/torneo/reglas', { data: { torneo_id: torneo.id, reglas: { liga: { mejorDe: 3, puntosSet: 15, ventaja: 2, maximo: 15 } } } });
  expect(malo.status()).toBe(400);

  // Público: antes de empezar ve cómo se cierra el set
  const partido = datos.partidos.find(p => p.fase === 'liga');
  const publico = await (await browser.newContext()).newPage();
  await publico.goto(`/t/${torneo.slug}`);
  await publico.getByRole('button', { name: 'Partidos' }).click();
  const tarjeta = publico.locator('li', { hasText: partido.nombre_pareja1 }).first();
  await expect(tarjeta.getByTestId('estado-partido')).toHaveText('Por empezar · a 15, se gana por 2 (tope 17)');
  await publico.getByRole('button', { name: 'Final' }).click();
  await expect(publico.getByText('Set único a 21, gana el primero que llega').or(publico.getByText('Mejor de 3 sets a 21, gana el primero que llega'))).toBeVisible();
  await publico.getByRole('button', { name: 'Partidos' }).click();

  // Árbitro (la sesión de admin también arbitra): la regla se ve al empezar
  await page.goto(`/t/${torneo.slug}/arbitro?partido=${partido.id}`);
  await expect(page.getByTestId('arbitro-reglas')).toHaveText('Mejor de 3 sets a 15, se gana por 2 (tope 17)');
  await expect(page.getByTestId('arbitro-regla')).toContainText('a 15, se gana por 2 (tope 17)');

  // 14-14: iguales; nadie tiene punto de set porque hay que ganar por 2
  await sumar(page, 1, 14);
  await sumar(page, 2, 14);
  await expect(page.getByTestId('arbitro-situacion')).toHaveText('Iguales a 14 · se gana por 2 (tope 17)');
  // 15-14: punto de set para la pareja 1 (también lo ve el público)
  await sumar(page, 1, 1);
  await expect(page.getByTestId('arbitro-situacion')).toHaveText(`Punto de set · ${PAREJAS[0]}`);
  await expect(tarjeta.getByTestId('situacion-partido')).toHaveText(`Punto de set · ${PAREJAS[0]}`);
  // 15-15 iguales · 15-16 punto de set para la pareja 2 · 16-16: el tope decide, punto de set para ambos
  await sumar(page, 2, 1);
  await expect(page.getByTestId('arbitro-situacion')).toHaveText('Iguales a 15 · se gana por 2 (tope 17)');
  await sumar(page, 2, 1);
  await expect(page.getByTestId('arbitro-situacion')).toHaveText(`Punto de set · ${PAREJAS[1]}`);
  await sumar(page, 1, 1);
  await expect(page.getByTestId('arbitro-situacion')).toHaveText('Punto de set para ambos');
  // 17-16: llega al tope → set ganado; no deja sumar más y el servidor tampoco lo acepta
  await sumar(page, 1, 1);
  await expect(page.getByTestId('arbitro-situacion')).toContainText(`Set ganado · ${PAREJAS[0]}`);
  await expect(tarjeta.getByTestId('situacion-partido')).toContainText('Set ganado');
  await sumar(page, 1, 1);
  await expect(page.getByTestId('arbitro-puntos-1')).toHaveText('17');
  const pasado = await page.request.put('/api/partidos', { data: { torneo_id: torneo.id, id: partido.id, marcador_vivo: { cerrados: [], actual: [18, 16] } } });
  expect(pasado.status()).toBe(400);
  await page.getByTestId('arbitro-cerrar-set').click();
  await expect(page.getByTestId('arbitro-puntos-1')).toHaveText('0');

  // Set 2: 14-13 es punto de partido (ganaría 15-13, con 2 de diferencia); 15-13 cierra el partido
  await sumar(page, 2, 13);
  await sumar(page, 1, 14);
  await expect(page.getByTestId('arbitro-situacion')).toHaveText(`Punto de partido · ${PAREJAS[0]}`);
  await sumar(page, 1, 1);
  await expect(page.getByTestId('arbitro-situacion')).toContainText(`Partido ganado · ${PAREJAS[0]}`);
  await expect(tarjeta.getByTestId('situacion-partido')).toContainText('Partido ganado');

  // Volver a las reglas del formato deja la liga seca otra vez
  await page.goto(`/t/${torneo.slug}/admin`);
  await page.getByTestId('tab-reglas').click();
  page.once('dialog', d => d.accept());
  await page.getByTestId('reglas-restaurar').click();
  await expect(page.getByTestId('reglas-mensaje')).toContainText('restauraron');
  await expect.poll(async () => (await datosTorneo(page.request, torneo.slug)).torneo.reglas).toBeNull();
});
