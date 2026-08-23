import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { schema } from '@geogestor/database';
import { db } from '../db';

export const LOCAL_AUTH_POLICY_KEY = 'geogestor_local_auth_policy';

let cachedEnabled: boolean | null = null;

export const LocalAuthPolicyService = {
  async isRequired() {
    if (process.env.GEOGESTOR_AUTH_DISABLED === '1') return false;
    if (process.env.GEOGESTOR_REQUIRE_UNLOCK === '1') return true;
    if (cachedEnabled !== null) return cachedEnabled;

    const [row] = await db.select({ valorJson: schema.configuracoesOperacionais.valorJson })
      .from(schema.configuracoesOperacionais)
      .where(eq(schema.configuracoesOperacionais.chave, LOCAL_AUTH_POLICY_KEY))
      .limit(1)
      .catch((error) => {
        if (/no such table/i.test(error instanceof Error ? error.message : String(error))) return [];
        throw error;
      });
    if (!row) return (cachedEnabled = false);
    try {
      const parsed = JSON.parse(row.valorJson) as { enabled?: unknown };
      return (cachedEnabled = parsed.enabled === true);
    } catch {
      return (cachedEnabled = false);
    }
  },

  async setRequired(enabled: boolean) {
    const now = new Date().toISOString();
    await db.insert(schema.configuracoesOperacionais).values({
      id: crypto.randomUUID(),
      chave: LOCAL_AUTH_POLICY_KEY,
      valorJson: JSON.stringify({ enabled }),
      origem: 'aplicacao',
      updatedAt: now
    }).onConflictDoUpdate({
      target: schema.configuracoesOperacionais.chave,
      set: { valorJson: JSON.stringify({ enabled }), origem: 'aplicacao', updatedAt: now, deletedAt: null }
    });
    cachedEnabled = enabled;
    return enabled;
  },

  resetCacheForTests() {
    cachedEnabled = null;
  }
};
