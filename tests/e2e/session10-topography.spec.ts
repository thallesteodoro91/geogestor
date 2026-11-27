import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { e2eEvidenceRoot } from './support/runtime';

const PASSWORD = 'GeoGestor-E2E-2026';
const PREFIX = 'QA-AUDIT-S10-20260913-';
const evidenceRoot = e2eEvidenceRoot();

async function unlockCurrent(page: Page) {
  await expect(page.getByRole('main')).toBeVisible();
  const heading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  if (!await heading.isVisible()) return;
  await page.getByLabel('Senha local').fill(PASSWORD);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
}

async function unlock(page: Page, target = '/topografia') {
  await page.goto(target);
  await unlockCurrent(page);
  await expect(page.getByRole('heading', { name: 'Topografia' })).toBeVisible();
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

async function saveAccessibilityTree(page: Page, name: string) {
  const snapshot = await page.locator('body').ariaSnapshot();
  await fs.writeFile(path.join(evidenceRoot, name), snapshot, 'utf8');
}

test.describe('Sessão 10 — Topografia', () => {
  test.use({ actionTimeout: 20_000 });
  test.setTimeout(240_000);

  test.beforeEach(async () => {
    await fs.mkdir(evidenceRoot, { recursive: true });
  });

  test('percorre rota, abas, teclado, quatro conversores, SRC e recuperação local', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await unlock(page);
    const mainTabs = page.getByRole('tablist', { name: 'Ferramentas de topografia' });
    await expect(mainTabs).toBeVisible();
    const converterTab = page.getByRole('tab', { name: 'Conversor GMS / Decimal' });
    await converterTab.focus();
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Área e perímetro' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(converterTab).toBeFocused();

    await page.getByRole('tab', { name: 'Decimal → GMS' }).click();
    await page.getByLabel('Latitude decimal (−90 a 90)').fill('12,9999999999');
    await expect(page.getByText(/13° 0′ 0″ N/)).toBeVisible();
    await page.getByLabel('Latitude decimal (−90 a 90)').fill('-0');
    await expect(page.getByText(/0° 0′ 0″ S/)).toBeVisible();

    await page.getByRole('tab', { name: 'GMS → decimal' }).click();
    await page.getByLabel(/Graus/).fill('27');
    await page.getByLabel(/Minutos/).fill('35');
    await page.getByLabel(/Segundos/).fill('40,2');
    await page.getByLabel('Hemisfério').click();
    await page.getByRole('option', { name: 'Sul (S)' }).click();
    await expect(page.getByText('-27,594500°', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Copiar resultado' }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('-27.5945');

    await page.getByRole('tab', { name: 'Latitude/longitude → X/Y' }).click();
    await page.getByLabel('Latitude', { exact: true }).fill('-27.59487');
    await page.getByLabel('Longitude', { exact: true }).fill('-48.54822');
    await expect(page.getByText('742.003,210 m', { exact: true })).toBeVisible();
    await expect(page.getByText('6.945.275,215 m', { exact: true })).toBeVisible();
    await page.getByLabel('Latitude', { exact: true }).fill('+27 S');
    await expect(page.getByText(/sinal positivo.*contradiz/i).first()).toBeVisible();

    await page.getByRole('button', { name: 'Configurar' }).click();
    await expect(page.getByRole('dialog', { name: 'Configurar referência espacial' })).toBeVisible();
    await page.getByLabel('Buscar por nome ou EPSG').fill('  wGs 84 LATITUDE  ');
    await page.getByLabel('Sistema de referência (SRC)').click();
    await page.getByRole('option', { name: /WGS 84.*latitude\/longitude.*EPSG:4326/i }).click();
    await page.getByRole('button', { name: /Transformar coordenadas/ }).click();
    await expect(page.getByText(/WGS 84 · Geográfico · EPSG:4326/)).toBeVisible();
    await page.getByRole('button', { name: 'Configurar' }).click();
    await page.getByRole('button', { name: '☆ Favoritar SRC' }).click();
    await page.getByRole('button', { name: 'Concluir' }).click();
    await page.reload();
    await unlockCurrent(page);
    await expect(page.getByText(/WGS 84 · Geográfico · EPSG:4326/)).toBeVisible();

    await page.evaluate(() => localStorage.setItem('geogestor:topography:spatial-reference', '{inválido'));
    await page.reload();
    await unlockCurrent(page);
    await expect(page.getByText(/SIRGAS 2000 · UTM 22S · EPSG:31982/)).toBeVisible();
    await expectNoAxeViolations(page);
    await saveAccessibilityTree(page, 'arvore-acessibilidade-conversor.yml');
    await page.screenshot({ path: path.join(evidenceRoot, '01-conversor-src.png'), fullPage: true });
  });

  test('reconcilia distância geodésica/projetada, coincidência e mapa-base indisponível', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
    await page.route('https://*.tile.openstreetmap.org/**', (route) => route.abort());
    await unlock(page);
    await page.getByRole('tab', { name: 'Distância e azimute' }).click();
    const start = page.getByRole('group', { name: 'Ponto de partida' });
    const destination = page.getByRole('group', { name: 'Ponto de destino' });
    await start.getByLabel(/Latitude/).fill('-23.55052');
    await start.getByLabel(/Longitude/).fill('-46.633308');
    await destination.getByLabel(/Latitude/).fill('-22.906847');
    await destination.getByLabel(/Longitude/).fill('-43.172897');
    await expect(page.getByText(/361,261 km/)).toBeVisible();
    await expect(page.getByText(/79,31°/)).toBeVisible();
    await page.getByRole('button', { name: 'Inverter origem/destino' }).click();
    await expect(page.getByText(/361,261 km/)).toBeVisible();

    await destination.getByLabel(/Latitude/).fill(await start.getByLabel(/Latitude/).inputValue());
    await destination.getByLabel(/Longitude/).fill(await start.getByLabel(/Longitude/).inputValue());
    await expect(page.getByText(/Os pontos são coincidentes/)).toBeVisible();
    await expect(page.getByText('Indeterminado para pontos coincidentes.')).toBeVisible();

    await page.getByRole('button', { name: 'X/Y projetado' }).click();
    await start.getByLabel('X / Este (m)').fill('742000');
    await start.getByLabel('Y / Norte (m)').fill('6945000');
    await destination.getByLabel('X / Este (m)').fill('742010');
    await destination.getByLabel('Y / Norte (m)').fill('6945000');
    await expect(page.getByText('10,00 m', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('90,00°', { exact: true })).toBeVisible();
    await page.getByText('Detalhes técnicos', { exact: true }).click();
    await expect(page.getByText(/1\.000322/).first()).toBeVisible();
    await destination.getByLabel('Y / Norte (m)').fill('11000000');
    await expect(page.getByText(/O Norte 11000000.*fora do intervalo UTM/i).first()).toBeVisible();
    await expect(page.getByText('—', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Latitude/longitude', exact: true }).click();
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByText('Mapa-base indisponível', { exact: true })).toBeVisible();
    await expectNoAxeViolations(page);
    await saveAccessibilityTree(page, 'arvore-acessibilidade-distancia.yml');
    await page.screenshot({ path: path.join(evidenceRoot, '02-distancia-offline.png'), fullPage: true });
  });

  test('importa polígono, edita metadados, exporta quatro formatos, PDF e reabre histórico', async ({ page }) => {
    await unlock(page);
    await page.getByRole('tab', { name: 'Área e perímetro' }).click();
    await page.getByRole('button', { name: 'X/Y projetado' }).click();
    await page.getByText('Importar vários vértices', { exact: true }).click();
    await page.getByLabel(/Cole CSV ou TXT/).fill('X;Y\n742000;6945000\n742010;6945000\n742010;6945010\n742000;6945010');
    await page.getByRole('button', { name: 'Importar texto' }).click();
    await expect(page.getByRole('dialog', { name: 'Prévia da importação de vértices' })).toContainText('4/4 válidas');
    await page.getByRole('button', { name: 'Substituir pelos válidos' }).click();
    await expect(page.getByText('0,0100 ha', { exact: true })).toBeVisible();
    await expect(page.getByText(/100,00 m²/)).toBeVisible();
    await expect(page.getByText('40,00 m', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Editar detalhes do vértice 1' }).click();
    const editor = page.getByRole('dialog', { name: 'Editar vértice V1' });
    await editor.getByLabel('Código').fill('=QA-V1');
    await editor.getByLabel('Descrição').fill('Marco sintético Açores <b>inerte</b>');
    await editor.getByLabel('Altitude (m, opcional)').fill('-1,25');
    await editor.getByLabel('Precisão').fill('0,02 m');
    await editor.getByLabel('Observações').fill('Somente dados QA');
    await editor.getByRole('button', { name: 'Salvar vértice' }).click();

    await page.getByText('Detalhes técnicos e exportações', { exact: true }).click();
    for (const format of ['CSV', 'GEOJSON', 'KML', 'DXF']) {
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: new RegExp(`^${format}$`, 'i') }).click();
      const download = await downloadPromise;
      await download.saveAs(path.join(evidenceRoot, `ui-amostra.${format.toLowerCase()}`));
    }
    const csv = await fs.readFile(path.join(evidenceRoot, 'ui-amostra.csv'), 'utf8');
    expect(csv).toContain("'=QA-V1");
    expect(csv).toContain('Marco sintético Açores <b>inerte</b>');
    const geojson = JSON.parse(await fs.readFile(path.join(evidenceRoot, 'ui-amostra.geojson'), 'utf8')) as { geometry: { coordinates: number[][][] } };
    expect(geojson.geometry.coordinates[0]).toHaveLength(5);
    const kml = await fs.readFile(path.join(evidenceRoot, 'ui-amostra.kml'), 'utf8');
    expect(kml).toContain('&lt;b&gt;inerte&lt;/b&gt;');
    const dxf = await fs.readFile(path.join(evidenceRoot, 'ui-amostra.dxf'), 'utf8');
    expect((dxf.match(/\r?\nVERTEX\r?\n/g) ?? [])).toHaveLength(4);
    expect(dxf).toMatch(/\r?\n70\r?\n1\r?\n/);

    await page.getByRole('button', { name: 'Relatório PDF' }).click();
    const report = page.getByRole('dialog', { name: 'Gerar relatório técnico em PDF' });
    await report.getByLabel('Título').fill(`${PREFIX}Memória técnica`);
    await report.getByLabel('Cliente').fill(`${PREFIX}Cliente sintético`);
    await report.getByLabel('Projeto').fill(`${PREFIX}Projeto sintético`);
    await report.getByLabel('Responsável técnico').fill('QA Automatizado');
    const pdfPromise = page.waitForEvent('download');
    await report.getByRole('button', { name: 'Baixar PDF' }).click();
    const pdf = await pdfPromise;
    await pdf.saveAs(path.join(evidenceRoot, 'relatorio-topografia.pdf'));

    await page.getByRole('button', { name: 'Salvar cálculo' }).click();
    const history = page.getByRole('dialog', { name: 'Salvar e consultar cálculos' });
    await history.getByLabel('Nome do cálculo').fill(`${PREFIX}Quadrado 10 m`);
    await history.getByLabel('Observações').fill('Persistência sintética; <script>inerte()</script>');
    await history.getByRole('button', { name: 'Confirmar salvamento' }).dblclick();
    await expect(history.getByText(`${PREFIX}Quadrado 10 m`, { exact: true })).toBeVisible();
    await history.getByText(`${PREFIX}Quadrado 10 m`, { exact: true }).click();
    await expect(page.getByText('0,0100 ha', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Desfazer alteração nos vértices' }).click();
    await page.getByRole('button', { name: 'Refazer alteração nos vértices' }).click();
    await expectNoAxeViolations(page);
    await saveAccessibilityTree(page, 'arvore-acessibilidade-poligono.yml');
    await page.screenshot({ path: path.join(evidenceRoot, '03-poligono-exportacoes.png'), fullPage: true });
  });
});
