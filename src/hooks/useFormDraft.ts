/**
 * useFormDraft — auto-salvamento de formulários em localStorage.
 *
 * Escopo: formulários grandes (Orçamento, Cliente, Propriedade, Serviço, Despesa).
 * Persiste enquanto o usuário digita, sobrevive a refreshes e renovações de token.
 * Ao reabrir, oferece via toast (sonner) restaurar o rascunho ou descartar.
 *
 * TTL padrão: 24h. Após esse prazo o rascunho é descartado silenciosamente.
 */

import { useEffect, useRef } from "react";
import type { UseFormReturn, FieldValues } from "react-hook-form";
import { toast } from "sonner";

const STORAGE_PREFIX = "geogestor:formDraft:v1:";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const DEBOUNCE_MS = 600;

interface DraftPayload<T> {
  savedAt: string;
  values: T;
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

export function loadFormDraft<T = unknown>(
  key: string,
  ttlMs: number = DEFAULT_TTL_MS,
): { values: T; ageMs: number } | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftPayload<T>;
    if (!parsed?.savedAt) return null;
    const ageMs = Date.now() - new Date(parsed.savedAt).getTime();
    if (ageMs > ttlMs || ageMs < 0) {
      s.removeItem(storageKey(key));
      return null;
    }
    return { values: parsed.values, ageMs };
  } catch {
    return null;
  }
}

export function saveFormDraft<T>(key: string, values: T): void {
  const s = storage();
  if (!s) return;
  try {
    const payload: DraftPayload<T> = {
      savedAt: new Date().toISOString(),
      values,
    };
    s.setItem(storageKey(key), JSON.stringify(payload));
  } catch {
    // quota exceeded ou serialização falhou — ignore silenciosamente.
  }
}

export function clearFormDraft(key: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(storageKey(key));
  } catch {
    /* noop */
  }
}

function formatAge(ageMs: number): string {
  const minutes = Math.max(1, Math.round(ageMs / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

interface UseFormDraftOptions<T extends FieldValues> {
  /** Chave única do formulário (ex.: `cliente:new`, `orcamento:wizard`). */
  key: string;
  /** Instância do react-hook-form. */
  form: UseFormReturn<T>;
  /** Quando true ativa watch + restauração. Tipicamente `open && !editando`. */
  enabled: boolean;
  /** Tempo de vida do rascunho. Padrão 24h. */
  ttlMs?: number;
  /** Customizar transformação no restore (ex.: callbacks adicionais). */
  onAfterRestore?: (values: T) => void;
}

/**
 * Hook para auto-save + restauração em formulários react-hook-form.
 *
 * Retorna `clearDraft` — chame após submit bem-sucedido ou cancelamento explícito.
 */
export function useFormDraft<T extends FieldValues>({
  key,
  form,
  enabled,
  ttlMs = DEFAULT_TTL_MS,
  onAfterRestore,
}: UseFormDraftOptions<T>) {
  const offeredRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Oferecer restauração ao abrir o formulário.
  useEffect(() => {
    if (!enabled) {
      offeredRef.current = false;
      return;
    }
    if (offeredRef.current) return;
    offeredRef.current = true;

    const draft = loadFormDraft<T>(key, ttlMs);
    if (!draft) return;

    const toastId = toast(`Rascunho encontrado (${formatAge(draft.ageMs)} atrás)`, {
      description: "Deseja retomar o que estava preenchendo?",
      duration: 12000,
      action: {
        label: "Retomar",
        onClick: () => {
          form.reset(draft.values as T);
          onAfterRestore?.(draft.values);
          toast.success("Rascunho restaurado");
        },
      },
      cancel: {
        label: "Descartar",
        onClick: () => {
          clearFormDraft(key);
        },
      },
    });

    return () => {
      toast.dismiss(toastId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  // Persistir mudanças com debounce.
  useEffect(() => {
    if (!enabled) return;
    const subscription = form.watch((values) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveFormDraft(key, values as T);
      }, DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, key, form]);

  return {
    clearDraft: () => clearFormDraft(key),
  };
}

/**
 * Variante leve para formulários baseados em `useState` (objeto plano).
 */
export function useStateDraft<T extends Record<string, unknown>>(opts: {
  key: string;
  value: T;
  setValue: (v: T) => void;
  enabled: boolean;
  ttlMs?: number;
}) {
  const { key, value, setValue, enabled, ttlMs = DEFAULT_TTL_MS } = opts;
  const offeredRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      offeredRef.current = false;
      return;
    }
    if (offeredRef.current) return;
    offeredRef.current = true;

    const draft = loadFormDraft<T>(key, ttlMs);
    if (!draft) return;

    const toastId = toast(`Rascunho encontrado (${formatAge(draft.ageMs)} atrás)`, {
      description: "Deseja retomar o que estava preenchendo?",
      duration: 12000,
      action: {
        label: "Retomar",
        onClick: () => {
          setValue(draft.values);
          toast.success("Rascunho restaurado");
        },
      },
      cancel: {
        label: "Descartar",
        onClick: () => clearFormDraft(key),
      },
    });
    return () => {
      toast.dismiss(toastId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  useEffect(() => {
    if (!enabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveFormDraft(key, value);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, key, value]);

  return {
    clearDraft: () => clearFormDraft(key),
  };
}
