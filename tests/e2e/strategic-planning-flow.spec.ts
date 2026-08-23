import { expect, test, type Locator, type Page } from '@playwright/test';

const PASSWORD = 'GeoGestor-E2E-2026';

async function unlock(page: Page) {
  await page.goto('/');
  const unlockHeading = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  const dashboardHeading = page.getByRole('heading', { name: 'Visão Geral' });
  await expect(unlockHeading.or(dashboardHeading)).toBeVisible();
  if (await unlockHeading.isVisible()) {
    await page.getByLabel('Senha local').fill(PASSWORD);
    await page.getByRole('button', { name: 'Desbloquear' }).click();
  }
  await expect(dashboardHeading).toBeVisible();
}

async function navigate(page: Page, target: string) {
  await page.evaluate((next) => {
    window.history.pushState({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, target);
}

async function create(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function selectCustom(page: Page, container: Locator, id: string, option: string) {
  await container.locator(`#${id}`).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('planejamento estratégico mantém o ciclo completo, filtros, teclado e persistência', async ({ page }) => {
  test.setTimeout(120_000);
  const suffix = String(Date.now()).slice(-6);
  const cycleName = `Ciclo E2E ${suffix}`;
  const pillarName = `Excelência ${suffix}`;
  const objectiveName = `Elevar previsibilidade ${suffix}`;
  const editedObjectiveName = `${objectiveName} revisado`;
  const keyResultName = `Entregas no prazo ${suffix}`;
  const initiativeName = `Ritual operacional ${suffix}`;
  const owner = `Responsável ${suffix}`;
  const decisionName = `Padronizar a revisão ${suffix}`;
  const riskName = `Atraso de insumos ${suffix}`;

  await unlock(page);
  await navigate(page, '/planejamento');
  await expect(page.getByRole('heading', { name: 'Planejamento estratégico' })).toBeVisible();
  await page.getByRole('button', { name: /Criar (primeiro )?planejamento/ }).first().click();

  let dialog = page.getByRole('dialog');
  await dialog.locator('#planning-cycle-first').fill(cycleName);
  await dialog.locator('#cycle-vision').fill('Operar com previsibilidade, qualidade e decisões rastreáveis.');
  await selectCustom(page, dialog, 'cycle-status', 'Ativo');
  await create(dialog);
  await expect(page.locator('#strategic-cycle-select')).toContainText(cycleName);

  await page.getByRole('tab', { name: 'Objetivos e metas' }).click();
  await page.getByRole('button', { name: /Novo pilar|Criar primeiro pilar/ }).first().click();
  dialog = page.getByRole('dialog');
  await dialog.locator('#planning-pillar-first').fill(pillarName);
  await dialog.locator('#pillar-description').fill('Disciplina de execução e qualidade operacional.');
  await create(dialog);
  await expect(page.getByRole('heading', { name: pillarName })).toBeVisible();

  await page.getByRole('button', { name: 'Objetivo', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('#planning-objective-first').fill(objectiveName);
  await dialog.locator('#objective-owner').fill(owner);
  await selectCustom(page, dialog, 'objective-status', 'Em andamento');
  await selectCustom(page, dialog, 'objective-priority', 'Alta');
  await create(dialog);
  await expect(page.getByRole('heading', { name: objectiveName })).toBeVisible();

  await page.getByRole('button', { name: '+ Adicionar' }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('#planning-keyResult-first').fill(keyResultName);
  await dialog.locator('#key-result-baseline').fill('70');
  await dialog.locator('#key-result-target').fill('95');
  await dialog.locator('#key-result-current').fill('82');
  await dialog.locator('#key-result-unit').fill('%');
  await create(dialog);
  await expect(page.getByText(keyResultName, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: `Editar objetivo ${objectiveName}` }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('#planning-objective-first').fill(editedObjectiveName);
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: editedObjectiveName })).toBeVisible();

  await page.getByLabel('Filtrar por responsável').click();
  await page.getByRole('option', { name: owner, exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('responsavel')).toBe(owner);
  await expect(page.getByRole('heading', { name: editedObjectiveName })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).click();

  const objectivesTab = page.getByRole('tab', { name: 'Objetivos e metas' });
  await objectivesTab.focus();
  await objectivesTab.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Iniciativas' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: /Nova iniciativa|Criar primeira iniciativa/ }).first().click();
  dialog = page.getByRole('dialog');
  await dialog.locator('#planning-initiative-first').fill(initiativeName);
  await selectCustom(page, dialog, 'initiative-objective', editedObjectiveName);
  await dialog.locator('#initiative-owner').fill(owner);
  await dialog.locator('#initiative-progress').fill('25');
  await selectCustom(page, dialog, 'initiative-status', 'Em andamento');
  await dialog.locator('#initiative-milestone').fill('Primeira revisão mensal concluída');
  await create(dialog);
  await expect(page.getByRole('heading', { name: initiativeName })).toBeVisible();

  await page.getByRole('tab', { name: 'Revisões e riscos' }).click();
  await page.getByRole('button', { name: 'Registrar revisão' }).first().click();
  dialog = page.getByRole('dialog');
  await selectCustom(page, dialog, 'checkin-objective', editedObjectiveName);
  await dialog.locator('#checkin-narrative').fill('O ciclo avançou, com indicador confiável e execução iniciada.');
  await dialog.locator('#checkin-next-steps').fill('Concluir o próximo marco e atualizar o indicador.');
  await create(dialog);
  await expect(page.getByText(/O ciclo avançou/)).toBeVisible();

  await page.getByRole('button', { name: 'Nova decisão' }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('#planning-decision-first').fill(decisionName);
  await selectCustom(page, dialog, 'decision-objective', editedObjectiveName);
  await dialog.locator('#decision-owner').fill(owner);
  await expect(dialog.locator('#decision-owner')).toHaveValue(owner);
  await create(dialog);
  await expect(page.getByText(decisionName, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Novo risco' }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('#planning-risk-first').fill(riskName);
  await selectCustom(page, dialog, 'risk-objective', editedObjectiveName);
  await selectCustom(page, dialog, 'risk-initiative', initiativeName);
  await selectCustom(page, dialog, 'risk-impact', 'Alto');
  await selectCustom(page, dialog, 'risk-probability', 'Média');
  await dialog.locator('#risk-owner').fill(owner);
  await dialog.locator('#risk-mitigation').fill('Antecipar compras e revisar fornecedores semanalmente.');
  await create(dialog);
  await expect(page.getByText(riskName, { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.reload();
  await unlock(page);
  await navigate(page, '/planejamento?aba=revisoes');
  await expect(page.getByText(decisionName, { exact: true })).toBeVisible();
  await expect(page.getByText(riskName, { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Objetivos e metas' }).click();
  await expect(page.getByRole('heading', { name: editedObjectiveName })).toBeVisible();
  await expect(page.getByText(keyResultName, { exact: true })).toBeVisible();
});
