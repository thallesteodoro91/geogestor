import crypto from 'node:crypto';
import { db } from '../db';
import { schema } from '@geogestor/database';
import { eq } from 'drizzle-orm';

const PREFIX = 'enc:v1:';

function getKey() {
  const encoded = process.env.GEOGESTOR_SECRET_KEY;
  if (!encoded) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('A chave local de proteção de segredos não foi fornecida.');
    }
    return null;
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('A chave local de proteção de segredos é inválida.');
  return key;
}

export class LocalSecretService {
  static isProtected(value: string | null | undefined) {
    return typeof value === 'string' && value.startsWith(PREFIX);
  }

  static protect(value: string | null | undefined) {
    if (!value || this.isProtected(value)) return value || null;
    const key = getKey();
    if (!key) return value;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  static reveal(value: string | null | undefined) {
    if (!value || !this.isProtected(value)) return value || null;
    const key = getKey();
    if (!key) throw new Error('Não foi possível abrir um segredo protegido sem a chave local.');
    const parts = value.slice(PREFIX.length).split(':');
    if (parts.length !== 3) throw new Error('Formato de segredo protegido inválido.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[0], 'base64'));
    decipher.setAuthTag(Buffer.from(parts[1], 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[2], 'base64')),
      decipher.final()
    ]).toString('utf8');
  }

  static async migrateStoredGoogleSecrets() {
    const configs = await db.select().from(schema.configuracoes).limit(1);
    const config = configs[0];
    if (!config) return;
    const protectedValues = {
      googleClientSecret: this.protect(config.googleClientSecret),
      googleRefreshToken: this.protect(config.googleRefreshToken),
      googleAccessToken: this.protect(config.googleAccessToken)
    };
    if (
      protectedValues.googleClientSecret === config.googleClientSecret
      && protectedValues.googleRefreshToken === config.googleRefreshToken
      && protectedValues.googleAccessToken === config.googleAccessToken
    ) return;
    await db.update(schema.configuracoes).set({
      ...protectedValues,
      updatedAt: new Date().toISOString()
    }).where(eq(schema.configuracoes.id, config.id));
  }
}
