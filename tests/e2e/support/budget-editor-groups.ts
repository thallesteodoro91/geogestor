import { expect, type Page } from '@playwright/test';

const groups = { header: 'Dados da proposta', characterization: 'Escopo técnico', items: 'Itens e preços', fees: 'Formação do preço', payment: 'Pagamento', document: 'Revisão e documento' };
export async function budgetGroup(page: Page, id: keyof typeof groups) {
  const compact = page.locator('#budget-group');
  if (await compact.isVisible()) {
    await compact.click();
    await page.getByRole('option', { name: new RegExp(groups[id]) }).click();
    await expect(compact).toHaveAttribute('aria-expanded', 'false');
    await expect(compact).toContainText(groups[id]);
    await expect(page.getByRole('listbox')).toBeHidden();
  } else await page.locator(`[data-budget-nav-section="${id}"]:visible`).click();
  await expect(page.locator(`#budget-section-${id}-content`)).toBeVisible();
  await expect(page.locator(`#budget-section-${id} h3 > button`)).toBeFocused();
  await page.evaluate(async () => {
    let position = scrollY, stableFrames = 0;
    for (let frame = 0; frame < 90 && stableFrames < 4; frame++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      stableFrames = Math.abs(scrollY - position) < .5 ? stableFrames + 1 : 0;
      position = scrollY;
    }
  });
}
