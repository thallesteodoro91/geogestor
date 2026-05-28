/**
 * Configuração das regras de consistência do importador.
 * Armazenado em localStorage (por usuário/navegador). Cada regra possui
 * dois flags: `enabled` (gera aviso) e `autoFix` (correção automática).
 *
 * Para mudanças reativas dentro da mesma aba, disparamos um CustomEvent
 * `consistency-rules-config-changed` ao salvar.
 */

export interface RuleDefinition {
  code: string;
  label: string;
  description: string;
  supportsAutoFix: boolean;
  /** Default enabled */
  defaultEnabled: boolean;
  /** Default auto-fix enabled (only relevant if supportsAutoFix) */
  defaultAutoFix: boolean;
}

export const CONSISTENCY_RULES: RuleDefinition[] = [
  {
    code: "PAGO_SEM_FORMA",
    label: "Pago sem forma de pagamento",
    description: "Aviso quando uma linha está marcada como Pago mas a forma de pagamento está vazia.",
    supportsAutoFix: false,
    defaultEnabled: true,
    defaultAutoFix: false,
  },
  {
    code: "CANCELADO_COM_FORMA",
    label: "Cancelado com forma preenchida",
    description: "Aviso quando o pagamento está Cancelado mas a forma de pagamento foi preenchida (preservada como histórico).",
    supportsAutoFix: false,
    defaultEnabled: true,
    defaultAutoFix: false,
  },
  {
    code: "RECUSADO_CANCELADO_PAGO",
    label: "Orçamento Recusado/Cancelado marcado como Pago",
    description: "Aviso quando o orçamento está Recusado ou Cancelado mas o pagamento aparece como Pago. Auto-fix: muda pagamento para Cancelado.",
    supportsAutoFix: true,
    defaultEnabled: true,
    defaultAutoFix: true,
  },
  {
    code: "APROVADO_PAGAMENTO_CANCELADO",
    label: "Orçamento Aprovado com pagamento Cancelado",
    description: "Aviso quando o orçamento está Aprovado mas o pagamento foi Cancelado. Auto-fix: muda pagamento para Pendente.",
    supportsAutoFix: true,
    defaultEnabled: true,
    defaultAutoFix: true,
  },
  {
    code: "PARCELADO_PAGO_PARCIAL",
    label: "Parcelado e Pago com valor incompleto",
    description: "Aviso quando a forma é Parcelado, o status é Pago mas valor pago < valor total. Auto-fix: muda pagamento para Parcial.",
    supportsAutoFix: true,
    defaultEnabled: true,
    defaultAutoFix: true,
  },
  {
    code: "PENDENTE_COM_VALOR_PAGO",
    label: "Status Pendente com valor pago > 0",
    description: "Aviso quando o status é Pendente mas há valor pago. Auto-fix: define como Pago (valor total quitado) ou Parcial.",
    supportsAutoFix: true,
    defaultEnabled: true,
    defaultAutoFix: true,
  },
  {
    code: "ATRASADO_EM_ANALISE",
    label: "Atrasado em orçamento Em Análise/Negociação",
    description: "Aviso quando o pagamento aparece Atrasado em orçamento ainda não aprovado. Auto-fix: muda pagamento para Pendente.",
    supportsAutoFix: true,
    defaultEnabled: true,
    defaultAutoFix: true,
  },
  {
    code: "FATURADO_SEM_FORMA",
    label: "Faturado sem forma de pagamento",
    description: "Aviso quando o status é Faturado mas não há forma de pagamento definida.",
    supportsAutoFix: false,
    defaultEnabled: true,
    defaultAutoFix: false,
  },
];

export type RuleConfig = Record<string, { enabled: boolean; autoFix: boolean }>;

const STORAGE_KEY = "geogestor.importer.consistencyRules.v1";
const CHANGE_EVENT = "consistency-rules-config-changed";

export function getDefaultConfig(): RuleConfig {
  const cfg: RuleConfig = {};
  for (const r of CONSISTENCY_RULES) {
    cfg[r.code] = { enabled: r.defaultEnabled, autoFix: r.defaultAutoFix };
  }
  return cfg;
}

export function getRuleConfig(): RuleConfig {
  if (typeof window === "undefined") return getDefaultConfig();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultConfig();
    const parsed = JSON.parse(raw) as Partial<RuleConfig>;
    // merge with defaults so new rules are picked up
    const defaults = getDefaultConfig();
    const merged: RuleConfig = { ...defaults };
    for (const code of Object.keys(defaults)) {
      if (parsed && parsed[code]) {
        merged[code] = {
          enabled: !!parsed[code]!.enabled,
          autoFix: !!parsed[code]!.autoFix,
        };
      }
    }
    return merged;
  } catch {
    return getDefaultConfig();
  }
}

export function setRuleConfig(cfg: RuleConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch (e) {
    console.error("[consistencyRulesConfig] failed to save", e);
  }
}

export function resetRuleConfig(): void {
  setRuleConfig(getDefaultConfig());
}

export function subscribeRuleConfig(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
