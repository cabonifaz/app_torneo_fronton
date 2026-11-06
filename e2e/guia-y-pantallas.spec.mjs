// Guía de la primera vez y manual por rol; pantallas ajustadas a celular y tablet sin scroll horizontal
import { test, expect } from '@playwright/test';
import { crearTorneoPrueba, eliminarTorneoPrueba, iniciarSesion, saltarGuias, datosTorneo } from './utilidades.mjs';

let torneo;
test.beforeAll(async ({ request }) => { torneo = await crearTorneoPrueba(request); });
test.afterAll(async ({ request }) => { await eliminarTorneoPrueba(request, torneo); });

test('la guía del admin se abre sola la primera vez, se recorre y no vuelve a salir', async ({ page }) => {
  await iniciarSesion(page, torneo.slug, 'admin');
  await page.goto(`/t/${torneo.slug}/admin`);
  const paso = page.getByTestId('guia-paso');
  await expect(paso).toBeVisible();
  await expect(paso).toContainText('Paso 1 de');

  // Recorrer todos los pasos hasta "¡Listo!"
  for (let i = 0; i < 20 && (await paso.isVisible()); i++) await page.getByTestId('guia-siguiente').click();
  await expect(paso).toBeHidden();

  await page.reload();
  await expect(page.getByTestId('tab-partidos')).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(paso).toBeHidden();

  // El botón "?" repite el paso a paso y abre el manual
  await page.getByTestId('guia-boton').click();
  await page.getByTestId('guia-manual').click();
  await expect(page.getByTestId('guia-manual-contenido')).toContainText('Tabla y desempates');
  await page.getByRole('button', { name: 'Cerrar manual' }).click();
  await page.getByTestId('guia-boton').click();
  await page.getByTestId('guia-paso-a-paso').click();
  await expect(paso).toContainText('Paso 1 de');
  await page.getByTestId('guia-saltar').click();
  await expect(paso).toBeHidden();
});

test('el árbitro tiene guía en la lista y en el marcador; el público no tiene guía', async ({ page }) => {
  await iniciarSesion(page, torneo.slug, 'arbitro');
  await page.goto(`/t/${torneo.slug}/arbitro`);
  await expect(page.getByTestId('guia-paso')).toContainText('Pantalla del árbitro');
  await page.getByTestId('guia-saltar').click();

  const { partidos } = await datosTorneo(page.request, torneo.slug);
  await page.getByTestId(`arbitro-partido-${partidos[0].id}`).click();
  await expect(page.getByTestId('guia-paso')).toContainText('Sumar un punto');
  await page.getByTestId('guia-saltar').click();

  await page.goto(`/t/${torneo.slug}`);
  await expect(page.getByText('En vivo', { exact: true })).toBeVisible();
  await expect(page.getByTestId('guia-boton')).toHaveCount(0);
});

// Tamaños de referencia: celular chico, celular grande, tablet vertical y horizontal
const PANTALLAS = { 'celular chico': [375, 667], celular: [412, 915], tablet: [820, 1180], 'tablet horizontal': [1180, 820] };

for (const [nombre, [ancho, alto]] of Object.entries(PANTALLAS)) {
  test(`sin scroll horizontal y marcador a pantalla completa · ${nombre}`, async ({ browser }) => {
    const contexto = await browser.newContext({ viewport: { width: ancho, height: alto }, hasTouch: true });
    await saltarGuias(contexto);
    const page = await contexto.newPage();
    await iniciarSesion(page, torneo.slug, 'admin');
    const { partidos } = await datosTorneo(page.request, torneo.slug);

    for (const ruta of [`/t/${torneo.slug}`, `/t/${torneo.slug}/admin`, `/t/${torneo.slug}/arbitro`, `/t/${torneo.slug}/arbitro?partido=${partidos[0].id}`]) {
      await page.goto(ruta);
      await page.waitForTimeout(800);
      const { sw, sh } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }));
      expect(sw, `scroll horizontal en ${ruta}`).toBeLessThanOrEqual(ancho);
      if (ruta.includes('partido=')) expect(sh, 'el marcador del árbitro no debe tener scroll').toBeLessThanOrEqual(alto);
    }
    await contexto.close();
  });
}
