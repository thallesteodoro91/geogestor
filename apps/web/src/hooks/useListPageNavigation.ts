import { useCallback, useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Merge synchronous changes too (e.g. clearing several filters in one action). */
export function useListUrlState() {
  const [params, setParams] = useSearchParams();
  const latest = useRef(params);
  latest.current = params;
  const update = useCallback((changes: Record<string, string | null>, replace = true) => {
    const next = new URLSearchParams(latest.current);
    Object.entries(changes).forEach(([key, value]) => { if (value == null || value === '') next.delete(key); else next.set(key, value); });
    latest.current = next;
    setParams(next, { replace });
  }, [setParams]);
  return { params, update };
}

/** Only explicit page actions move focus, and only after their results arrive. */
export function useListPageNavigation({ page, resolvedPage, ready, failed, scope }: {
  page: number; resolvedPage: number | undefined; ready: boolean; failed: boolean; scope: string;
}) {
  const resultsRef = useRef<HTMLParagraphElement>(null);
  const pending = useRef<{ page: number; scope: string } | null>(null);
  useLayoutEffect(() => {
    if (!pending.current) return;
    if (failed || pending.current.scope !== scope) { pending.current = null; return; }
    if (!ready || page !== resolvedPage || pending.current.page !== page) return;
    pending.current = null;
    resultsRef.current?.focus({ preventScroll: true });
    resultsRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [page, resolvedPage, ready, failed, scope]);
  return { resultsRef, preparePage: (next: number) => { pending.current = { page: next, scope }; }, adjustPage: (next: number) => { if (pending.current) pending.current.page = next; } };
}
