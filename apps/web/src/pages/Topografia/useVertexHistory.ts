import { useCallback, useState } from 'react';

type Updater<T> = T | ((current: T) => T);

export interface VertexHistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function commitVertexHistory<T>(current: VertexHistoryState<T>, updater: Updater<T>, limit: number): VertexHistoryState<T> {
  const next = typeof updater === 'function' ? (updater as (value: T) => T)(current.present) : updater;
  if (Object.is(current.present, next)) return current;
  return { past: [...current.past.slice(-(limit - 1)), current.present], present: next, future: [] };
}

export function undoVertexHistory<T>(current: VertexHistoryState<T>, limit: number): VertexHistoryState<T> {
  const previous = current.past.at(-1);
  if (previous === undefined) return current;
  return { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future].slice(0, limit) };
}

export function redoVertexHistory<T>(current: VertexHistoryState<T>, limit: number): VertexHistoryState<T> {
  const next = current.future[0];
  if (next === undefined) return current;
  return { past: [...current.past.slice(-(limit - 1)), current.present], present: next, future: current.future.slice(1) };
}

export function useVertexHistory<T>(initialState: T, limit = 40) {
  const [history, setHistory] = useState<VertexHistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const commit = useCallback((updater: Updater<T>) => {
    setHistory((current) => commitVertexHistory(current, updater, limit));
  }, [limit]);

  const undo = useCallback(() => {
    setHistory((current) => undoVertexHistory(current, limit));
  }, [limit]);

  const redo = useCallback(() => {
    setHistory((current) => redoVertexHistory(current, limit));
  }, [limit]);

  return {
    state: history.present,
    commit,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

export function shouldHandleHistoryShortcut(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return true;
  return !element.closest('input, textarea, select, [contenteditable="true"]');
}
