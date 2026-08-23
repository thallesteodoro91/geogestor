import crypto from 'node:crypto';
import path from 'node:path';

type RestoreAuthorizationPayload = {
  version: 1;
  bundlePath: string;
  expiresAt: number;
  nonce: string;
};

function authorizationSecret() {
  const configured = process.env.GEOGESTOR_RESTORE_AUTH_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production') return 'geogestor-development-restore-authorization-secret';
  throw new Error('A autorização segura de restauração não está configurada.');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export class RestoreAuthorizationService {
  private static consumedNonces = new Set<string>();
  private static testedNonces = new Set<string>();

  static verify(input: { bundlePath: string; authorization: string }, options: { consume?: boolean; now?: number } = {}) {
    const [encoded, suppliedSignature, ...extra] = input.authorization.split('.');
    if (!encoded || !suppliedSignature || extra.length > 0) throw new Error('A autorização do backup selecionado é inválida. Selecione o backup novamente.');
    const expectedSignature = crypto.createHmac('sha256', authorizationSecret()).update(encoded).digest('base64url');
    if (!safeEqual(suppliedSignature, expectedSignature)) throw new Error('A autorização do backup selecionado é inválida. Selecione o backup novamente.');

    let payload: RestoreAuthorizationPayload;
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as RestoreAuthorizationPayload;
    } catch {
      throw new Error('A autorização do backup selecionado está danificada. Selecione o backup novamente.');
    }
    const now = options.now ?? Date.now();
    if (payload.version !== 1 || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= now || typeof payload.nonce !== 'string') {
      throw new Error('A autorização do backup selecionado expirou. Selecione o backup novamente.');
    }
    const selectedPath = path.resolve(input.bundlePath);
    if (selectedPath !== path.resolve(payload.bundlePath)) throw new Error('O caminho do backup não corresponde à seleção autorizada.');
    if (this.consumedNonces.has(payload.nonce)) throw new Error('Esta autorização de restauração já foi utilizada. Selecione o backup novamente.');
    if (options.consume) {
      this.consumedNonces.add(payload.nonce);
      this.testedNonces.delete(payload.nonce);
      if (this.consumedNonces.size > 1_000) this.consumedNonces.delete(this.consumedNonces.values().next().value!);
    }
    return { bundlePath: selectedPath, expiresAt: new Date(payload.expiresAt).toISOString(), nonce: payload.nonce };
  }

  static issueForTests(bundlePath: string, options: { expiresAt?: number; nonce?: string } = {}) {
    if (process.env.NODE_ENV !== 'test') throw new Error('Autorizações sintéticas são permitidas somente em testes.');
    const payload: RestoreAuthorizationPayload = {
      version: 1,
      bundlePath: path.resolve(bundlePath),
      expiresAt: options.expiresAt ?? Date.now() + 60_000,
      nonce: options.nonce || crypto.randomUUID()
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = crypto.createHmac('sha256', authorizationSecret()).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
  }

  static markTested(input: { bundlePath: string; authorization: string }) {
    const verified = this.verify(input);
    this.testedNonces.add(verified.nonce);
    if (this.testedNonces.size > 1_000) this.testedNonces.delete(this.testedNonces.values().next().value!);
    return verified;
  }

  static assertTested(input: { bundlePath: string; authorization: string }) {
    const verified = this.verify(input);
    if (!this.testedNonces.has(verified.nonce)) {
      throw new Error('Execute e aprove o teste isolado antes de iniciar a restauração real.');
    }
    return verified;
  }

  static resetForTests() {
    this.consumedNonces.clear();
    this.testedNonces.clear();
  }
}
