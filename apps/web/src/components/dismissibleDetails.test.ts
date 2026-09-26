import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('caixas acionadas por ícones fecham fora, com Escape e ao abrir outra', () => {
  const component = read('./DismissibleDetails.tsx');
  const dashboard = read('../pages/Dashboard.tsx');
  const transparency = read('./KpiTransparency.tsx');
  const projects = read('../pages/Projetos/ListagemProjetos.tsx');

  assert.match(component, /document\.addEventListener\('pointerdown', closeFromOutside, true\)/);
  assert.match(component, /event\.key !== 'Escape'/);
  assert.match(component, /details\[data-dismissible-details="true"\]\[open\]/);
  assert.match(dashboard, /<DismissibleDetails className="relative shrink-0">/);
  assert.match(transparency, /<DismissibleDetails className="relative text-left">/);
  assert.doesNotMatch(projects, /<DismissibleDetails/);
  assert.match(projects, /aria-haspopup="menu"/);
  assert.match(projects, /role="menuitem"/);
  assert.match(projects, /event\.key === 'Escape'/);
  assert.match(projects, /triggerRef\.current\?\.focus\(\)/);
  assert.match(projects, /document\.addEventListener\('pointerdown', closeFromOutside, true\)/);
});
