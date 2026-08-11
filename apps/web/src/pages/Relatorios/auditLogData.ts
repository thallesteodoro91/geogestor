const sensitiveAuditKey = /(senha|password|secret|token|authorization|cookie|credential|chave.?secreta)/i;

export function parseAuditData(value: string | null) {
  if (!value) return { data: null, invalid: false } as const;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { data: null, invalid: true } as const;
    return { data: parsed as Record<string, unknown>, invalid: false } as const;
  } catch {
    return { data: null, invalid: true } as const;
  }
}

export function redactSensitiveAuditValue(value: unknown, key = '', depth = 0): unknown {
  if (sensitiveAuditKey.test(key)) return '[PROTEGIDO]';
  if (depth > 5) return '[DETALHE OMITIDO]';
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redactSensitiveAuditValue(item, key, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
      childKey,
      redactSensitiveAuditValue(childValue, childKey, depth + 1)
    ]));
  }
  return value;
}

