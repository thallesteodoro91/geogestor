import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

function relativeLuminance(hex: string) {
  const channels = hex.match(/../g)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [];
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('geo-field mantém contraste mínimo AA nos estados compartilhados', () => {
  const css = read('../index.css');
  const colorPairs = [
    ['ffffff', '000000'],
    ['e4e4e7', '27272a'],
    ['71717a', 'ffffff'],
    ['52525b', 'f4f4f5']
  ];

  for (const [foreground, background] of colorPairs) {
    assert.ok(contrastRatio(foreground, background) >= 4.5, `${foreground} sobre ${background}`);
    assert.match(css, new RegExp(`#${foreground}|#${background}`));
  }
  assert.match(css, /\.geo-field\[aria-invalid="true"\]/);
  assert.match(css, /\.geo-field:disabled/);
});

test('busca e alertas reutilizam o modal canônico e distinguem erro de vazio', () => {
  const search = read('./GlobalSearch.tsx');
  const alerts = read('./UnifiedNotificationCenter.tsx');

  for (const source of [search, alerts]) {
    assert.match(source, /<Modal/);
    assert.match(source, /initialFocusId=/);
    assert.match(source, /role="alert"/);
    assert.match(source, /Tentar novamente/);
    assert.match(source, /role="status" aria-live="polite"/);
  }
  assert.match(search, /Nenhum resultado encontrado/);
  assert.match(alerts, /!alertsQuery\.isError && !filtered\.length/);
});

test('rota curinga renderiza 404 depois dos aliases legados', () => {
  const app = read('../App.tsx');
  const aliases = app.indexOf('APP_LEGACY_REDIRECTS.map');
  const wildcard = app.indexOf('path="*" element={<RouteTransition><NotFound');

  assert.ok(aliases >= 0);
  assert.ok(wildcard > aliases);
  assert.doesNotMatch(app, /path="\*" element=\{<Navigate/);
  assert.match(read('../pages/NotFound.tsx'), /<h1 id="not-found-title"/);
});

test('loaders globais anunciam estado e não restam transition-all nas telas corrigidas', () => {
  const app = read('../App.tsx');
  assert.match(app, /role="status" aria-live="polite"[\s\S]*Carregando GeoGestor…/);
  assert.doesNotMatch(read('../pages/Clientes/ClienteDetalhes.tsx'), /transition-all/);
  assert.doesNotMatch(read('../pages/Contatos/Contatos.tsx'), /transition-all/);
});

test('modal não rouba foco já posicionado e ações de projeto não encolhem', () => {
  const modal = read('./Modal.tsx');
  const projects = read('../pages/Projetos/ListagemProjetos.tsx');

  assert.match(modal, /modalRef\.current\.contains\(document\.activeElement\)/);
  assert.match(modal, /window\.clearTimeout\(focusTimer\)/);
  assert.match(projects, /projectIconButtonClass = '[^']*h-8 w-8 shrink-0/);
});
