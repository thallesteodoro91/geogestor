import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { test, expect, _electron as electron, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { EnvironmentalDemandDetail } from '../../packages/contracts/src/environmental';
const requireApi = createRequire(path.resolve('apps/api/package.json'));
const requireRoot = createRequire(path.resolve('package.json'));
const { createClient } = requireApi('@libsql/client');
const evidence = path.resolve('docs/auditorias/2026-10-12-detalhe-ambiental/evidencias-implementacao');
const apiOrigin = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_API_PORT}`;
const sessions = new WeakMap<Page, string>();
const longName = 'Cadastro Ambiental Rural (CAR) — acompanhamento documental de uma propriedade com identificação extensa e dados cadastrados retroativamente';
async function seed(completed = false, hasContext = false) {
  if (!process.env.GEOGESTOR_E2E_ROOT || !/^run-/.test(path.basename(process.env.GEOGESTOR_E2E_ROOT))) throw new Error('Banco E2E isolado obrigatório');
  await fs.mkdir(evidence, { recursive: true });
  const client = crypto.randomUUID(), id = crypto.randomUUID();
  const db = createClient({ url: `file:${path.join(process.env.GEOGESTOR_E2E_ROOT, 'geogestor.db')}` });
  try {
    await db.batch([
      { sql: "insert into clientes (id,nome,tipo_pessoa,situacao) values (?,?,'PF','Ativo')", args: [client, 'Cliente fictício CAR com nome longo para avaliação da interface'] },
      { sql: "insert into projetos (id,cliente_id,nome,status,tipo,data_inicio,data_entrega,created_at,updated_at) values (?,?,?,?,'Ambiental','2022-08-08','2022-09-28','2026-01-01T12:00:00Z','2026-01-01T12:00:00Z')", args: [id, client, longName, completed ? 'Concluído' : 'Em Andamento'] },
      { sql: "insert into ambiental (id,projeto_id,cliente_id,tipo_demanda,status_fase,orgao_ambiental,protocolo,created_at,updated_at) values (?,?,?,'CAR',null,?,?,'2026-01-01T12:00:00Z','2026-01-01T12:00:00Z')", args: [crypto.randomUUID(), id, client, hasContext ? 'Órgão ambiental fictício' : null, hasContext ? 'PROTOCOLO-SINTETICO' : null] }
    ], 'write');
  } finally { db.close(); }
  return { id, client };
}
async function open(page: Page, id: string) {
  page.on('request', request => { const token = request.headers()['x-local-session']; if (token) sessions.set(page, token); });
  await page.goto(`http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}/ambiental/${id}`);
  await expect(page.getByRole('heading', { name: 'Desbloquear GeoGestor' }).or(page.locator('.environmental-detail'))).toBeVisible();
  if (await page.getByRole('heading', { name: 'Desbloquear GeoGestor' }).isVisible()) {
    await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
    await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  }
  await expect(page.locator('.environmental-detail')).toBeVisible();
}
async function api(page: Page, endpoint: string, method = 'GET', body?: object) {
  const response = await page.request.fetch(apiOrigin + endpoint, { method, headers: { 'x-local-session': sessions.get(page) || '' }, ...(body ? { data: body } : {}) });
  return { status: response.status(), data: await response.json() };
}
async function select(page: Page, id: string, text: string) {
  await page.locator(`#${id}`).click(); await page.getByRole('option', { name: text, exact: true }).click();
}
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true); }

test.describe('Demanda ambiental — implementação Impeccable', () => {
  test.use({ actionTimeout: 15000, navigationTimeout: 20000 });
  test.setTimeout(180_000);
  test('quatro atalhos executam a intenção e preservam o retorno com filtros', async ({ page }) => {
    const { id } = await seed(); await open(page, id);
    const origin = '/ambiental?tab=ambiental&q=Cadastro&page=1';
    await page.goto(origin);
    await expect(page.getByRole('heading', { name: 'Desbloquear GeoGestor' })).toBeVisible();
    await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
    await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
    await page.getByRole('link', { name: `Abrir demanda ${longName}`, exact: true }).first().click();
    expect(new URL(page.url()).searchParams.get('retorno')).toBe(origin);
    await page.getByRole('link', { name: 'Editar demanda', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Editar demanda ambiental', exact: true })).toBeVisible();
    await expect(page.locator('#project-nome')).toHaveValue(longName);
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Voltar à demanda ambiental', exact: true }).last().click();
    await page.getByRole('link', { name: 'Adicionar tarefa ou prazo', exact: true }).click();
    await expect(page.locator('#project-task-title')).toBeVisible(); await expect(page.locator('#project-task-title')).toBeFocused();
    await expect(page.getByRole('tab', { name: /Tarefas do projeto/ })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('link', { name: 'Voltar à demanda ambiental', exact: true }).last().click();
    await page.getByRole('link', { name: 'Anexar documento', exact: true }).click();
    await expect(page.locator('#project-detail-tab-arquivos')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('dialog', { name: 'Anexar documentos', exact: true })).toBeVisible();
    const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Selecionar arquivos', exact: true }).click();
    await (await chooser).setFiles({ name: 'evidencia-car.txt', mimeType: 'text/plain', buffer: Buffer.from('Documento sintético da auditoria ambiental') });
    await expect(page.getByText('evidencia-car.txt', { exact: true }).first()).toBeVisible();
    await page.getByRole('link', { name: 'Voltar à demanda ambiental', exact: true }).last().click();
    await page.getByRole('link', { name: 'Abrir projeto completo', exact: true }).click();
    await expect(page.getByRole('heading', { name: longName, exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('link', { name: 'Voltar à demanda ambiental', exact: true }).last().click();
    await page.getByRole('link', { name: 'Voltar para demandas ambientais', exact: true }).click();
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(origin);
  });

  test('conclusão, falha recuperável, reabertura, bloqueio na API e preservação', async ({ page }) => {
    const { id } = await seed(); await open(page, id);
    await page.getByRole('button', { name: 'Concluir demanda', exact: true }).click();
    const confirmation = page.getByRole('alertdialog', { name: 'Concluir demanda ambiental?' });
    await expect(confirmation.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(`**/api/ambiental/${id}/concluir`, async route => { await gate; await route.continue(); });
    await confirmation.getByRole('button', { name: 'Concluir demanda', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Concluindo…', exact: true })).toBeDisabled();
    release(); await expect(confirmation).toHaveCount(0);
    await expect(page.locator('#demand-work-action')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Alterar fase', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Adicionar andamento', exact: true })).toBeDisabled();
    const closed = (await api(page, `/api/ambiental/${id}`)).data as EnvironmentalDemandDetail;
    expect(closed.status).toBe('Concluído'); expect(closed.encerramento).toBeTruthy();
    expect((await api(page, `/api/ambiental/${id}/fase`, 'PATCH', { statusFase: 'Protocolo', status: 'Em Andamento' })).status).toBe(409);
    expect((await api(page, `/api/ambiental/${id}/andamentos`, 'POST', { titulo: 'Tentativa', descricao: 'Não deve ser registrada', categoria: 'Teste', data: '2022-08-09' })).status).toBe(409);
    await page.getByRole('button', { name: 'Reabrir trabalho', exact: true }).click();
    await page.route(`**/api/ambiental/${id}/reabrir`, route => route.fulfill({ status: 500, json: { error: 'Falha sintética. Tente novamente.' } }));
    const reopen = page.getByRole('alertdialog', { name: 'Reabrir trabalho?' });
    await reopen.getByRole('button', { name: 'Reabrir trabalho', exact: true }).click();
    await expect(reopen.getByRole('alert')).toContainText('Falha sintética');
    await page.unroute(`**/api/ambiental/${id}/reabrir`);
    await reopen.getByRole('button', { name: 'Reabrir trabalho', exact: true }).click();
    await expect(reopen).toHaveCount(0); await expect(page.getByRole('button', { name: 'Alterar fase', exact: true })).toBeEnabled();
    await expect(page.locator('#demand-work-action')).toBeFocused();
    const reopened = (await api(page, `/api/ambiental/${id}`)).data as EnvironmentalDemandDetail;
    expect(reopened.status).toBe('Em Andamento'); expect(reopened.statusFase).toBeNull();
    expect(reopened.history.some(item => item.categoria === 'Reabertura do trabalho')).toBe(true);
    expect(closed.history.every(item => reopened.history.some(saved => saved.id === item.id))).toBe(true);
    await page.getByRole('button', { name: 'Alterar fase', exact: true }).click();
    await expect(page.locator('#environmental-phase')).toContainText('Selecione uma fase');
    await select(page, 'environmental-phase', 'Documentação');
    await page.getByRole('button', { name: 'Salvar fase', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('.environmental-detail').getByText('Documentação', { exact: true })).toBeVisible();
    await expect(page.locator('#demand-phase-action')).toBeFocused();
  });

  test('validação, rascunho preservado, navegação, recarga, processamento e teclado', async ({ page }) => {
    const { id } = await seed(); await open(page, id);
    const trigger = page.locator('#demand-work-action'); await trigger.click();
    const form = page.getByRole('dialog', { name: 'Registrar andamento', exact: true });
    await expect(page.locator('#progress-title')).toBeFocused();
    await page.locator('#progress-title').fill('   '); await form.getByRole('button', { name: 'Registrar andamento', exact: true }).click();
    await expect(page.locator('#progress-title')).toBeFocused(); await expect(page.locator('#progress-title')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#progress-title-error')).toHaveText('Informe um título.');
    await expect(page.locator('#progress-description')).toHaveAttribute('maxlength', '3000');
    await expect(page.locator('#progress-category')).toHaveAttribute('maxlength', '120');
    await page.locator('#progress-title').fill('Rascunho a preservar'); await page.locator('#progress-description').fill('Observação de campo sintética para registrar no histórico.');
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused(); await trigger.click();
    await expect(page.locator('#progress-title')).toHaveValue('Rascunho a preservar');
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Voltar para demandas ambientais' }).click();
    const discard = page.getByRole('alertdialog', { name: 'Descartar alterações não salvas?' });
    await expect(discard).toBeVisible(); await discard.getByRole('button', { name: 'Continuar editando' }).click();
    const prompt = page.waitForEvent('dialog', { timeout: 15000 }); const reload = page.reload().catch(() => {}); const dialog = await prompt; expect(dialog.type()).toBe('beforeunload'); await dialog.dismiss(); await reload;
    await trigger.click(); await expect(page.locator('#progress-title')).toHaveValue('Rascunho a preservar');
    await expect(page.locator('#progress-title')).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(form.getByRole('button', { name: 'Fechar modal' })).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(form.getByRole('button', { name: 'Registrar andamento', exact: true })).toBeFocused();
    await page.route(`**/api/ambiental/${id}/andamentos`, route => route.fulfill({ status: 500, json: { error: 'Falha sintética ao registrar. Tente novamente.' } }));
    await form.getByRole('button', { name: 'Registrar andamento', exact: true }).click();
    await expect(form.getByRole('alert')).toContainText('Falha sintética'); await expect(page.locator('#progress-title')).toHaveValue('Rascunho a preservar');
    await page.unroute(`**/api/ambiental/${id}/andamentos`);
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(`**/api/ambiental/${id}/andamentos`, async route => { await gate; await route.continue(); });
    await form.getByRole('button', { name: 'Registrar andamento', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Registrando…', exact: true })).toBeDisabled(); release();
    await expect(form).toHaveCount(0); await expect(page.getByRole('heading', { name: 'Rascunho a preservar' })).toBeVisible();
    await expect(trigger).toBeFocused();
    const historyTrigger = page.getByRole('button', { name: 'Adicionar andamento', exact: true });
    await historyTrigger.click();
    await page.locator('#progress-title').fill('Segundo evento sintético');
    await page.locator('#progress-description').fill('Verificação do retorno ao botão de origem no histórico.');
    await form.getByRole('button', { name: 'Registrar andamento', exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect(historyTrigger).toBeFocused();
    await page.getByRole('link', { name: 'Voltar para demandas ambientais' }).click(); await expect(discard).toHaveCount(0);
  });

  test('documento permite escolher outro tipo, revisa cliente e responsável e gera PDF sem alegação de campo', async ({ page }) => {
    const { id } = await seed(true, true); await open(page, id);
    await page.getByRole('button', { name: 'Gerar relatório', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Gerar documento para o cliente', exact: true });
    await expect(page.locator('#laudo-cliente')).toHaveValue('Cliente fictício CAR com nome longo para avaliação da interface');
    await expect(page.locator('#laudo-tecnico')).toHaveValue('Thalles E2E');
    await page.getByText('Revisar dados complementares da demanda', { exact: true }).click();
    await expect(page.locator('#laudo-protocolo')).toHaveValue('PROTOCOLO-SINTETICO');
    await expect(page.locator('#laudo-orgao')).toHaveValue('Órgão ambiental fictício');
    await page.locator('#laudo-protocolo').fill('PROTOCOLO-REVISADO');
    await expect(page.locator('#laudo-tipo')).toContainText('Acompanhamento Documental');
    await select(page, 'laudo-tipo', 'Selecione o tipo de documento…');
    await form.getByRole('button', { name: 'Pré-visualizar PDF', exact: true }).click();
    await expect(page.locator('#laudo-tipo-error')).toContainText('Selecione'); await expect(page.locator('#laudo-tipo')).toBeFocused();
    await select(page, 'laudo-tipo', 'Laudo Ambiental Genérico');
    await page.locator('#laudo-projeto').fill('CAR revisado para documento'); await page.locator('#laudo-tecnico').fill('Responsável revisado');
    await page.locator('#laudo-data').click(); await page.getByRole('button', { name: 'Hoje', exact: true }).click();
    await page.locator('#laudo-observacoes').fill('Observação técnica fornecida exclusivamente para este ensaio.');
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Gerar relatório', exact: true }).click();
    await expect(page.locator('#laudo-tecnico')).toHaveValue('Responsável revisado');
    await form.getByRole('button', { name: 'Pré-visualizar PDF', exact: true }).click(); await form.getByRole('button', { name: 'Registrar emissão', exact: true }).click(); await expect(form.getByRole('status')).toContainText('Emissão registrada'); const download = page.waitForEvent('download'); await form.getByRole('button', { name: 'Baixar PDF', exact: true }).click();
    const pdf = await download; await pdf.saveAs(path.join(evidence, 'documento-car-sintetico.pdf')); expect(pdf.suggestedFilename()).toContain('CAR_revisado');
    await form.getByRole('button', { name: 'Fechar', exact: true }).click(); await expect(form).toHaveCount(0);
  });

  test('acompanhamento documental preserva campos do registro e exporta PDF para o cliente', async ({ page }) => {
    const { id } = await seed(false, true); await open(page, id);
    await page.getByRole('button', { name: 'Alterar fase', exact: true }).click();
    await select(page, 'environmental-phase', 'Documentação');
    await page.getByRole('button', { name: 'Salvar fase', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Gerar relatório', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Gerar documento para o cliente', exact: true });
    await expect(page.locator('#laudo-tipo')).toContainText('Acompanhamento Documental');
    await page.locator('#laudo-data').click(); await page.getByRole('button', { name: 'Hoje', exact: true }).click();
    await page.locator('#laudo-observacoes').fill('EXEMPLO FICTÍCIO — Registro revisado do acompanhamento documental.');
    await page.getByText('Detalhar documentos e próximos passos', { exact: true }).click();
    await page.locator('#laudo-documentos').fill('EXEMPLO FICTÍCIO — Documento consultado para este ensaio.');
    await page.locator('#laudo-proximos-passos').fill('EXEMPLO FICTÍCIO — Confirmar o próximo encaminhamento com o cliente.');
    await page.locator('#laudo-projeto').fill('EXEMPLO FICTÍCIO — Nome revisado para esta emissão');
    await page.getByText('Revisar dados complementares da demanda', { exact: true }).click();
    await expect(page.locator('#laudo-situacao-trabalho')).toHaveValue('Em Andamento');
    await expect(page.locator('#laudo-fase-ambiental')).toHaveValue('Documentação');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Concluir demanda', exact: true }).click();
    await page.getByRole('alertdialog', { name: 'Concluir demanda ambiental?' }).getByRole('button', { name: 'Concluir demanda', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Gerar relatório', exact: true }).click();
    await expect(page.locator('#laudo-projeto')).toHaveValue('EXEMPLO FICTÍCIO — Nome revisado para esta emissão');
    await expect(page.locator('#laudo-situacao-trabalho')).toHaveValue('Concluído');
    if (!await page.locator('#laudo-fase-ambiental').isVisible()) await page.getByText('Revisar dados complementares da demanda', { exact: true }).click();
    await page.locator('#laudo-fase-ambiental').fill('Documentação — referência revisada para esta emissão');
    await expect(page.locator('#laudo-documentos')).toHaveValue('EXEMPLO FICTÍCIO — Documento consultado para este ensaio.');
    await page.setViewportSize({ width: 360, height: 900 }); await noOverflow(page);
    const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(axe.violations).toEqual([]);
    const destination = path.resolve('docs/auditorias/2026-10-12-relatorio-acompanhamento/evidencias');
    await fs.mkdir(destination, { recursive: true });
    await page.screenshot({ path: path.join(destination, 'formulario-360.png'), fullPage: true });
    await form.getByRole('button', { name: 'Pré-visualizar PDF', exact: true }).click(); await form.getByRole('button', { name: 'Registrar emissão', exact: true }).click(); await expect(form.getByRole('status')).toContainText('Emissão registrada'); const download = page.waitForEvent('download'); await form.getByRole('button', { name: 'Baixar PDF', exact: true }).click();
    const pdf = await download; expect(pdf.suggestedFilename()).toMatch(/^DOC-/);
    await pdf.saveAs(path.join(destination, 'Relatorio_CAR_Exportado_Pela_Interface.pdf'));
    await form.getByRole('button', { name: 'Fechar', exact: true }).click(); await expect(form).toHaveCount(0);
  });

  test('falha na geração preserva o rascunho documental ao fechar e reabrir', async ({ page }) => {
    await page.route('**/api/ambiental/*/documentos/previa', route => route.fulfill({ status: 500, json: { error: 'Falha sintética na geração da prévia.' } }));
    const { id } = await seed(true, true); await open(page, id);
    await page.getByRole('button', { name: 'Gerar relatório', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Gerar documento para o cliente', exact: true });
    await page.locator('#laudo-data').click(); await page.getByRole('button', { name: 'Hoje', exact: true }).click();
    await page.locator('#laudo-observacoes').fill('EXEMPLO FICTÍCIO — Rascunho preservado após falha.');
    await page.getByText('Detalhar documentos e próximos passos', { exact: true }).click();
    await page.locator('#laudo-documentos').fill('EXEMPLO FICTÍCIO — Documento informado pelo responsável.');
    await form.getByRole('button', { name: 'Pré-visualizar PDF', exact: true }).click();
    await expect(form.getByRole('alert')).toContainText('Seu preenchimento foi preservado');
    await expect(page.locator('#laudo-observacoes')).toHaveValue('EXEMPLO FICTÍCIO — Rascunho preservado após falha.');
    await expect(page.locator('#laudo-documentos')).toHaveValue('EXEMPLO FICTÍCIO — Documento informado pelo responsável.');
    await expect(form.getByRole('button', { name: 'Pré-visualizar PDF', exact: true })).toBeEnabled();
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Gerar relatório', exact: true }).click();
    await expect(page.locator('#laudo-documentos')).toHaveValue('EXEMPLO FICTÍCIO — Documento informado pelo responsável.');
  });

  test('emissão e revisão preservam o original, prévia volta ao rascunho e falha de confirmação não duplica', async ({ page }) => {
    const { id } = await seed(true, true); await open(page, id);
    await page.getByRole('button', { name: 'Gerar relatório', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Gerar documento para o cliente', exact: true });
    await page.locator('#laudo-data').click(); await page.getByRole('button', { name: 'Hoje', exact: true }).click();
    await page.locator('#laudo-sintese').fill('EXEMPLO FICTÍCIO — Síntese inicial para o cliente.');
    await page.locator('#laudo-observacoes').fill('EXEMPLO FICTÍCIO — Registro inicial preservado.');
    await form.getByRole('button', { name: 'Pré-visualizar PDF', exact: true }).click();
    await expect(form.getByRole('status')).toContainText('ainda não foi registrada');
    expect((await api(page, '/api/ambiental/' + id + '/documentos')).data).toEqual([]);
    await form.getByRole('button', { name: 'Voltar ao preenchimento', exact: true }).click();
    await expect(page.locator('#laudo-observacoes')).toHaveValue('EXEMPLO FICTÍCIO — Registro inicial preservado.');
    await page.locator('#laudo-sintese').fill('EXEMPLO FICTÍCIO — Síntese revisada antes da emissão.');
    await form.getByRole('button', { name: 'Pré-visualizar PDF', exact: true }).click();
    await page.setViewportSize({ width: 360, height: 900 }); await noOverflow(page);
    const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(accessibility.violations).toEqual([]);
    let intercepted = false;
    await page.route('**/api/ambiental/' + id + '/documentos/emitir', async route => {
      if (!intercepted) { intercepted = true; await route.fetch(); await route.fulfill({ status: 500, json: { error: 'Resposta interrompida após registro, para teste.' } }); }
      else await route.continue();
    });
    await form.getByRole('button', { name: 'Registrar emissão', exact: true }).click();
    await expect(form.getByRole('alert')).toContainText('Seu preenchimento foi preservado');
    await form.getByRole('button', { name: 'Registrar emissão', exact: true }).click();
    await expect(form.getByRole('status')).toHaveText('Emissão registrada');
    const firstList = (await api(page, '/api/ambiental/' + id + '/documentos')).data;
    expect(firstList).toHaveLength(1);
    const first = (await api(page, '/api/ambiental/' + id + '/documentos/' + firstList[0].id)).data;
    const output = path.resolve('docs/auditorias/2026-10-12-emissoes-documentais/evidencias'); await fs.mkdir(output, { recursive: true });
    const download = page.waitForEvent('download'); await form.getByRole('button', { name: 'Baixar PDF', exact: true }).click();
    await (await download).saveAs(path.join(output, 'Relatorio_CAR_Emissao_Ficticia.pdf'));
    await form.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.getByRole('button', { name: 'Nova revisão de ' + first.codigo + ' revisão 1', exact: true }).click();
    await expect(page.locator('#laudo-sintese')).toHaveValue('EXEMPLO FICTÍCIO — Síntese revisada antes da emissão.');
    await page.locator('#laudo-observacoes').fill('EXEMPLO FICTÍCIO — Registro da segunda revisão.');
    await form.getByRole('button', { name: 'Pré-visualizar PDF', exact: true }).click();
    await form.getByRole('button', { name: 'Registrar emissão', exact: true }).click();
    await expect(form.getByRole('status')).toHaveText('Emissão registrada');
    await form.getByRole('button', { name: 'Fechar', exact: true }).click();
    const finalList = (await api(page, '/api/ambiental/' + id + '/documentos')).data;
    expect(finalList).toHaveLength(2); expect(finalList.map((row: any) => row.revisao).sort()).toEqual([1, 2]);
    const original = (await api(page, '/api/ambiental/' + id + '/documentos/' + first.id)).data;
    expect(original.pdfBase64).toBe(first.pdfBase64); expect(original.snapshot).toEqual(first.snapshot);
    await page.getByRole('button', { name: 'Consultar ' + first.codigo + ' revisão 1', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Documento preservado', exact: true })).toBeVisible();
    await page.getByText('Dados utilizados nesta emissão', { exact: true }).click();
    await expect(page.getByText('EXEMPLO FICTÍCIO — Registro inicial preservado.', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Gerar relatório', exact: true }).click();
    await expect(page.locator('#laudo-sintese')).toHaveValue('');
    await page.locator('#laudo-data').click(); await page.getByRole('button', { name: 'Hoje', exact: true }).click();
    await page.locator('#laudo-sintese').fill('EXEMPLO FICTÍCIO — Síntese revisada antes da emissão.');
    await page.locator('#laudo-observacoes').fill('EXEMPLO FICTÍCIO — Registro inicial preservado.');
    await form.getByRole('button', { name: 'Pré-visualizar PDF', exact: true }).click();
    await form.getByRole('button', { name: 'Registrar emissão', exact: true }).click();
    await expect(form.getByRole('status')).toHaveText('Emissão registrada');
    const all = (await api(page, '/api/ambiental/' + id + '/documentos')).data;
    expect(all).toHaveLength(3); expect(new Set(all.map((row: any) => row.codigo)).size).toBe(2);
  });

  test('logotipo WebP cadastrado é incorporado localmente sem alterar o cadastro da empresa', async ({ page }) => {
    const { id } = await seed(true); await open(page, id);
    const initialSettings = (await api(page, '/api/dados-operacionais/configuracoes-operacionais')).data;
    const logo = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 32;
      const context = canvas.getContext('2d')!; context.fillStyle = '#064e3b'; context.fillRect(0, 0, 64, 32);
      return canvas.toDataURL('image/webp');
    });
    const template = { version: 1, razao: 'Empresa fictícia WebP', logo, email: 'contato@example.invalid' };
    expect((await api(page, '/api/dados-operacionais/configuracoes-operacionais', 'PUT', { values: { geogestor_empresa_template: template } })).status).toBe(200);
    try {
      await page.getByRole('button', { name: 'Gerar relatório', exact: true }).click();
      const form = page.getByRole('dialog', { name: 'Gerar documento para o cliente', exact: true });
      await page.locator('#laudo-data').click(); await page.getByRole('button', { name: 'Hoje', exact: true }).click();
      await page.locator('#laudo-observacoes').fill('EXEMPLO FICTÍCIO — Registro com logotipo WebP.');
      await form.getByRole('button', { name: 'Pré-visualizar PDF', exact: true }).click();
      await form.getByRole('button', { name: 'Registrar emissão', exact: true }).click();
      await expect(form.getByRole('status')).toHaveText('Emissão registrada');
      const issues = (await api(page, '/api/ambiental/' + id + '/documentos')).data;
      const saved = (await api(page, '/api/ambiental/' + id + '/documentos/' + issues[0].id)).data;
      expect(saved.snapshot.company.razao).toBe('Empresa fictícia WebP');
      expect(saved.snapshot.company.logo).toMatch(/^data:image\/png;base64,/);
      expect(saved.snapshot.sourceLogo).toBe(logo);
      expect((await api(page, '/api/dados-operacionais/configuracoes-operacionais')).data.geogestor_empresa_template.logo).toBe(logo);
      await form.getByRole('button', { name: 'Fechar', exact: true }).click();
    } finally { await api(page, '/api/dados-operacionais/configuracoes-operacionais', 'PUT', { values: { geogestor_empresa_template: initialSettings.geogestor_empresa_template || {} } }); }
  });

  test('360, 768 e 1280 px, claro e escuro, texto 200%, legado, vazios, alvos e acessibilidade', async ({ page }) => {
    const { id } = await seed(true); await open(page, id); const findings: unknown[] = [];
    for (const width of [360, 768, 1280]) for (const theme of ['light', 'dark']) for (const scale of [100, 200]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(({ theme, scale }) => { document.documentElement.classList.toggle('dark', theme === 'dark'); document.documentElement.style.fontSize = `${scale}%`; }, { theme, scale });
      await expect(page.getByRole('heading', { name: 'Situação da demanda' })).toBeVisible();
      const overflow = await page.evaluate(() => { const width = document.documentElement.clientWidth; return { width, scrollWidth: document.documentElement.scrollWidth, nodes: Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(node => node.getClientRects().length && node.getBoundingClientRect().right > width + 1).map(node => ({ tag: node.tagName, class: node.className, right: node.getBoundingClientRect().right, text: node.textContent?.slice(0,80) })).slice(0,20) }; });
      expect(await page.getByRole('main').count()).toBe(1);
      await expect(page.locator('.environmental-detail').getByText('Não informada', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Este registro não possui data ou evidência de encerramento no histórico.')).toBeVisible();
      const sizes = await page.locator('.environmental-detail button, .environmental-detail a').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => ({ label: node.textContent?.trim(), height: node.getBoundingClientRect().height, width: node.getBoundingClientRect().width })));
      expect(sizes.filter(item => item.height < 43.9 || item.width < 43.9)).toEqual([]);
      const axe = await new AxeBuilder({ page }).include('.environmental-detail').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      findings.push({ width, theme, scale, violations: axe.violations, sizes, overflow });
      await page.screenshot({ path: path.join(evidence, `demanda-${width}-${theme}-${scale}.png`), fullPage: true });

    }
    await fs.writeFile(path.join(evidence, 'layout-acessibilidade.json'), JSON.stringify(findings, null, 2));
    expect(findings.flatMap((item: any) => item.violations)).toEqual([]);
    expect(findings.filter((item: any) => item.overflow.scrollWidth > item.overflow.width)).toEqual([]);
  });

  test('desktop oferece prévia com teclado e registra o PDF no serviço local', async () => {
    const { id } = await seed(true);
    let executablePath: string;
    try { executablePath = requireRoot('electron'); } catch { executablePath = path.resolve('scratch/licensing-electron-runtime/runtime/electron.exe'); }
    const nativeEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'ELECTRON_RUN_AS_NODE'));
    const desktop = await electron.launch({ timeout: 30000, executablePath, args: [path.resolve('tests/e2e/support/licensing-desktop.cjs')], env: nativeEnv });
    try {
      const page = await desktop.firstWindow({ timeout: 30000 }); await open(page, id);
      expect(await page.evaluate(() => Boolean(window.electronAPI))).toBe(true);
      await page.getByRole('button', { name: 'Gerar relatório', exact: true }).click();
      const form = page.getByRole('dialog', { name: 'Gerar documento para o cliente', exact: true });
      await page.locator('#laudo-data').click(); await page.getByRole('button', { name: 'Hoje', exact: true }).click();
      await page.locator('#laudo-observacoes').fill('EXEMPLO FICTÍCIO — Registro pelo desktop.');
      await form.getByRole('button', { name: 'Pré-visualizar PDF', exact: true }).click();
      const frame = form.locator('iframe[title="Pré-visualização do relatório"]'); await expect(frame).toBeVisible(); await frame.focus(); await expect(frame).toBeFocused();
      await expect(form.getByRole('link', { name: 'Abrir prévia em nova aba', exact: true })).toHaveCount(0);
      await form.getByRole('button', { name: 'Registrar emissão', exact: true }).click();
      await expect(form.getByRole('status')).toHaveText('Emissão registrada');
      expect((await api(page, '/api/ambiental/' + id + '/documentos')).data).toHaveLength(1);
      await form.getByRole('button', { name: 'Fechar', exact: true }).click();
    } finally {
      // The isolated VM fixture overrides quit; stop its real Electron host directly.
      await desktop.evaluate(({ app }) => app.exit(0)).catch(() => {});
      await desktop.close().catch(() => {});
    }
  });

  test('desktop protege rascunho no fechamento e enquanto registra andamento', async () => {
    const { id } = await seed();
    let executablePath: string;
    try { executablePath = requireRoot('electron'); } catch { executablePath = path.resolve('scratch/licensing-electron-runtime/runtime/electron.exe'); await fs.access(executablePath); }
    const nativeEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'ELECTRON_RUN_AS_NODE'));
    const desktop = await electron.launch({ timeout: 30000, executablePath, args: [path.resolve('tests/e2e/support/licensing-desktop.cjs')], env: nativeEnv });
    try {
      const page = await desktop.firstWindow({ timeout: 30000 }); page.on('dialog', dialog => { void dialog.accept().catch(() => {}); });
      await open(page, id); await page.getByRole('button', { name: 'Registrar andamento', exact: true }).click();
      await page.locator('#progress-title').fill('Rascunho nativo ambiental'); await page.locator('#progress-description').fill('Descrição sintética');
      await expect.poll(() => desktop.evaluate(() => (globalThis as any).__licensingDesktopTest.states.some((state: any) => state.dirty))).toBe(true);
      await desktop.evaluate(() => (globalThis as any).__licensingDesktopTest.close());
      await expect(page.locator('#progress-title')).toHaveValue('Rascunho nativo ambiental');
      let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
      await page.route(`**/api/ambiental/${id}/andamentos`, async route => { await gate; await route.continue(); });
      await page.getByRole('dialog', { name: 'Registrar andamento', exact: true }).getByRole('button', { name: 'Registrar andamento', exact: true }).click();
      await expect.poll(() => desktop.evaluate(() => (globalThis as any).__licensingDesktopTest.states.some((state: any) => state.saving))).toBe(true);
      await desktop.evaluate(() => { const native = (globalThis as any).__licensingDesktopTest; native.setResponse(1); native.close(); });
      expect(page.isClosed()).toBe(false); release(); await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect.poll(() => desktop.evaluate(() => (globalThis as any).__licensingDesktopTest.states.every((state: any) => !state.dirty && !state.saving))).toBe(true);
      const records = await desktop.evaluate(() => (globalThis as any).__licensingDesktopTest.records);
      expect(records.some((record: any) => record.title === 'Salvamento em andamento')).toBe(true);
      await fs.writeFile(path.join(evidence, 'fechamento-desktop.json'), JSON.stringify(records, null, 2));
    } finally {
      // Shut down this isolated fixture directly; its VM app is not the real Electron app lifecycle.
      await desktop.evaluate(({ app }) => app.exit(0)).catch(() => {});
      await desktop.close().catch(() => {});
    }
  });
});
