import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));

test('CI executa gates obrigatórios sem publicar release ou instalador', () => {
  const workflow = read('.github/workflows/ci.yml');
  for (const command of [
    'governance:check', 'governance:test', 'typecheck', 'lint', 'test:web', 'test:api',
    'test:electron', 'test:e2e', 'build', 'release:evidence', 'release:smoke-package',
    'release:verify-package', 'release:verify-signature',
  ]) {
    assert.match(workflow, new RegExp(command.replaceAll(':', '\\:')));
  }
  assert.match(workflow, /pnpm install --frozen-lockfile/);
  assert.match(workflow, /continue-on-error:\s*true[\s\S]+release:verify-signature/);
  assert.doesNotMatch(workflow, /\b(?:gh\s+release|create-release|softprops\/action-gh-release)\b/i);
  assert.doesNotMatch(workflow, /path:\s*apps\/desktop\/dist\/.*\.exe/i);
});

test('minutas comerciais preservam o aviso de revisão jurídica', () => {
  const commercialRoot = path.join(root, 'docs', 'commercial');
  const files = fs.readdirSync(commercialRoot).filter((name) => name.endsWith('.md'));
  assert.ok(files.length >= 6);
  for (const file of files) {
    assert.match(
      fs.readFileSync(path.join(commercialRoot, file), 'utf8'),
      /MINUTA TÉCNICA — REVISÃO JURÍDICA OBRIGATÓRIA ANTES DA PUBLICAÇÃO/,
      file,
    );
  }
});

test('versão comercial deriva da raiz e possui notas correspondentes', () => {
  const canonical = json('package.json').version;
  const commercial = canonical.replace(/\.0$/, '');
  assert.equal(json('apps/api/package.json').version, canonical);
  assert.equal(json('apps/desktop/package.json').version, canonical);
  assert.match(read('apps/web/src/pages/Ajuda/helpContent.ts'), new RegExp(`minimumVersion = ['"]${canonical}['"]`));
  assert.equal(fs.existsSync(path.join(root, 'docs', `NOTAS-DE-VERSAO-v${commercial}.md`)), true);
  assert.equal(json('apps/desktop/package.json').build.artifactName, `\${productName} Setup ${commercial}.\${ext}`);
});

test('ausência de Authenticode permanece exceção informativa explícita', () => {
  const candidate = read('scripts/release-candidate.mjs');
  const workflow = read('.github/workflows/ci.yml');
  assert.match(candidate, /runInformational\([\s\S]+assinatura Authenticode/);
  assert.match(candidate, /risco residual aceito/);
  assert.match(workflow, /Assinatura digital: não implementada por decisão do proprietário — risco residual aceito\./);
});

test('código-fonte de visualização não é ocultado pela exclusão de dados operacionais', () => {
  const gitignore = read('.gitignore');
  assert.match(gitignore, /^!apps\/web\/src\/data\/$/m);
  assert.match(gitignore, /^!apps\/web\/src\/data\/\*\*$/m);
  assert.equal(fs.existsSync(path.join(root, 'apps', 'web', 'src', 'data', 'chart-colors.ts')), true);
});

test('Node e pnpm são canônicos e o peer SQLite nativo legado não é materializado', () => {
  const manifest = json('package.json');
  const workspace = read('pnpm-workspace.yaml');
  const lockfile = read('pnpm-lock.yaml');

  assert.equal(manifest.packageManager, 'pnpm@11.8.0');
  assert.equal(manifest.engines.node, '>=24.0.0 <25');
  assert.match(workspace, /'drizzle-orm>better-sqlite3': '-'/);
  assert.match(workspace, /'drizzle-orm>@types\/better-sqlite3': '-'/);
  assert.doesNotMatch(lockfile, /^\s{2}better-sqlite3@/m);
  assert.doesNotMatch(lockfile, /^\s{2}'?@types\/better-sqlite3@/m);
  assert.match(lockfile, /^\s{2}drizzle-orm@[^\n]*\(@libsql\/client@[^\n]+\):$/m);
  assert.doesNotMatch(read('.npmrc'), /better-sqlite3/);
  assert.doesNotMatch(read('apps/api/build.mjs'), /better-sqlite3/);
});

test('iniciador de desenvolvimento é portátil entre perfis Windows', () => {
  const launcher = read('start-dev.cmd');
  assert.match(launcher, /where pnpm\.cmd/);
  assert.match(launcher, /pnpm\.cmd dev/);
  assert.doesNotMatch(launcher, /[A-Z]:\\Users\\/i);
  assert.doesNotMatch(launcher, /codex-runtimes/i);
});

test('build da API falha cedo sem o binding nativo obrigatório', () => {
  const build = read('apps/api/build.mjs');
  assert.match(build, /throw new Error\(['"]Binding nativo obrigatório/);
  assert.doesNotMatch(build, /Native bindings directory not found/);
  assert.doesNotMatch(build, /Failed to copy native bindings/);
});
