import { expect, type Locator } from '@playwright/test';

export async function expectUnclipped(control: Locator) {
  await expect(control).toBeVisible();
  try { await expect.poll(() => control.evaluate(element => {
    const r = element.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.top < -1 || r.left < -1 || r.bottom > innerHeight + 1 || r.right > innerWidth + 1) return false;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      // Root overflow is propagated to the viewport; its scrolled element rect is not a fixed popup's clip.
      if (parent === document.body || parent === document.documentElement) continue;
      const style = getComputedStyle(parent), b = parent.getBoundingClientRect();
      if (/(hidden|auto|scroll|clip)/.test(style.overflowY) && (r.top < b.top - 1 || r.bottom > b.bottom + 1)) return false;
      if (/(hidden|auto|scroll|clip)/.test(style.overflowX) && (r.left < b.left - 1 || r.right > b.right + 1)) return false;
    }
    return true;
  })).toBe(true); } catch (error) {
    const details = await control.evaluate(element => ({ html: element.outerHTML.slice(0, 600), bounds: element.getBoundingClientRect().toJSON(), viewport: { width: innerWidth, height: innerHeight }, parents: Array.from((function* () { for (let p = element.parentElement; p; p = p.parentElement) yield p; })()).map(p => ({ tag: p.tagName, class: p.className, overflow: getComputedStyle(p).overflow, bounds: p.getBoundingClientRect().toJSON() })) }));
    throw new Error('Controle cortado: ' + JSON.stringify(details) + '\n' + String(error));
  }
}

export async function expectCalendarCommands(popup: Locator) {
  await expectUnclipped(popup.getByRole('button', { name: 'Mês anterior', exact: true }));
  await expectUnclipped(popup.getByRole('button', { name: 'Próximo mês', exact: true }));
  await expectUnclipped(popup.getByRole('button', { name: 'Hoje', exact: true }));
  const clear = popup.getByRole('button', { name: 'Limpar', exact: true });
  if (await clear.count()) await expectUnclipped(clear);
}

export async function selectCalendarDate(calendar: Locator, dateKey: string) {
  const date = new Date(dateKey + 'T12:00:00');
  const dayLabel = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  const day = calendar.getByRole('gridcell', { name: dayLabel, exact: true });
  await expect(calendar).toBeVisible();
  if (!(await day.count())) {
    const currentMonth = await calendar.getByRole('grid').getAttribute('aria-label');
    const currentYear = Number(currentMonth?.slice(-4));
    const targetYear = date.getFullYear();
    expect(Number.isInteger(currentYear), 'Ano atual do calendário').toBe(true);
    await calendar.getByRole('button', { name: currentMonth!, exact: true }).click();
    const direction = targetYear > currentYear ? 1 : -1;
    for (let year = currentYear; year !== targetYear;) {
      year += direction;
      await calendar.getByRole('button', { name: String(year), exact: true }).click();
    }
    const abbreviatedMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
    const month = abbreviatedMonth[0].toUpperCase() + abbreviatedMonth.slice(1);
    await calendar.getByRole('button', { name: month, exact: true }).click();
  }
  await day.click();
}
