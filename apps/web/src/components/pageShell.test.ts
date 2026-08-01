import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('PageHeader preserva a ordem canônica do cabeçalho antes da navegação', () => {
  const source = read('./PageHeader.tsx');
  const eyebrow = source.indexOf('{eyebrow ?');
  const heading = source.indexOf('<h1');
  const navigation = source.indexOf('{navigation ?');

  assert.ok(eyebrow >= 0);
  assert.ok(heading > eyebrow);
  assert.ok(navigation > heading);
  assert.match(source, /max-w-\[1400px\]/);
});

test('ações de cabeçalho e filtros usam as alturas canônicas', () => {
  const actions = read('../utils/actionStyles.ts');
  const filters = read('../utils/filterStyles.ts');
  const navigation = read('../utils/localNavigationStyles.ts');

  assert.match(actions, /headerPrimaryActionButtonClass[\s\S]*h-11 min-h-11/);
  assert.match(actions, /headerPrimaryActionIconClass[\s\S]*h-5 w-5/);
  assert.match(filters, /filterControlClass[\s\S]*h-10 min-h-10/);
  assert.match(navigation, /h-\[52px\] min-h-\[52px\]/);
});

test('PageFilterBar mantém busca, gatilho e painel semanticamente separados', () => {
  const source = read('./PageFilterBar.tsx');

  assert.match(source, /aria-label="Busca e filtros"/);
  assert.match(source, /aria-expanded=\{filtersOpen\}/);
  assert.match(source, /aria-controls=\{filterPanelId\}/);
  assert.match(source, />\s*Limpar\s*</);
});
