import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('..', import.meta.url));

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(target);
    return entry.name.endsWith('.tsx') ? [target] : [];
  });
}

test('selects usam o componente compartilhado, exceto a escolha nativa da linha de cabeçalho', () => {
  const nativeSelectOwners = collectTsxFiles(sourceRoot)
    .filter((file) => /<select\b/.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(sourceRoot, file).replaceAll('\\', '/'));

  assert.deepEqual(nativeSelectOwners, [
    'components/form-controls/SelectField.tsx',
    'pages/Importacao/ImportacaoDados.tsx'
  ]);
});

test('selects e comboboxes usam o tratamento de dropdown inspirado no Zard', () => {
  const select = readFileSync(new URL('./form-controls/SelectField.tsx', import.meta.url), 'utf8');
  const remote = readFileSync(new URL('./RemoteCombobox.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

  assert.match(select, /role="combobox"/);
  assert.match(select, /role="listbox"/);
  assert.match(select, /geo-dropdown-trigger/);
  assert.match(select, /geo-dropdown-content/);
  assert.match(select, /geo-dropdown-item/);
  assert.match(select, /geo-dropdown-trigger flex w-48 max-w-full/);
  assert.match(select, /popoverMaxWidth = 420/);
  assert.match(select, /matchTriggerWidth = false/);
  assert.match(select, /minWidth=\{matchTriggerWidth \? 0 : optionWidth\} maxWidth=\{popoverMaxWidth\}/);
  assert.match(select, /min-w-0 flex-1 break-words/);
  assert.match(remote, /geo-dropdown-trigger/);
  assert.match(remote, /geo-dropdown-content/);
  assert.match(remote, /geo-dropdown-item/);
  assert.match(remote, /relative w-48 max-w-full/);
  assert.match(remote, /\bw-48\b/);
  assert.match(styles, /\.geo-dropdown-trigger/);
  assert.match(styles, /\.geo-dropdown-content/);
  assert.match(styles, /\.geo-dropdown-item/);
  assert.match(styles, /\.geo-dropdown-trigger\[role="combobox"\][\s\S]*height: 2rem/);
  assert.match(styles, /\.geo-dropdown-item \{[\s\S]*min-height: 2rem/);
});
