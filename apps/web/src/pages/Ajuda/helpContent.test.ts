import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  HELP_ARTICLES,
  buildHelpArticleSearch,
  filterHelpArticles,
  getHelpArticle,
  isHelpCategory,
} from './helpContent';

test('catálogo cobre os módulos operacionais e possui metadados de manutenção', () => {
  assert.equal(HELP_ARTICLES.length, 19);
  assert.equal(new Set(HELP_ARTICLES.map((article) => article.id)).size, HELP_ARTICLES.length);
  for (const article of HELP_ARTICLES) {
    assert.ok(article.route.startsWith('/'));
    assert.ok(article.routeLabel.length > 3);
    assert.match(article.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(article.minimumVersion, /^\d+\.\d+\.\d+$/);
    assert.ok(article.keywords.length >= 3);
    assert.ok(article.sections.length >= 1);
  }
});

test('busca encontra título, resumo, palavras-chave e conteúdo sem depender de acentos', () => {
  assert.deepEqual(filterHelpArticles(HELP_ARTICLES, 'all', 'Primeira configuração').map((item) => item.id), ['primeira-configuracao']);
  assert.ok(filterHelpArticles(HELP_ARTICLES, 'all', 'copias de seguranca').some((item) => item.id === 'backup-recuperacao'));
  assert.ok(filterHelpArticles(HELP_ARTICLES, 'all', 'checksum').some((item) => item.id === 'backup-recuperacao'));
  assert.ok(filterHelpArticles(HELP_ARTICLES, 'all', 'Aprovar e gerar efeitos').some((item) => item.id === 'orcamentos-aprovacao'));
});

test('categoria e busca são combinadas e podem produzir estado vazio', () => {
  assert.deepEqual(filterHelpArticles(HELP_ARTICLES, 'projetos', 'checklist').map((item) => item.id), ['projetos-checklist']);
  assert.deepEqual(filterHelpArticles(HELP_ARTICLES, 'financeiro', 'licenciamento'), []);
});

test('estado de URL é estável e entradas inválidas possuem fallback seguro', () => {
  const article = getHelpArticle('projetos-checklist');
  assert.ok(article);
  const params = buildHelpArticleSearch(article, 'campo');
  assert.equal(params.get('categoria'), 'projetos');
  assert.equal(params.get('artigo'), 'projetos-checklist');
  assert.equal(params.get('q'), 'campo');
  assert.equal(getHelpArticle('inexistente'), null);
  assert.equal(isHelpCategory('inexistente'), false);
  assert.equal(isHelpCategory('financeiro'), true);
});

test('links internos apontam para rotas existentes e textos obsoletos não retornam', () => {
  const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
  const obsolete = ['Abrir Pasta no Explorer', 'Imprimir / Salvar PDF', 'Ctrl + P', 'F5:'];
  const content = JSON.stringify(HELP_ARTICLES);
  for (const phrase of obsolete) assert.equal(content.includes(phrase), false, phrase);
  for (const article of HELP_ARTICLES) {
    const pathname = article.route.split('?')[0];
    assert.match(appSource, new RegExp(`path=["']${pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`), article.route);
  }
});

test('componente expõe os estados acessíveis exigidos pela Central de Ajuda', () => {
  const source = readFileSync(new URL('./Ajuda.tsx', import.meta.url), 'utf8');
  assert.match(source, /aria-pressed=\{isSelected\}/);
  assert.match(source, /aria-current=\{isSelected \? 'true'/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /<motion\.article/);
  assert.match(source, /motion-reduce:transition-none/);
  assert.doesNotMatch(source, /transition-all|animate-pulse/);
});
