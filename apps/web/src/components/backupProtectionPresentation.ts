export type BackupSummaryState = 'empty' | 'running' | 'failed' | 'pending' | 'overdue' | 'local_only' | 'external_unverified' | 'recovery_incomplete' | 'restore_test_due' | 'protected';

export type BackupPrimaryAction = {
  kind: 'configure' | 'backup' | 'recovery' | 'restore_test';
  label: string;
};

export function getBackupPrimaryAction(
  state: BackupSummaryState,
  integrityState?: 'verified_at_creation' | 'verified_again' | 'failed' | 'legacy_unverified'
): BackupPrimaryAction {
  if (integrityState === 'failed') return { kind: 'backup', label: 'Criar novo backup' };
  switch (state) {
    case 'local_only':
    case 'external_unverified':
      return { kind: 'configure', label: state === 'local_only' ? 'Configurar cópia externa' : 'Revisar destino externo' };
    case 'recovery_incomplete':
      return { kind: 'recovery', label: 'Validar kit de recuperação' };
    case 'restore_test_due':
      return { kind: 'restore_test', label: 'Testar restauração' };
    case 'empty':
      return { kind: 'backup', label: 'Fazer primeiro backup' };
    case 'overdue':
    case 'failed':
      return { kind: 'backup', label: 'Criar novo backup' };
    case 'pending':
      return { kind: 'backup', label: 'Proteger alterações agora' };
    case 'running':
      return { kind: 'backup', label: 'Operação em andamento…' };
    case 'protected':
    default:
      return { kind: 'backup', label: 'Fazer backup agora' };
  }
}

const absoluteDateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const timeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function formatBackupDate(value: string | null) {
  return value ? absoluteDateFormatter.format(new Date(value)) : 'Ainda não realizado';
}

export function formatBackupMoment(value: string | null, now: number) {
  if (!value) return 'Ainda não realizado';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || now <= 0) return formatBackupDate(value);
  const date = new Date(timestamp);
  const current = new Date(now);
  const start = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime();
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((start - targetStart) / (24 * 60 * 60 * 1000));
  if (days === 0) return `Hoje, ${timeFormatter.format(date)}`;
  if (days === 1) return `Ontem, ${timeFormatter.format(date)}`;
  if (days > 1 && days <= 30) return `Há ${days.toLocaleString('pt-BR')} dias`;
  return formatBackupDate(value);
}

export function formatNextBackup(value: string | null, now: number) {
  if (!value) return 'Não agendado';
  const difference = Date.parse(value) - now;
  if (!Number.isFinite(difference) || now <= 0) return formatBackupDate(value);
  if (difference <= 0) return 'Execução pendente';
  const minutes = Math.max(1, Math.round(difference / 60_000));
  if (minutes < 60) return `Em aproximadamente ${minutes.toLocaleString('pt-BR')} min`;
  const hours = Math.max(1, Math.round(minutes / 60));
  if (hours < 48) return `Em aproximadamente ${hours.toLocaleString('pt-BR')} h`;
  const days = Math.max(1, Math.round(hours / 24));
  return `Em aproximadamente ${days.toLocaleString('pt-BR')} dias`;
}

export function formatIntegrity(input: {
  integrityState?: 'verified_at_creation' | 'verified_again' | 'failed' | 'legacy_unverified';
  integrityVerifiedAt?: string | null;
}) {
  switch (input.integrityState) {
    case 'verified_again': return `Verificado novamente em ${formatBackupDate(input.integrityVerifiedAt || null)}`;
    case 'verified_at_creation': return `Verificado na criação em ${formatBackupDate(input.integrityVerifiedAt || null)}`;
    case 'failed': return 'Falha de integridade';
    case 'legacy_unverified': return 'Legado sem checksums';
    default: return 'Aguardando primeiro backup';
  }
}
