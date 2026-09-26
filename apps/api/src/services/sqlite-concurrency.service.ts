const BUSY_PATTERN = /SQLITE_BUSY|database is locked|SQL statements in progress/i;

export function errorMessages(error: unknown): string[] {
  const messages: string[] = [];
  let current = error;
  const visited = new Set<unknown>();
  while (current && !visited.has(current)) {
    visited.add(current);
    if (current instanceof Error) messages.push(current.message);
    else if (typeof current === 'string') messages.push(current);
    current = typeof current === 'object' && current !== null && 'cause' in current
      ? (current as { cause?: unknown }).cause
      : undefined;
  }
  return messages;
}

export function isSqliteBusy(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  return code === 'SQLITE_BUSY' || errorMessages(error).some((message) => BUSY_PATTERN.test(message));
}

export async function withSqliteBusyRetry<T>(operation: () => Promise<T>, attempts = 7): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isSqliteBusy(error) || attempt === attempts - 1) throw error;
      const delayMs = Math.min(25 * (2 ** attempt), 400);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
