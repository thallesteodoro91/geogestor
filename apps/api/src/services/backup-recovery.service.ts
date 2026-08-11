import crypto from 'node:crypto';

const RECOVERY_ENV = 'GEOGESTOR_BACKUP_RECOVERY_KEY';
const ENVELOPE_AAD_PREFIX = 'GeoGestor backup data key envelope v1';
const CODE_PREFIX = 'GG-R1';

export type BackupKeyEnvelope = {
  version: 1;
  algorithm: 'AES-256-GCM';
  kdf: 'HKDF-SHA-256';
  purpose: 'device' | 'recovery';
  wrappingKeyId: string;
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

export type RecoveryKit = {
  format: 'GeoGestor-Recovery-Kit';
  version: 1;
  createdAt: string;
  recoveryKeyId: string;
  kdf: {
    algorithm: 'scrypt';
    salt: string;
    N: number;
    r: number;
    p: number;
    keyLength: 32;
  };
  encryption: {
    algorithm: 'AES-256-GCM';
    iv: string;
    tag: string;
    ciphertext: string;
  };
};

function decodeRootKey(encoded: string, label = 'chave') {
  const normalized = encoded.trim();
  const decoded = Buffer.from(normalized, 'base64');
  if (decoded.length !== 32 || decoded.toString('base64') !== normalized) {
    decoded.fill(0);
    throw new Error(`A ${label} possui formato inválido.`);
  }
  return decoded;
}

function base32Encode(value: Buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let accumulator = 0;
  let output = '';
  for (const byte of value) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(accumulator >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(accumulator << (5 - bits)) & 31];
  return output;
}

function base32Decode(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let accumulator = 0;
  const bytes: number[] = [];
  for (const character of value) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('O código de recuperação possui caracteres inválidos.');
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function aad(purpose: BackupKeyEnvelope['purpose']) {
  return Buffer.from(`${ENVELOPE_AAD_PREFIX}:${purpose}`, 'utf8');
}

function deriveWrappingKey(rootKey: Buffer, salt: Buffer, purpose: BackupKeyEnvelope['purpose']) {
  return Buffer.from(crypto.hkdfSync('sha256', rootKey, salt, aad(purpose), 32));
}

export class BackupRecoveryService {
  static generateRecoverySecret() {
    return crypto.randomBytes(32).toString('base64');
  }

  static getConfiguredRecoverySecret(required = false) {
    const value = process.env[RECOVERY_ENV]?.trim();
    if (!value) {
      if (required) throw new Error('A recuperação de emergência ainda não foi configurada neste computador.');
      return null;
    }
    const decoded = decodeRootKey(value, 'chave de recuperação');
    decoded.fill(0);
    return value;
  }

  static keyId(encoded: string) {
    const key = decodeRootKey(encoded, 'chave de recuperação');
    try {
      return crypto.createHash('sha256').update(key).digest('hex').slice(0, 24);
    } finally {
      key.fill(0);
    }
  }

  static formatRecoveryCode(encoded: string) {
    const key = decodeRootKey(encoded, 'chave de recuperação');
    try {
      const encodedCode = base32Encode(key);
      return `${CODE_PREFIX}-${encodedCode.match(/.{1,4}/g)?.join('-') || encodedCode}`;
    } finally {
      key.fill(0);
    }
  }

  static recoveryCodeToSecret(code: string) {
    const normalized = code.trim().toUpperCase().replace(/[\s-]/g, '');
    const prefix = CODE_PREFIX.replace(/-/g, '');
    if (!normalized.startsWith(prefix)) throw new Error('O código de recuperação não pertence ao GeoGestor.');
    const decoded = base32Decode(normalized.slice(prefix.length));
    try {
      if (decoded.length !== 32) throw new Error('O código de recuperação está incompleto.');
      return decoded.toString('base64');
    } finally {
      decoded.fill(0);
    }
  }

  static wrapDataKey(dataKey: Buffer, rootKeyEncoded: string, purpose: BackupKeyEnvelope['purpose']): BackupKeyEnvelope {
    if (dataKey.length !== 32) throw new Error('A chave de dados do backup é inválida.');
    const rootKey = decodeRootKey(rootKeyEncoded, purpose === 'device' ? 'chave do dispositivo' : 'chave de recuperação');
    const salt = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const wrappingKey = deriveWrappingKey(rootKey, salt, purpose);
    try {
      const cipher = crypto.createCipheriv('aes-256-gcm', wrappingKey, iv);
      cipher.setAAD(aad(purpose));
      const ciphertext = Buffer.concat([cipher.update(dataKey), cipher.final()]);
      return {
        version: 1,
        algorithm: 'AES-256-GCM',
        kdf: 'HKDF-SHA-256',
        purpose,
        wrappingKeyId: crypto.createHash('sha256').update(rootKey).digest('hex').slice(0, 24),
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        ciphertext: ciphertext.toString('base64')
      };
    } finally {
      rootKey.fill(0);
      wrappingKey.fill(0);
    }
  }

  static unwrapDataKey(envelope: BackupKeyEnvelope, rootKeyEncoded: string) {
    if (envelope.version !== 1 || envelope.algorithm !== 'AES-256-GCM' || envelope.kdf !== 'HKDF-SHA-256') {
      throw new Error('O envelope criptográfico do backup é incompatível.');
    }
    const rootKey = decodeRootKey(rootKeyEncoded, envelope.purpose === 'device' ? 'chave do dispositivo' : 'chave de recuperação');
    const actualKeyId = crypto.createHash('sha256').update(rootKey).digest('hex').slice(0, 24);
    if (actualKeyId !== envelope.wrappingKeyId) {
      rootKey.fill(0);
      throw new Error(envelope.purpose === 'recovery'
        ? 'A chave de recuperação não corresponde a este backup.'
        : 'Este backup depende da chave de outro dispositivo. Use o código ou kit de recuperação.');
    }
    const salt = Buffer.from(envelope.salt, 'base64');
    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const wrappingKey = deriveWrappingKey(rootKey, salt, envelope.purpose);
    try {
      if (salt.length !== 32 || iv.length !== 12 || tag.length !== 16) throw new Error('O envelope criptográfico está incompleto.');
      const decipher = crypto.createDecipheriv('aes-256-gcm', wrappingKey, iv);
      decipher.setAAD(aad(envelope.purpose));
      decipher.setAuthTag(tag);
      const dataKey = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
      if (dataKey.length !== 32) throw new Error('A chave de dados recuperada é inválida.');
      return dataKey;
    } catch (error) {
      if (error instanceof Error && error.message.includes('chave de dados')) throw error;
      throw new Error('Não foi possível autenticar a chave de recuperação deste backup.', { cause: error });
    } finally {
      rootKey.fill(0);
      wrappingKey.fill(0);
    }
  }

  static resolveDataKey(envelopes: BackupKeyEnvelope[], options: { deviceKey?: string | null; recoverySecret?: string | null; recoveryCode?: string | null } = {}) {
    const candidates: Array<{ purpose: BackupKeyEnvelope['purpose']; secret: string }> = [];
    if (options.deviceKey) candidates.push({ purpose: 'device', secret: options.deviceKey });
    const recoverySecret = options.recoverySecret || (options.recoveryCode ? this.recoveryCodeToSecret(options.recoveryCode) : this.getConfiguredRecoverySecret(false));
    if (recoverySecret) candidates.push({ purpose: 'recovery', secret: recoverySecret });
    for (const candidate of candidates) {
      const envelope = envelopes.find((item) => item.purpose === candidate.purpose);
      if (!envelope) continue;
      try {
        return this.unwrapDataKey(envelope, candidate.secret);
      } catch {
        // Try the next authorized envelope without exposing which local secret failed.
      }
    }
    const hasRecoveryEnvelope = envelopes.some((item) => item.purpose === 'recovery');
    throw new Error(hasRecoveryEnvelope
      ? 'Este backup foi criado em outro computador. Informe o código ou kit de recuperação correto.'
      : 'Este backup só pode ser aberto no computador original.');
  }

  static exportKit(secretEncoded: string, password: string): RecoveryKit {
    if (password.length < 12) throw new Error('Use uma senha com pelo menos 12 caracteres para proteger o kit.');
    const secret = decodeRootKey(secretEncoded, 'chave de recuperação');
    const salt = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const N = 131_072;
    const r = 8;
    const p = 1;
    const key = crypto.scryptSync(password, salt, 32, { N, r, p, maxmem: 256 * 1024 * 1024 });
    try {
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from('GeoGestor recovery kit v1', 'utf8'));
      const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
      return {
        format: 'GeoGestor-Recovery-Kit',
        version: 1,
        createdAt: new Date().toISOString(),
        recoveryKeyId: this.keyId(secretEncoded),
        kdf: { algorithm: 'scrypt', salt: salt.toString('base64'), N, r, p, keyLength: 32 },
        encryption: {
          algorithm: 'AES-256-GCM',
          iv: iv.toString('base64'),
          tag: cipher.getAuthTag().toString('base64'),
          ciphertext: ciphertext.toString('base64')
        }
      };
    } finally {
      secret.fill(0);
      key.fill(0);
    }
  }

  static importKit(kit: RecoveryKit, password: string) {
    if (kit?.format !== 'GeoGestor-Recovery-Kit' || kit.version !== 1 || kit.kdf?.algorithm !== 'scrypt' || kit.encryption?.algorithm !== 'AES-256-GCM') {
      throw new Error('O kit de recuperação possui formato incompatível.');
    }
    const { N, r, p } = kit.kdf;
    if (N !== 131_072 || r !== 8 || p !== 1 || kit.kdf.keyLength !== 32) throw new Error('Os parâmetros de proteção do kit são incompatíveis.');
    const key = crypto.scryptSync(password, Buffer.from(kit.kdf.salt, 'base64'), 32, { N, r, p, maxmem: 256 * 1024 * 1024 });
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(kit.encryption.iv, 'base64'));
      decipher.setAAD(Buffer.from('GeoGestor recovery kit v1', 'utf8'));
      decipher.setAuthTag(Buffer.from(kit.encryption.tag, 'base64'));
      const secret = Buffer.concat([decipher.update(Buffer.from(kit.encryption.ciphertext, 'base64')), decipher.final()]);
      const encoded = secret.toString('base64');
      secret.fill(0);
      if (this.keyId(encoded) !== kit.recoveryKeyId) throw new Error('O kit de recuperação não pôde ser validado.');
      return encoded;
    } catch (error) {
      if (error instanceof Error && error.message.includes('validado')) throw error;
      throw new Error('Senha incorreta ou kit de recuperação danificado.', { cause: error });
    } finally {
      key.fill(0);
    }
  }
}
