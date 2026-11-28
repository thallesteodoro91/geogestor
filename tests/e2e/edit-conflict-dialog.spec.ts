import { expect, test, type Page } from '@playwright/test';

const password = 'GeoGestor-E2E-2026';
async function editor(page: Page, name: string) {
  await page.goto('/clientes');
  const unlock = page.getByRole('heading', { name: 'Desbloquear GeoGestor' });
  await expect(unlock.or(page.getByRole('heading', { name: 'Clientes', exact: true }))).toBeVisible();
  if (await unlock.isVisible()) {
    await page.getByLabel('Senha local').fill(password);
    await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  }
  await page.getByRole('button', { name: `Ações de ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Editar', exact: true }).click();
  return page.getByRole('dialog', { name: /^Editar cliente/ });
}

test('duas janelas preservam rascunho, foco e revisão explícita em conflito real', async ({ page, context, request }) => {
  test.setTimeout(90000);
  const origin = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_API_PORT}`;
  const login = await request.post(`${origin}/api/auth/unlock`, { data: { password } });
  expect(login.ok()).toBe(true);
  const { token } = await login.json();
  const created = await request.post(`${origin}/api/clientes`, { headers: { 'x-local-session': token }, data: {
    nome: 'Cliente fictício concorrência', tipoPessoa: 'PF', cpf: '52998224725', celular: '48999990000', municipio: 'Florianópolis', uf: 'SC', situacao: 'Ativo'
  } });
  expect(created.ok()).toBe(true);
  const second = await context.newPage();
  const firstEditor = await editor(page, 'Cliente fictício concorrência');
  const secondEditor = await editor(second, 'Cliente fictício concorrência');
  await firstEditor.getByLabel('Nome completo').fill('Versão salva pela janela A');
  await secondEditor.getByLabel('Nome completo').fill('Rascunho da janela B');
  await firstEditor.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(firstEditor).toBeHidden();
  await secondEditor.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  const conflict = second.getByRole('dialog', { name: 'Alterações em outra janela' });
  await expect(conflict).toBeVisible();
  const coveredEditor = second.getByRole('dialog', { name: /^Editar cliente/, includeHidden: true });
  await expect(coveredEditor).toHaveAttribute('inert', '');
  await expect(coveredEditor.getByLabel('Nome completo')).toHaveValue('Rascunho da janela B');
  await second.keyboard.press('Escape');
  await expect(conflict).toBeHidden();
  await expect(secondEditor).toBeVisible();
  await expect(second.locator('#root')).toHaveAttribute('inert', '');
  await expect(secondEditor.getByLabel('Nome completo')).toHaveValue('Rascunho da janela B');
  await secondEditor.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(conflict).toBeVisible();
  await conflict.getByRole('button', { name: 'Consultar versão atual' }).click();
  await expect(conflict).toContainText('Versão salva pela janela A');
  await conflict.getByRole('button', { name: 'Voltar ao rascunho para revisar' }).click();
  await expect(secondEditor.getByLabel('Nome completo')).toHaveValue('Rascunho da janela B');
  await secondEditor.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(secondEditor).toBeHidden();
  await expect(second.getByText('Rascunho da janela B', { exact: true }).first()).toBeVisible();
  await expect(second.locator('#root')).not.toHaveAttribute('inert', '');
  await second.close();
});
