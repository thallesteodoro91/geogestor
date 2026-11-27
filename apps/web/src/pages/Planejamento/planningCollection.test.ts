import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PlanningCollection } from './PlanningCollection';

const items = Array.from({ length: 60 }, (_, index) => ({ id: String(index + 1) }));
const render = (query: string, focusItemId?: string) => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [`/planejamento?${query}`] },
  createElement(PlanningCollection<{ id: string }>, { items, name: 'iniciativas.pagina', label: 'Iniciativas', kind: 'initiative', as: 'ul', focusItemId,
    children: item => createElement('li', { key: item.id, 'data-record': item.id }, `Registro fictício ${item.id}`) })));

test('listas grandes montam somente a página solicitada e conservam a semântica da lista', () => {
  const html = render('iniciativas.pagina=2');
  assert.equal((html.match(/<li /g) || []).length, 12);
  assert.match(html, /data-record="13"/);
  assert.match(html, /data-record="24"/);
  assert.doesNotMatch(html, /data-record="12"/);
  assert.match(html, /página 2 de 5/);
});

test('navegação direta ao registro abre a página que contém o alvo', () => {
  const html = render('iniciativas.pagina=1&foco=initiative-60');
  assert.match(html, /data-record="60"/);
  assert.match(html, /página 5 de 5/);
  assert.match(render('iniciativas.pagina=1', '40'), /data-record="40"/);
});

test('página inválida ou fora do intervalo continua exibindo registros e navegação', () => {
  assert.match(render('iniciativas.pagina=NaN'), /data-record="1"/);
  assert.match(render('iniciativas.pagina=-4'), /data-record="1"/);
  assert.match(render('iniciativas.pagina=999'), /data-record="60"/);
});
