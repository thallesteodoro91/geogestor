import crypto from 'node:crypto';
import { BackupRecoveryService, type RecoveryKit } from './backup-recovery.service';

const SESSION_TTL_MS = 60 * 60 * 1000;

type RecoverySession = {
  secret: Buffer;
  keyId: string;
  expiresAt: number;
};

export class BackupRecoverySessionService {
  private static sessions = new Map<string, RecoverySession>();

  static create(kit: RecoveryKit, password: string, now = Date.now()) {
    this.purgeExpired(now);
    const encodedSecret = BackupRecoveryService.importKit(kit, password);
    const secret = Buffer.from(encodedSecret, 'base64');
    const token = crypto.randomBytes(32).toString('base64url');
    const session: RecoverySession = {
      secret,
      keyId: BackupRecoveryService.keyId(encodedSecret),
      expiresAt: now + SESSION_TTL_MS
    };
    this.sessions.set(token, session);
    return { token, keyId: session.keyId, expiresAt: new Date(session.expiresAt).toISOString() };
  }

  static validate(kit: RecoveryKit, password: string, expectedKeyId?: string | null) {
    const encodedSecret = BackupRecoveryService.importKit(kit, password);
    const secret = Buffer.from(encodedSecret, 'base64');
    try {
      const keyId = BackupRecoveryService.keyId(encodedSecret);
      if (expectedKeyId && keyId !== expectedKeyId) {
        throw new Error('O kit validado não corresponde à recuperação configurada neste computador.');
      }
      return { keyId, valid: true as const };
    } finally {
      secret.fill(0);
    }
  }

  static resolve(token: string | null | undefined, options: { consume?: boolean; now?: number } = {}) {
    if (!token) return null;
    const now = options.now ?? Date.now();
    this.purgeExpired(now);
    const session = this.sessions.get(token);
    if (!session) throw new Error('A sessão do kit expirou. Selecione e valide o kit novamente.');
    const encoded = session.secret.toString('base64');
    if (options.consume) {
      session.secret.fill(0);
      this.sessions.delete(token);
    }
    return { recoverySecret: encoded, keyId: session.keyId, expiresAt: new Date(session.expiresAt).toISOString() };
  }

  static revoke(token: string | null | undefined) {
    if (!token) return;
    const session = this.sessions.get(token);
    session?.secret.fill(0);
    this.sessions.delete(token);
  }

  static resetForTests() {
    for (const session of this.sessions.values()) session.secret.fill(0);
    this.sessions.clear();
  }

  private static purgeExpired(now: number) {
    for (const [token, session] of this.sessions) {
      if (session.expiresAt > now) continue;
      session.secret.fill(0);
      this.sessions.delete(token);
    }
  }
}
