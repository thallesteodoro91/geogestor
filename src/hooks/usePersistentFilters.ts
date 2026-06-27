/**
 * usePersistentFilters — persiste estado de filtros por página em localStorage.
 *
 * API idêntica a `useState<T>`. Lê o valor inicial do localStorage (se existir
 * e não estiver expirado), e grava cada mudança com debounce curto.
 *
 * TTL padrão: 7 dias. Após esse prazo o filtro é descartado e o valor inicial
 * passado é usado novamente — evita "filtros fantasma" semanas depois.
 *
 * Datas (Date) são serializadas como ISO; reidratadas como Date automaticamente.
 */

import { useEffect, useRef, useState } from "react";

const STORAGE_PREFIX = "geogestor:filters:v1:";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEBOUNCE_MS = 250;

interface Payload<T> {
  savedAt: string;
  value: T;
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
function reviver(_key: string, value: unknown) {
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    return new Date(value);
  }
  return value;
}

export function usePersistentFilters<T>(
  key: string,
  initialValue: T,
  ttlMs: number = DEFAULT_TTL_MS,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const fullKey = `${STORAGE_PREFIX}${key}`;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<T>(() => {
    const s = storage();
    if (!s) return initialValue;
    try {
      const raw = s.getItem(fullKey);
      if (!raw) return initialValue;
      const parsed = JSON.parse(raw, reviver) as Payload<T>;
      if (!parsed?.savedAt) return initialValue;
      const ageMs = Date.now() - new Date(parsed.savedAt).getTime();
      if (ageMs > ttlMs || ageMs < 0) {
        s.removeItem(fullKey);
        return initialValue;
      }
      return parsed.value;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    const s = storage();
    if (!s) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        s.setItem(fullKey, JSON.stringify({ savedAt: new Date().toISOString(), value: state }));
      } catch {
        /* quota — ignore */
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fullKey, state]);

  return [state, setState];
}
