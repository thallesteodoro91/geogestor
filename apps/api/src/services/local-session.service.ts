import crypto from 'node:crypto';

const DEFAULT_IDLE_MINUTES = 15;
const MAX_SESSION_HOURS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const LOCKOUT_MS = 60 * 1000;

type SessionRecord = {
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
};

type AttemptRecord = {
  failures: number[];
  blockedUntil: number;
};

const sessions = new Map<string, SessionRecord>();
const attempts = new Map<string, AttemptRecord>();

function safeEqual(left: Buffer, right: Buffer) {
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function verifyAdminPassword(password: unknown, storedHash: unknown) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false;
  const [scheme, salt, expectedHex] = storedHash.split(':');
  if (scheme !== 'scrypt' || !salt || !/^[0-9a-f]{128}$/i.test(expectedHex || '')) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  return safeEqual(actual, Buffer.from(expectedHex, 'hex'));
}

function idleTimeoutMs() {
  const testOverride = Number(process.env.GEOGESTOR_SESSION_IDLE_MS);
  if (process.env.NODE_ENV === 'test' && Number.isFinite(testOverride) && testOverride > 0) {
    return testOverride;
  }
  const configured = Number(process.env.GEOGESTOR_SESSION_IDLE_MINUTES);
  const minutes = Number.isFinite(configured)
    ? Math.min(240, Math.max(1, configured))
    : DEFAULT_IDLE_MINUTES;
  return minutes * 60 * 1000;
}

function attemptLockoutMs() {
  const testOverride = Number(process.env.GEOGESTOR_ATTEMPT_LOCKOUT_MS);
  if (process.env.NODE_ENV === 'test' && Number.isFinite(testOverride) && testOverride > 0) {
    return testOverride;
  }
  return LOCKOUT_MS;
}

function purgeExpired(now = Date.now()) {
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now || session.lastSeenAt + idleTimeoutMs() <= now) {
      sessions.delete(token);
    }
  }
  for (const [key, record] of attempts) {
    record.failures = record.failures.filter((timestamp) => timestamp > now - ATTEMPT_WINDOW_MS);
    if (record.failures.length === 0 && record.blockedUntil <= now) attempts.delete(key);
  }
}

export const LocalSessionService = {
  get idleMinutes() {
    return idleTimeoutMs() / 60_000;
  },

  getRetryAfterSeconds(key: string) {
    purgeExpired();
    const blockedUntil = attempts.get(key)?.blockedUntil || 0;
    return blockedUntil > Date.now() ? Math.ceil((blockedUntil - Date.now()) / 1000) : 0;
  },

  recordFailure(key: string) {
    const now = Date.now();
    purgeExpired(now);
    const record = attempts.get(key) || { failures: [], blockedUntil: 0 };
    record.failures = record.failures.filter((timestamp) => timestamp > now - ATTEMPT_WINDOW_MS);
    record.failures.push(now);
    if (record.failures.length >= MAX_FAILED_ATTEMPTS) {
      record.blockedUntil = now + attemptLockoutMs();
      record.failures = [];
    }
    attempts.set(key, record);
    return this.getRetryAfterSeconds(key);
  },

  clearFailures(key: string) {
    attempts.delete(key);
  },

  create() {
    purgeExpired();
    const now = Date.now();
    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(token, {
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + MAX_SESSION_HOURS * 60 * 60 * 1000
    });
    return {
      token,
      expiresAt: new Date(now + idleTimeoutMs()).toISOString(),
      idleMinutes: this.idleMinutes
    };
  },

  validate(token: unknown, touch = true) {
    if (typeof token !== 'string' || token.length < 32) return false;
    purgeExpired();
    const session = sessions.get(token);
    if (!session) return false;
    const now = Date.now();
    if (session.expiresAt <= now || session.lastSeenAt + idleTimeoutMs() <= now) {
      sessions.delete(token);
      return false;
    }
    if (touch) session.lastSeenAt = now;
    return true;
  },

  revoke(token: unknown) {
    if (typeof token === 'string') sessions.delete(token);
  },

  revokeAll() {
    sessions.clear();
  }
};
