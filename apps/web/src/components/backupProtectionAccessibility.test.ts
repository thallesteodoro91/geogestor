import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('controlador compartilhado separa o indicador compacto da visão detalhada', () => {
  const indicator = read('./BackupStatusIndicator.tsx');
  const footer = read('./BackupModalFooter.tsx');

  for (const component of [
    'ProtectionSummary',
    'ProtectionJourney',
    'ProtectionMetrics',
    'BackupOperationProgress',
    'BackupRecoverySection',
    'BackupAdvancedSections',
    'BackupModalFooter'
  ]) {
    assert.match(indicator, new RegExp(`<${component}`));
  }

  assert.doesNotMatch(read('./BackupProtectionSections.tsx'), /data-backup-primary-action/);
  assert.equal(footer.match(/data-backup-primary-action="true"/g)?.length, 3);
  assert.match(footer, /if \(activeOperation\)/);
  assert.match(indicator, /surface\?: 'indicator' \| 'details'/);
  assert.match(indicator, /export function BackupProtectionDetails/);
  assert.match(footer, /Ver detalhes do backup/);
});

test('status, carregamento, progresso e feedback são anunciados sem depender apenas de cor', () => {
  const indicator = read('./BackupStatusIndicator.tsx');
  const sections = read('./BackupProtectionSections.tsx');

  assert.match(indicator, /aria-label=\{`Status do backup:/);
  assert.match(sections, /role="progressbar"/);
  assert.match(sections, /aria-valuetext=/);
  assert.match(sections, /aria-live="polite"/);
  assert.match(sections, /aria-busy="true"/);
  assert.match(sections, /Finalizando com segurança…/);
  assert.match(indicator, /maxWidth="max-w-md"/);
  assert.match(indicator, /<ProtectionMetrics[\s\S]*compact/);
});

test('recuperação usa labels, erros inline e foco programático no primeiro erro', () => {
  const indicator = read('./BackupStatusIndicator.tsx');
  const recovery = read('./BackupRecoverySection.tsx');

  assert.match(recovery, /htmlFor="backup-admin-password-code"/);
  assert.match(recovery, /htmlFor="backup-admin-password-kit"/);
  assert.match(recovery, /htmlFor="backup-kit-password"/);
  assert.match(recovery, /name="backup_recovery_method"/);
  assert.match(recovery, /aria-invalid=/);
  assert.match(recovery, /role="alert"/);
  assert.match(indicator, /focusRecoveryField\('backup-kit-password'\)/);
  assert.match(indicator, /clearSensitiveState\(\);[\s\S]*setRecoveryMethod\(method\)/);
  assert.match(indicator, /RECOVERY_INACTIVITY_TIMEOUT_MS/);
  assert.doesNotMatch(recovery, /onPaste|preventDefault/);
});

test('hierarquia mantém resumo, jornada, métricas e divulgação progressiva', () => {
  const indicator = read('./BackupStatusIndicator.tsx');
  const summary = indicator.indexOf('<ProtectionSummary');
  const journey = indicator.indexOf('<ProtectionJourney');
  const metrics = indicator.indexOf('<ProtectionMetrics');
  const actions = indicator.indexOf('id="backup-actions"');
  const recovery = indicator.indexOf('<BackupRecoverySection');

  assert.ok(summary >= 0);
  assert.ok(metrics > summary);
  assert.ok(actions > metrics);
  assert.ok(journey > actions);
  assert.ok(recovery > journey);

  const sections = read('./BackupProtectionSections.tsx');
  assert.match(sections, /Escolher e testar destino externo/);
  assert.match(sections, /Criar o primeiro backup completo/);
  assert.match(sections, /Exportar e validar o kit/);
  assert.match(sections, /Executar teste de restauração/);
  assert.match(sections, /status\.cloud\.confirmation === 'confirmed'/);
  assert.match(sections, /Política e retenção/);
  assert.match(sections, /Histórico recente/);
  assert.match(sections, /Detalhes técnicos/);
});

test('detalhes ficam em Ferramentas e aceitam navegação profunda com foco', () => {
  const settings = read('../pages/Configuracoes.tsx');
  const indicator = read('./BackupStatusIndicator.tsx');
  const footer = read('./BackupModalFooter.tsx');
  const modalSource = indicator.slice(indicator.indexOf('<Modal'), indicator.lastIndexOf('</Modal>'));

  assert.match(settings, />Ferramentas</);
  assert.match(settings, /Backup e proteção/);
  assert.match(settings, /<BackupProtectionDetails/);
  assert.match(indicator, /id="backup-protection-details-title"/);
  assert.match(indicator, /tabIndex=\{-1\}/);
  assert.match(footer, /appLinks\.settings\('backups', 'backup-protection-details-title'\)/);
  assert.doesNotMatch(modalSource, /<ProtectionJourney|<BackupRecoverySection|<BackupAdvancedSections/);
});

test('tooltip fecha com o modal e não reaparece apenas pelo retorno programático do foco', () => {
  const indicator = read('./BackupStatusIndicator.tsx');

  assert.match(indicator, /suppressNextTooltipFocus\.current = true/);
  assert.match(indicator, /suppressTooltipPointerUntil\.current = Date\.now\(\) \+ TOOLTIP_RETURN_SUPPRESSION_MS/);
  assert.match(indicator, /setTooltipOpen\(false\);[\s\S]*setOpen\(false\)/);
  assert.match(indicator, /onPointerEnter=\{handleTooltipPointerEnter\}/);
  assert.match(indicator, /onFocus=\{handleTooltipFocus\}/);
  assert.doesNotMatch(indicator, /group-focus-within\/backup|group-hover\/backup/);
});

test('Modal mantém cabeçalho, conteúdo rolável, rodapé e retorno de foco', () => {
  const source = read('./Modal.tsx');
  const content = source.indexOf('{children}');
  const footer = source.indexOf('{footer ?');

  assert.ok(content >= 0);
  assert.ok(footer > content);
  assert.match(source, /max-h-\[88dvh\]/);
  assert.match(source, /overflow-x-hidden/);
  assert.match(source, /overscroll-contain/);
  assert.match(source, /previousElementIsVisible \? previousElement : visibleFallback/);
  assert.match(source, /e\.key === 'Escape'.*!closeDisabled/);
  assert.match(source, /<h2\s+id=\{titleId\}/);
});

test('arquivos corrigidos não introduzem transição ampla nem controles pequenos', () => {
  const sources = [
    read('./BackupStatusIndicator.tsx'),
    read('./BackupProtectionSections.tsx'),
    read('./BackupRecoverySection.tsx'),
    read('./BackupModalFooter.tsx'),
    read('./Modal.tsx')
  ];
  for (const source of sources) {
    assert.doesNotMatch(source, /transition-all|transition:\s*all/);
  }
  assert.match(read('./BackupModalFooter.tsx'), /min-h-11/);
  assert.match(read('./BackupRecoverySection.tsx'), /min-h-11/);
});

test('NumericInput usa menos e mais com alvos adequados e rótulos configuráveis', () => {
  const numeric = read('./form-controls/NumericInput.tsx');
  const policy = read('./BackupPolicyPanel.tsx');

  assert.match(numeric, /decrementLabel\?: string/);
  assert.match(numeric, /incrementLabel\?: string/);
  assert.match(numeric, /<Minus/);
  assert.match(numeric, /<Plus/);
  assert.equal(numeric.match(/flex h-11 w-11/g)?.length, 2);
  assert.equal(numeric.match(/flex h-8 w-8/g)?.length, 2);
  assert.match(numeric, /text-zinc-700/);
  assert.doesNotMatch(numeric, /input\?\.name|readableName|transition-all|input\.focus\(\)|absolute inset-y-0/);
  assert.match(policy, /Diminuir tempo de consolidação/);
  assert.match(policy, /Aumentar tempo de consolidação/);
  assert.match(policy, /htmlFor="backup-debounce-minutes"/);
  assert.match(policy, /id="backup-debounce-minutes"/);
  assert.equal(policy.match(/<CheckboxField/g)?.length, 4);
  assert.doesNotMatch(policy, /type="checkbox"/);
});

test('cards avançados são neutros e diferenciam seus ícones por cor', () => {
  const sections = read('./BackupProtectionSections.tsx');
  const indicator = read('./BackupStatusIndicator.tsx');
  const recovery = read('./BackupRecoverySection.tsx');

  assert.match(indicator, /grid items-start gap-4 xl:grid-cols-2/);
  assert.match(sections, /bg-zinc-50\/80 open:bg-zinc-100\/70/);
  assert.match(sections, /self-start rounded-2xl/);
  assert.match(sections, /min-h-28/);
  assert.match(sections, /iconTone="violet"/);
  assert.match(sections, /iconTone="emerald"/);
  assert.match(indicator, /iconTone="sky"/);
  assert.match(recovery, /bg-amber-100 text-amber-800/);
  assert.match(recovery, /bg-zinc-50\/80 open:bg-zinc-100\/70/);
  assert.match(recovery, /self-start rounded-2xl/);
  assert.match(recovery, /min-h-28/);
});
