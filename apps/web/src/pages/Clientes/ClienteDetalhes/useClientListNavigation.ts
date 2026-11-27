import { useCallback, useLayoutEffect, useRef } from 'react';

// Only an explicit pagination action schedules reading-position/focus changes.
export function useClientListNavigation(page: number) {
  const resultsRef = useRef<HTMLParagraphElement>(null);
  const pendingPage = useRef<number | null>(null);
  useLayoutEffect(() => {
    const targetPage = pendingPage.current;
    pendingPage.current = null;
    if (targetPage !== page || !resultsRef.current) return;
    resultsRef.current.focus({ preventScroll: true });
    // Instant scrolling also respects reduced motion and keeps keyboard reading predictable.
    resultsRef.current.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [page]);
  const resultsAnchor = useCallback((element: HTMLParagraphElement | null) => { resultsRef.current = element; }, []);
  return { resultsAnchor, preparePage: (nextPage: number) => { pendingPage.current = nextPage; } };
}
