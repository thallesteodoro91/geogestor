import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { matchPath } from 'react-router-dom';
import {
  APP_LEGACY_REDIRECTS,
  APP_PATHS,
  APP_QUERY_KEYS,
  APP_ROUTES,
  APP_ROUTE_PATTERNS,
  appLinks,
  isExternalNavigation,
  isInternalAppLink,
  withAppQuery,
  resolveLegacyRedirect
} from '@geogestor/contracts';

const id = '123e4567-e89b-42d3-a456-426614174000';
const relatedId = '987e6543-e21b-42d3-a456-426614174999';

function assertRoute(link: string, pattern: string) {
  const url = new URL(link, 'http://geogestor.local');
  assert.ok(matchPath({ path: pattern, end: true }, url.pathname), link);
  return url.searchParams;
}

test('construtores de alertas apontam para rotas declaradas e parâmetros consumíveis', () => {
  assertRoute(appLinks.project(id), APP_PATHS.projectDetails);
  assertRoute(appLinks.client(id), APP_PATHS.clientDetails);
  assert.equal(assertRoute(appLinks.task(id), APP_PATHS.tasks).get(APP_QUERY_KEYS.task), id);

  const receivable = assertRoute(appLinks.receivable(id), APP_PATHS.finance);
  assert.equal(receivable.get('tab'), 'faturas');
  assert.equal(receivable.get(APP_QUERY_KEYS.receivable), id);

  const payable = assertRoute(appLinks.payable(id), APP_PATHS.finance);
  assert.equal(payable.get('tab'), 'pagar');
  assert.equal(payable.get(APP_QUERY_KEYS.payable), id);

  assertRoute(appLinks.budgetEdit(id), APP_PATHS.budgetEdit);
  assertRoute(appLinks.license(id), APP_PATHS.licenseDetails);

  const condition = assertRoute(appLinks.condition(id, relatedId), APP_PATHS.licenseDetails);
  assert.equal(condition.get('tab'), 'conditions');
  assert.equal(condition.get(APP_QUERY_KEYS.condition), relatedId);

  assertRoute(appLinks.appointment(id), APP_PATHS.calendarDetails);
  assert.equal(assertRoute(appLinks.opportunity(id), APP_PATHS.crm).get(APP_QUERY_KEYS.opportunity), id);
});

test('aliases preservam a busca antiga e mantêm o destino canônico', () => {
  assert.equal(
    resolveLegacyRedirect('/financeiro?tab=faturas', '?parcela=abc&origem=alerta'),
    '/financeiro?parcela=abc&origem=alerta&tab=faturas'
  );
  assert.equal(
    resolveLegacyRedirect('/financeiro?tab=pagar', '?tab=visao&despesa=xyz'),
    '/financeiro?tab=pagar&despesa=xyz'
  );
});

test('catálogo canônico possui identificadores, caminhos e rótulos únicos registrados no roteador', () => {
  const routes = Object.entries(APP_ROUTES);
  assert.equal(new Set(routes.map(([, route]) => route.id)).size, routes.length);
  assert.equal(new Set(routes.map(([, route]) => route.path)).size, routes.length);
  assert.equal(APP_ROUTES.finance.label, 'Financeiro');
  assert.equal(APP_ROUTES.dashboard.label, 'Visão Geral');

  const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  for (const [key, route] of routes) {
    assert.ok(route.path.startsWith('/'), `${key}: ${route.path}`);
    assert.ok(route.label.trim().length > 2, key);
    assert.match(appSource, new RegExp(`APP_ROUTES\\.${key}\\.path`), key);
  }
});

test('aliases declarados são únicos, internos e terminam em rota canônica', () => {
  assert.equal(new Set(APP_LEGACY_REDIRECTS.map((redirect) => redirect.id)).size, APP_LEGACY_REDIRECTS.length);
  assert.equal(new Set(APP_LEGACY_REDIRECTS.map((redirect) => redirect.from)).size, APP_LEGACY_REDIRECTS.length);

  for (const redirect of APP_LEGACY_REDIRECTS) {
    assert.equal(isInternalAppLink(redirect.from), true, redirect.from);
    assert.equal(isInternalAppLink(redirect.to), true, redirect.to);
    assert.match(redirect.minimumVersion, /^\d+\.\d+\.\d+$/);
    assert.ok(redirect.removalCondition.length > 20, redirect.id);
    const pathname = new URL(redirect.to, 'http://geogestor.local').pathname;
    assert.ok(
      APP_ROUTE_PATTERNS.some((pattern) => matchPath({ path: pattern, end: true }, pathname)),
      `${redirect.from} -> ${redirect.to}`
    );
  }
});

test('query canônica preserva parâmetros persistentes e diferencia navegação externa', () => {
  assert.equal(
    withAppQuery(APP_PATHS.finance, { tab: 'faturas', pagina: null }, '?origem=alerta&pagina=3'),
    '/financeiro?origem=alerta&tab=faturas'
  );
  assert.equal(isInternalAppLink('/projetos/123'), true);
  assert.equal(isInternalAppLink('//exemplo.com'), false);
  assert.equal(isExternalNavigation('https://exemplo.com'), true);
  assert.equal(isExternalNavigation('mailto:contato@example.com'), true);
  assert.equal(isExternalNavigation('/ajuda'), false);
});
