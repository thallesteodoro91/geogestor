import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./CalculadoraTopografica.tsx', import.meta.url), 'utf8');

test('preserva ícones padronizados e navegação acessível das três ferramentas', () => {
  assert.match(source, /repeat_5184145\.png/);
  assert.match(source, /compass_5759049\.png/);
  assert.match(source, /select_6791337\.png/);
  assert.match(source, /role="tablist"/);
  assert.match(source, /aria-selected=\{activeTab === tab\.id\}/);
  assert.match(source, /onKeyDown=\{\(event\) => handleTabKeyDown/);
});

test('expõe SRC, mapa transformado, importação e exportação com textos técnicos claros', () => {
  assert.match(source, /Sistema de referência \(SRC\)/);
  assert.match(source, /Latitude\/longitude/);
  assert.match(source, /Mapa indisponível para X\/Y sem SRC projetado/);
  assert.match(source, /Importar vários vértices/);
  assert.match(source, /Exportar geometria e metadados/);
  assert.doesNotMatch(source, /transition: all|transition-all/);
});

test('mantém alternativas acessíveis para edição, mapa, histórico e troca de SRC', () => {
  assert.match(source, /aria-label=\{`Editar detalhes do vértice/);
  assert.match(source, /aria-label=\{`Localizar vértice/);
  assert.match(source, /Desfazer \(Ctrl\+Z\)/);
  assert.match(source, /Ctrl\+Shift\+Z/);
  assert.match(source, /shouldHandleHistoryShortcut/);
  assert.match(source, /Transformar coordenadas \(recomendado\)/);
  assert.match(source, /Manter números e reinterpretar/);
  assert.match(source, /VertexImportPreview/);
  assert.match(source, /Relatório PDF/);
});

test('compacta o SRC e mantém a configuração completa em modal', () => {
  assert.match(source, /aria-haspopup="dialog"/);
  assert.match(source, /Configurar referência espacial/);
  assert.match(source, /Modal isOpen=\{spatialPanelExpanded\}/);
  assert.match(source, /Buscar por nome ou EPSG/);
  assert.match(source, /Favoritos e recentes/);
  assert.match(source, /Sugerir UTM pelas coordenadas/);
});

test('conversor usa uma área dinâmica com quatro modos e navegação por setas', () => {
  assert.match(source, /GMS → decimal/);
  assert.match(source, /Decimal → GMS/);
  assert.match(source, /Latitude\/longitude → X\/Y/);
  assert.match(source, /X\/Y → latitude\/longitude/);
  assert.match(source, /handleConverterModeKeyDown/);
  assert.match(source, /aria-labelledby=\{`converter-mode-/);
  assert.match(source, /converterMode === 'projected-geographic'/);
});

test('distância e polígono aplicam divulgação progressiva aos dados secundários', () => {
  assert.match(source, /Inverter origem\/destino/);
  assert.match(source, />Detalhes técnicos</);
  assert.match(source, /Advertências técnicas \(/);
  assert.match(source, /Detalhes técnicos e exportações/);
  assert.match(source, /lg:grid-cols-\[minmax\(0,3fr\)_minmax\(340px,2fr\)\]/);
});
