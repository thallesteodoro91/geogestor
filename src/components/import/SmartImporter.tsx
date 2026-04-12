import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createClientesBatch } from "@/modules/crm/services/cliente.service";
import { createPropriedadesBatch } from "@/modules/crm/services/propriedade.service";
import { createOrcamentosBatch } from "@/modules/finance/services/orcamento.service";
import { createServicosBatch } from "@/modules/operations/services/servico.service";
import { createDespesasBatch } from "@/modules/finance/services/despesa.service";
import { logAuditEvent } from "@/services/audit.service";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2,
  Eye, ArrowRight, ArrowLeft, Download, AlertTriangle, ShieldCheck,
  Sparkles, ExternalLink, Copy, Info, Filter, TrendingUp, TrendingDown,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { KPIData } from "@/domain/types/kpi.types";
import { useKPIs } from "@/hooks/useKPIs";

// ─── Types ──────────────────────────────────────────────────────────────

export type ImportEntityType = "clientes" | "propriedades" | "orcamentos" | "servicos" | "despesas";

interface SmartImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  entityType?: ImportEntityType;
}

type ValidationSeverity = "error" | "warning";

interface FieldValidation {
  message: string;
  severity: ValidationSeverity;
  suggestion?: string;
}

interface SystemField {
  key: string;
  label: string;
  required: boolean;
  format?: (value: string) => string;
  validate?: (value: string) => FieldValidation | null;
  type?: "number" | "date" | "boolean" | "text";
}

interface RowValidation {
  row: Record<string, string>;
  errors: Record<string, FieldValidation>;
  warnings: Record<string, FieldValidation>;
  hasErrors: boolean;
  hasWarnings: boolean;
}

type Step = "upload" | "mapping" | "preview" | "importing" | "result";
type PreviewFilter = "all" | "valid" | "errors" | "warnings";

// ─── Sanitizers ─────────────────────────────────────────────────────────

function sanitizeCurrency(value: string): string {
  let v = value.replace(/R\$\s*/gi, "").trim();
  if (/\d\.\d{3}/.test(v) || /,\d{1,2}$/.test(v)) {
    v = v.replace(/\./g, "").replace(",", ".");
  }
  return v;
}

function sanitizeDigitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function sanitizePhone(value: string): string {
  return formatPhoneNumber(sanitizeDigitsOnly(value));
}

function formatCPF(value: string): string {
  const nums = sanitizeDigitsOnly(value);
  if (nums.length !== 11) return value;
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
}

function formatCNPJ(value: string): string {
  const nums = sanitizeDigitsOnly(value);
  if (nums.length !== 14) return value;
  return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12)}`;
}

function formatDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(trimmed)) return trimmed.slice(0, 10);
  const brMatch = trimmed.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  const usMatch = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (usMatch) {
    const m = parseInt(usMatch[1]), d = parseInt(usMatch[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${usMatch[3]}-${usMatch[1].padStart(2, "0")}-${usMatch[2].padStart(2, "0")}`;
    }
  }
  const num = parseFloat(trimmed);
  if (!isNaN(num) && num > 25000 && num < 60000) {
    const d = new Date(Date.UTC(1899, 11, 30 + Math.round(num)));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return trimmed;
}

// ─── Tolerant Validators ────────────────────────────────────────────────

function validateEmail(v: string): FieldValidation | null {
  if (!v) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return {
    message: `Email inválido: "${v}"`,
    severity: "warning",
    suggestion: "Verifique se o email contém @ e um domínio válido (ex: nome@email.com)",
  };
}

function validateCPF(v: string): FieldValidation | null {
  if (!v) return null;
  const digits = sanitizeDigitsOnly(v);
  if (digits.length === 0) return null;
  if (digits.length === 11) return null; // Valid
  return {
    message: `CPF com ${digits.length} dígitos`,
    severity: "warning",
    suggestion: `CPF válido precisa de 11 dígitos. Valor recebido: ${digits}. Verifique se não faltou um número.`,
  };
}

function validateCNPJ(v: string): FieldValidation | null {
  if (!v) return null;
  const digits = sanitizeDigitsOnly(v);
  if (digits.length === 0) return null;
  if (digits.length === 14) return null;
  return {
    message: `CNPJ com ${digits.length} dígitos`,
    severity: "warning",
    suggestion: `CNPJ válido precisa de 14 dígitos. Valor recebido: ${digits}.`,
  };
}

function validatePhone(v: string): FieldValidation | null {
  if (!v) return null;
  const digits = sanitizeDigitsOnly(v);
  if (digits.length === 0) return null;
  if (digits.length >= 10 && digits.length <= 11) return null; // Perfect
  if (digits.length >= 8 && digits.length <= 9) {
    return {
      message: `Telefone com ${digits.length} dígitos — sem DDD`,
      severity: "warning",
      suggestion: `Provavelmente falta o código de área (DDD). Será importado mesmo assim.`,
    };
  }
  if (digits.length < 8) {
    return {
      message: `Telefone muito curto (${digits.length} dígitos)`,
      severity: "warning",
      suggestion: `Telefone com menos de 8 dígitos. Valor recebido: ${digits}`,
    };
  }
  return {
    message: `Telefone com ${digits.length} dígitos`,
    severity: "warning",
    suggestion: `Número parece longo demais. Verifique se há dígitos extras.`,
  };
}

function validateAge(v: string): FieldValidation | null {
  if (!v) return null;
  const n = parseInt(v);
  if (isNaN(n)) return { message: `"${v}" não é uma idade válida`, severity: "warning", suggestion: "Informe um número inteiro" };
  if (n < 0 || n > 150) return { message: `Idade ${n} fora do intervalo`, severity: "warning", suggestion: "Idade deve estar entre 0 e 150" };
  return null;
}

function validateDate(v: string): FieldValidation | null {
  if (!v) return null;
  const f = formatDate(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) {
    return {
      message: `Data não reconhecida: "${v}"`,
      severity: "error",
      suggestion: "Use o formato DD/MM/AAAA ou AAAA-MM-DD",
    };
  }
  const d = new Date(f + "T00:00:00Z");
  if (isNaN(d.getTime())) {
    return { message: `Data inválida: "${v}"`, severity: "error", suggestion: "Verifique dia, mês e ano" };
  }
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (year < 1900 || year > 2100) {
    return { message: `Ano ${year} fora do intervalo`, severity: "error", suggestion: "Ano deve estar entre 1900 e 2100" };
  }
  // Check if the parsed date matches the input (catches things like month 13)
  const parts = f.split("-");
  if (parseInt(parts[1]) !== month || parseInt(parts[2]) !== day) {
    return { message: `Data inválida: "${v}" (mês ou dia impossível)`, severity: "error", suggestion: "Verifique se mês e dia são válidos" };
  }
  return null;
}

function validateNome(v: string): FieldValidation | null {
  if (!v?.trim()) return { message: "Nome é obrigatório", severity: "error", suggestion: "Preencha o nome do registro" };
  if (v.trim().length < 2) return { message: "Nome muito curto", severity: "warning", suggestion: "Nome deve ter pelo menos 2 caracteres" };
  return null;
}

function validateNumber(v: string): FieldValidation | null {
  if (!v) return null;
  const san = sanitizeCurrency(v);
  const n = parseFloat(san);
  if (isNaN(n)) return { message: `"${v}" não é um número válido`, severity: "warning", suggestion: "Remova caracteres especiais ou use formato numérico" };
  return null;
}

function validatePositiveNumber(v: string): FieldValidation | null {
  if (!v) return null;
  const san = sanitizeCurrency(v);
  const n = parseFloat(san);
  if (isNaN(n)) return { message: `"${v}" não é um número válido`, severity: "warning", suggestion: "Use formato numérico (ex: 1500.00)" };
  if (n < 0) return { message: `Valor negativo: ${n}`, severity: "warning", suggestion: "Verifique se o valor deveria ser positivo" };
  return null;
}

function validateLatitude(v: string): FieldValidation | null {
  if (!v) return null;
  const n = parseFloat(v);
  if (isNaN(n)) return { message: `"${v}" não é uma latitude válida`, severity: "warning", suggestion: "Use formato decimal (ex: -15.7942)" };
  if (n < -90 || n > 90) return { message: `Latitude ${n} fora do intervalo`, severity: "error", suggestion: "Latitude deve estar entre -90 e 90" };
  return null;
}

function validateLongitude(v: string): FieldValidation | null {
  if (!v) return null;
  const n = parseFloat(v);
  if (isNaN(n)) return { message: `"${v}" não é uma longitude válida`, severity: "warning", suggestion: "Use formato decimal (ex: -49.2643)" };
  if (n < -180 || n > 180) return { message: `Longitude ${n} fora do intervalo`, severity: "error", suggestion: "Longitude deve estar entre -180 e 180" };
  return null;
}

function validateRequiredNumber(v: string): FieldValidation | null {
  if (!v?.trim()) return { message: "Valor é obrigatório", severity: "error", suggestion: "Preencha o valor numérico" };
  const san = sanitizeCurrency(v);
  const n = parseFloat(san);
  if (isNaN(n)) return { message: `"${v}" não é um número válido`, severity: "error", suggestion: "Use formato numérico (ex: 5000 ou 5000.00)" };
  if (n <= 0) return { message: `Valor deve ser maior que zero (recebido: ${n})`, severity: "error", suggestion: "Informe um valor positivo" };
  return null;
}

// ─── Entity-specific field definitions ─────────────────────────────────

const CLIENTE_FIELDS: SystemField[] = [
  { key: "nome", label: "Nome", required: true, validate: validateNome },
  { key: "cpf", label: "CPF", required: false, format: formatCPF, validate: validateCPF },
  { key: "cnpj", label: "CNPJ", required: false, format: formatCNPJ, validate: validateCNPJ },
  { key: "telefone", label: "Telefone", required: false, format: sanitizePhone, validate: validatePhone },
  { key: "celular", label: "Celular", required: false, format: sanitizePhone, validate: validatePhone },
  { key: "email", label: "Email", required: false, validate: validateEmail },
  { key: "endereco", label: "Endereço", required: false },
  { key: "categoria", label: "Categoria", required: false },
  { key: "origem", label: "Origem", required: false },
  { key: "situacao", label: "Situação", required: false },
  { key: "anotacoes", label: "Observações", required: false },
  { key: "data_cadastro", label: "Data de Cadastro", required: false, format: formatDate, validate: validateDate },
  { key: "idade", label: "Idade", required: false, validate: validateAge, type: "number" },
];

const PROPRIEDADE_FIELDS: SystemField[] = [
  { key: "nome_da_propriedade", label: "Nome da Propriedade", required: true, validate: validateNome },
  { key: "municipio", label: "Município", required: false },
  { key: "cidade", label: "Cidade", required: false },
  { key: "area_ha", label: "Área (ha)", required: false, validate: validatePositiveNumber, type: "number" },
  { key: "tipo", label: "Tipo", required: false },
  { key: "situacao", label: "Situação", required: false },
  { key: "situacao_imovel", label: "Situação do Imóvel", required: false },
  { key: "tipo_de_documento", label: "Tipo de Documento", required: false },
  { key: "matricula", label: "Matrícula", required: false },
  { key: "car", label: "CAR", required: false },
  { key: "ccir", label: "CCIR", required: false },
  { key: "itr", label: "ITR", required: false },
  { key: "latitude", label: "Latitude", required: false, validate: validateLatitude, type: "number" },
  { key: "longitude", label: "Longitude", required: false, validate: validateLongitude, type: "number" },
  { key: "anotacoes", label: "Anotações", required: false },
  { key: "observacoes", label: "Observações", required: false },
];

const ORCAMENTO_FIELDS: SystemField[] = [
  { key: "data_orcamento", label: "Data do Orçamento", required: true, format: formatDate, validate: validateDate, type: "date" },
  { key: "valor_unitario", label: "Valor Unitário", required: true, validate: validateRequiredNumber, type: "number" },
  { key: "quantidade", label: "Quantidade", required: false, type: "number" },
  { key: "desconto", label: "Desconto", required: false, validate: validatePositiveNumber, type: "number" },
  { key: "receita_esperada", label: "Receita Esperada", required: false, validate: validatePositiveNumber, type: "number" },
  { key: "situacao", label: "Situação", required: false },
  { key: "situacao_do_pagamento", label: "Situação do Pagamento", required: false },
  { key: "forma_de_pagamento", label: "Forma de Pagamento", required: false },
  { key: "data_do_faturamento", label: "Data de Faturamento", required: false, format: formatDate, validate: validateDate, type: "date" },
  { key: "data_inicio", label: "Data Início", required: false, format: formatDate, validate: validateDate, type: "date" },
  { key: "data_termino", label: "Data Término", required: false, format: formatDate, validate: validateDate, type: "date" },
  { key: "anotacoes", label: "Anotações", required: false },
];

const SERVICO_FIELDS: SystemField[] = [
  { key: "nome_do_servico", label: "Nome do Serviço", required: true, validate: validateNome },
  { key: "categoria", label: "Categoria", required: false },
  { key: "data_do_servico_inicio", label: "Data Início", required: false, format: formatDate, validate: validateDate, type: "date" },
  { key: "data_do_servico_fim", label: "Data Fim", required: false, format: formatDate, validate: validateDate, type: "date" },
  { key: "situacao_do_servico", label: "Situação", required: false },
  { key: "receita_servico", label: "Receita", required: false, validate: validatePositiveNumber, type: "number" },
  { key: "custo_servico", label: "Custo", required: false, validate: validatePositiveNumber, type: "number" },
  { key: "descricao", label: "Descrição", required: false },
  { key: "progresso", label: "Progresso (%)", required: false, validate: validatePositiveNumber, type: "number" },
];

const DESPESA_FIELDS: SystemField[] = [
  { key: "valor_da_despesa", label: "Valor da Despesa", required: true, validate: validateRequiredNumber, type: "number" },
  { key: "data_da_despesa", label: "Data da Despesa", required: true, format: formatDate, validate: validateDate, type: "date" },
  { key: "_categoria_lookup", label: "Categoria/Tipo de Despesa", required: false },
  { key: "observacoes", label: "Observações", required: false },
  { key: "status", label: "Status", required: false },
];

function getFieldsForEntity(entity: ImportEntityType): SystemField[] {
  switch (entity) {
    case "propriedades": return PROPRIEDADE_FIELDS;
    case "orcamentos": return ORCAMENTO_FIELDS;
    case "servicos": return SERVICO_FIELDS;
    case "despesas": return DESPESA_FIELDS;
    default: return CLIENTE_FIELDS;
  }
}

// ─── Entity-specific synonyms ──────────────────────────────────────────

const CLIENTE_SYNONYMS: Record<string, string[]> = {
  nome: ["cliente", "razaosocial", "nomecompleto", "nomerazao", "contato", "nomefantasia", "razao", "nomecontato", "nomecliente", "clientenome", "nomedocliente"],
  cpf: ["documento", "cpfcnpj", "doc", "documentocliente"],
  cnpj: ["documento", "cpfcnpj", "inscricao", "cnpjcliente"],
  telefone: ["fone", "tel", "fixo", "telefonecontato", "telefonefixo", "fonecontato", "telefone1", "tel1", "fone1"],
  celular: ["whatsapp", "zap", "mobile", "cel", "telefonemovil", "celularcontato", "wpp", "telefonemovel", "telefone2", "tel2"],
  email: ["correio", "mail", "emailcontato", "emailcliente", "correioeletronico"],
  endereco: ["local", "localizacao", "cidade", "rua", "logradouro", "end", "enderecocompleto", "morada"],
  categoria: ["tipo", "segmento", "classificacao", "tipocliente", "grupocliente"],
  origem: ["canal", "comoconheceu", "fonte", "indicacao", "prospeccao", "origemcliente"],
  situacao: ["status", "ativo", "estado", "statuscliente", "ativoinativo"],
  anotacoes: ["observacao", "obs", "nota", "comentario", "descricao", "notas", "observacoes"],
  data_cadastro: ["data", "datacadastro", "cadastradoem", "dtcadastro", "datacriacao", "datainicio", "criadoem", "dt"],
  idade: ["age", "idadecliente"],
};

const PROPRIEDADE_SYNONYMS: Record<string, string[]> = {
  nome_da_propriedade: ["propriedade", "fazenda", "sitio", "chacara", "lote", "imovel", "nomepropriedade", "nomeimovel", "nomefazenda", "prop", "gleba", "terreno"],
  municipio: ["cidade", "mun", "localidade"],
  cidade: ["municipio", "localidade"],
  area_ha: ["area", "areaha", "hectares", "tamanho", "areahectare", "ha"],
  tipo: ["tipoimovel", "tipopropriedade", "classificacao"],
  situacao: ["status", "estado", "situacaoimovel"],
  situacao_imovel: ["statusimovel", "condicao"],
  matricula: ["registroimovel", "nummatricula", "numeromatricula"],
  car: ["cadastroambiental", "cadastroambientalrural"],
  ccir: ["certificadoimovelrural"],
  itr: ["impostoterritoralrural", "impostoterritorial"],
  latitude: ["lat", "coordlat"],
  longitude: ["lng", "lon", "coordlng", "coordlon"],
  anotacoes: ["observacao", "obs", "nota", "comentario", "notas", "observacoes"],
  observacoes: ["observacao", "obs", "nota", "comentario", "notas", "anotacoes"],
};

const ORCAMENTO_SYNONYMS: Record<string, string[]> = {
  data_orcamento: ["data", "dataorcamento", "dtorcamento", "dataemissao", "dt"],
  valor_unitario: ["valorunit", "preco", "valorservico", "precounitario", "valor", "vlr", "vlrunit", "valorha", "valorhectare", "precoha"],
  quantidade: ["qtd", "qtde", "quant", "qty"],
  desconto: ["desc", "descontos"],
  receita_esperada: ["receita", "valortotal", "total", "receitaesperada", "faturamento", "valortotalservico", "amount", "revenue", "precoservico", "valorcontrato"],
  situacao: ["status", "estado", "statusorcamento"],
  situacao_do_pagamento: ["pagamento", "statuspagamento", "situacaopagamento"],
  forma_de_pagamento: ["formapagamento", "meiodepagamento", "tipopagamento"],
  data_do_faturamento: ["datafaturamento", "dtfaturamento", "vencimento", "datavencimento"],
  data_inicio: ["inicio", "datainicio", "dtinicio"],
  data_termino: ["termino", "fim", "datatermino", "dttermino", "datafim"],
  anotacoes: ["observacao", "obs", "nota", "comentario", "notas", "observacoes"],
};

const SERVICO_SYNONYMS: Record<string, string[]> = {
  nome_do_servico: ["servico", "projeto", "nome", "titulo", "nomeservico", "nomeprojeto", "atividade"],
  categoria: ["tipo", "classificacao", "tiposervico", "area"],
  data_do_servico_inicio: ["datainicio", "inicio", "dtinicio", "data", "dt"],
  data_do_servico_fim: ["datafim", "termino", "prazo", "dtfim", "datatermino"],
  situacao_do_servico: ["status", "situacao", "estado", "andamento"],
  receita_servico: ["receita", "valor", "faturamento", "preco", "vlr", "valorservico", "amount", "revenue", "valorcontrato", "total"],
  custo_servico: ["custo", "despesa", "gasto"],
  descricao: ["observacao", "obs", "detalhes", "nota", "anotacao", "observacoes"],
  progresso: ["percentual", "andamento", "conclusao"],
};

const DESPESA_SYNONYMS: Record<string, string[]> = {
  valor_da_despesa: ["valor", "gasto", "custo", "montante", "total", "preco", "vlr", "amount", "expense", "pagamento", "valorpago", "despesa"],
  data_da_despesa: ["data", "dt", "datadespesa", "datadogasto", "datapagamento"],
  observacoes: ["observacao", "obs", "nota", "descricao", "comentario", "detalhes"],
  status: ["situacao", "estado", "confirmada", "pendente"],
  _categoria_lookup: ["categoria", "tipo", "classificacao", "natureza", "grupo", "tipodespesa", "categoriadespesa"],
};

function getSynonymsForEntity(entity: ImportEntityType): Record<string, string[]> {
  switch (entity) {
    case "propriedades": return PROPRIEDADE_SYNONYMS;
    case "orcamentos": return ORCAMENTO_SYNONYMS;
    case "servicos": return SERVICO_SYNONYMS;
    case "despesas": return DESPESA_SYNONYMS;
    default: return CLIENTE_SYNONYMS;
  }
}

// ─── Entity labels ─────────────────────────────────────────────────────

const ENTITY_LABELS: Record<ImportEntityType, { singular: string; plural: string; titlePlural: string; route: string; queryKey: string }> = {
  clientes: { singular: "cliente", plural: "clientes", titlePlural: "Clientes", route: "/clientes", queryKey: "clientes-list" },
  propriedades: { singular: "propriedade", plural: "propriedades", titlePlural: "Propriedades", route: "/clientes", queryKey: "propriedades" },
  orcamentos: { singular: "orçamento", plural: "orçamentos", titlePlural: "Orçamentos", route: "/orcamentos", queryKey: "orcamentos" },
  servicos: { singular: "projeto", plural: "projetos", titlePlural: "Projetos", route: "/projetos", queryKey: "servicos" },
  despesas: { singular: "despesa", plural: "despesas", titlePlural: "Despesas", route: "/despesas", queryKey: "despesas" },
};

// ─── Auto-detection ────────────────────────────────────────────────────

function detectEntityType(fileHeaders: string[]): { entity: ImportEntityType; confidence: number } {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s\-.*]/g, "");
  const normalized = fileHeaders.map(norm);

  const scores: Record<ImportEntityType, number> = { clientes: 0, propriedades: 0, orcamentos: 0, servicos: 0, despesas: 0 };
  const entities: ImportEntityType[] = ["clientes", "propriedades", "orcamentos", "servicos", "despesas"];

  for (const entity of entities) {
    const fields = getFieldsForEntity(entity);
    const synonyms = getSynonymsForEntity(entity);
    for (const field of fields) {
      const fNorm = norm(field.key);
      const lNorm = norm(field.label);
      const syns = synonyms[field.key] || [];
      for (const h of normalized) {
        if (h === fNorm || h === lNorm) { scores[entity] += 3; break; }
        if (syns.some(s => h === s || h.includes(s) || s.includes(h))) { scores[entity] += 2; break; }
        if (h.includes(fNorm) || fNorm.includes(h)) { scores[entity] += 1; break; }
      }
    }
  }

  const sorted = entities.sort((a, b) => scores[b] - scores[a]);
  const best = sorted[0];
  const maxScore = scores[best];
  const totalPossible = getFieldsForEntity(best).length * 3;
  return { entity: best, confidence: totalPossible > 0 ? Math.round((maxScore / totalPossible) * 100) : 0 };
}

// ─── Template downloads ────────────────────────────────────────────────

function downloadEntityTemplate(entity: ImportEntityType) {
  const fields = getFieldsForEntity(entity);
  const headers = fields.map((f) => f.label + (f.required ? " *" : ""));
  const exampleRows: Record<ImportEntityType, string[]> = {
    propriedades: ["Fazenda Boa Vista", "Goiânia", "Goiânia", "150.5", "Rural", "Regular", "Regular", "Escritura", "12345", "GO-1234567-890", "1234567890", "1234567890", "-15.7942", "-49.2643", "", ""],
    orcamentos: ["2024-01-15", "5000.00", "1", "0", "5000.00", "Aprovado", "Pendente", "PIX", "", "2024-02-01", "2024-03-01", ""],
    clientes: ["João da Silva", "123.456.789-00", "", "(62) 3333-4444", "(62) 99999-8888", "joao@email.com", "Rua das Flores, 123", "Produtor Rural", "Indicação", "Ativo", "Cliente fiel", "2024-01-15", "45"],
    servicos: ["Levantamento Topográfico", "Topografia", "2024-01-15", "2024-02-15", "Em Andamento", "5000.00", "2000.00", "Serviço de campo", "50"],
    despesas: ["1500.00", "2024-01-20", "Combustível para campo", "confirmada"],
  };
  const csvContent = [headers.join(";"), (exampleRows[entity] || []).join(";")].join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `modelo_importacao_${entity}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Normalize helper ──────────────────────────────────────────────────

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s\-.*]/g, "");

type MatchConfidence = "exact" | "synonym" | "partial";

const STEP_LABELS: Record<string, string> = {
  upload: "Enviar Arquivo",
  mapping: "Associar Colunas",
  preview: "Conferir Dados",
  result: "Resultado",
};

const PREVIEW_PAGE_SIZE = 25;

// ─── Component ──────────────────────────────────────────────────────────

export function SmartImporter({
  open, onOpenChange, onSuccess, entityType: initialEntityType = "clientes",
}: SmartImporterProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("upload");
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [skipErrors, setSkipErrors] = useState(true);
  const [importResult, setImportResult] = useState<{
    success: number; errors: string[]; failedRows: Record<string, string>[];
  } | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [defaultValues, setDefaultValues] = useState<Record<string, string>>({});
  const [matchConfidences, setMatchConfidences] = useState<Record<string, MatchConfidence>>({});
  const [entityType, setEntityType] = useState<ImportEntityType>(initialEntityType);
  const [detectedEntity, setDetectedEntity] = useState<{ entity: ImportEntityType; confidence: number } | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>("all");
  const [previewPage, setPreviewPage] = useState(0);

  const SYSTEM_FIELDS = useMemo(() => getFieldsForEntity(entityType), [entityType]);
  const FIELD_SYNONYMS = useMemo(() => getSynonymsForEntity(entityType), [entityType]);
  const entityLabel = ENTITY_LABELS[entityType];

  const reset = () => {
    setImportProgress(0);
    setDefaultValues({});
    setStep("upload");
    setRawData([]);
    setHeaders([]);
    setMappings({});
    setFileName("");
    setImportResult(null);
    setSkipErrors(true);
    setMatchConfidences({});
    setDetectedEntity(null);
    setDuplicateCount(0);
    setEntityType(initialEntityType);
    setPreviewFilter("all");
    setPreviewPage(0);
  };

  // ─── File processing ───────────────────────────────────────────────

  const autoMap = useCallback((fileHeaders: string[], fields: SystemField[], synonyms: Record<string, string[]>) => {
    const newMappings: Record<string, string> = {};
    const confidences: Record<string, MatchConfidence> = {};

    for (const field of fields) {
      const b = normalize(field.key);
      const c = normalize(field.label);

      let match = fileHeaders.find((h) => { const a = normalize(h); return a === b || a === c; });
      if (match) { newMappings[field.key] = match; confidences[field.key] = "exact"; continue; }

      const syns = synonyms[field.key] || [];
      match = fileHeaders.find((h) => { const a = normalize(h); return syns.some((syn) => a === syn || a.includes(syn) || syn.includes(a)); });
      if (match) { newMappings[field.key] = match; confidences[field.key] = "synonym"; continue; }

      match = fileHeaders.find((h) => { const a = normalize(h); return a.includes(b) || b.includes(a) || a.includes(c) || c.includes(a); });
      if (match) { newMappings[field.key] = match; confidences[field.key] = "partial"; }
    }
    setMappings(newMappings);
    setMatchConfidences(confidences);
  }, []);

  const processHeaders = useCallback((h: string[], data: string[][]) => {
    setHeaders(h);
    setRawData(data);

    const detection = detectEntityType(h);
    setDetectedEntity(detection);

    const effectiveEntity = detection.confidence > 40 ? detection.entity : initialEntityType;
    setEntityType(effectiveEntity);

    const fields = getFieldsForEntity(effectiveEntity);
    const synonyms = getSynonymsForEntity(effectiveEntity);
    autoMap(h, fields, synonyms);
    setStep("mapping");
  }, [initialEntityType, autoMap]);

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv" || ext === "txt") {
      Papa.parse(file, {
        encoding: "UTF-8",
        complete: (result) => {
          const data = result.data as string[][];
          if (data.length < 2) { toast.error("Arquivo vazio ou sem dados suficientes."); return; }
          const h = data[0].map((c) => (c ?? "").toString().trim());
          processHeaders(h, data.slice(1).filter((r) => r.some((c) => c?.toString().trim())));
        },
        error: (err) => toast.error(`Erro ao ler CSV: ${err.message}`),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
        if (data.length < 2) { toast.error("Planilha vazia ou sem dados suficientes."); return; }
        const h = data[0].map((c: any) => (c ?? "").toString().trim());
        const rows = data.slice(1)
          .filter((r: any[]) => r.some((c: any) => c != null && c.toString().trim()))
          .map((r: any[]) => r.map((c: any) => {
            if (c == null) return "";
            if (c instanceof Date) {
              if (isNaN(c.getTime())) return "";
              return c.toISOString().slice(0, 10);
            }
            return c.toString();
          }));
        processHeaders(h, rows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Formato não suportado. Use CSV ou Excel (.xlsx/.xls)");
    }
  }, [processHeaders]);

  const handleEntityChange = (newEntity: ImportEntityType) => {
    setEntityType(newEntity);
    const fields = getFieldsForEntity(newEntity);
    const synonyms = getSynonymsForEntity(newEntity);
    autoMap(headers, fields, synonyms);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  // ─── Validation engine (tolerant) ─────────────────────────────────

  const validateAndFormatRow = useCallback((row: string[]): RowValidation => {
    const mapped: Record<string, string> = {};
    const errors: Record<string, FieldValidation> = {};
    const warnings: Record<string, FieldValidation> = {};

    for (const field of SYSTEM_FIELDS) {
      if (!mappings[field.key]) continue;
      const idx = headers.indexOf(mappings[field.key]);
      let val = idx >= 0 ? (row[idx] ?? "").toString().trim() : "";
      if (!val && defaultValues[field.key]) val = defaultValues[field.key].trim();

      // Auto-normalize before validation
      if (val && field.type === "number" && /[R$,]/.test(val)) {
        val = sanitizeCurrency(val);
      } else if (val && !field.type && /R\$|,\d{2}$/.test(val)) {
        val = sanitizeCurrency(val);
      }
      if (val && field.format) val = field.format(val);
      mapped[field.key] = val;

      if (field.validate) {
        const result = field.validate(val);
        if (result) {
          if (result.severity === "error") {
            errors[field.key] = result;
          } else {
            warnings[field.key] = result;
          }
        }
      }
    }

    // Check required fields
    for (const field of SYSTEM_FIELDS) {
      if (field.required && mappings[field.key] && !mapped[field.key]?.trim() && !defaultValues[field.key]?.trim()) {
        errors[field.key] = {
          message: `${field.label} é obrigatório`,
          severity: "error",
          suggestion: `Preencha o campo "${field.label}" na planilha ou defina um valor padrão no mapeamento.`,
        };
      }
    }

    return {
      row: mapped,
      errors,
      warnings,
      hasErrors: Object.keys(errors).length > 0,
      hasWarnings: Object.keys(warnings).length > 0,
    };
  }, [mappings, headers, defaultValues, SYSTEM_FIELDS]);

  const allValidatedRows = useMemo(() => rawData.map((row) => validateAndFormatRow(row)), [rawData, validateAndFormatRow]);
  const errorCount = useMemo(() => allValidatedRows.filter((v) => v.hasErrors).length, [allValidatedRows]);
  const warningCount = useMemo(() => allValidatedRows.filter((v) => v.hasWarnings && !v.hasErrors).length, [allValidatedRows]);
  const validCount = useMemo(() => allValidatedRows.filter((v) => !v.hasErrors).length, [allValidatedRows]);
  const mappedFields = SYSTEM_FIELDS.filter((f) => mappings[f.key]);
  const canImport = skipErrors ? validCount > 0 : errorCount === 0;

  // Filtered and paginated rows for preview
  const filteredRows = useMemo(() => {
    let filtered = allValidatedRows.map((v, i) => ({ ...v, originalIndex: i }));
    switch (previewFilter) {
      case "valid": filtered = filtered.filter(v => !v.hasErrors && !v.hasWarnings); break;
      case "errors": filtered = filtered.filter(v => v.hasErrors); break;
      case "warnings": filtered = filtered.filter(v => v.hasWarnings && !v.hasErrors); break;
    }
    return filtered;
  }, [allValidatedRows, previewFilter]);

  const totalPreviewPages = Math.ceil(filteredRows.length / PREVIEW_PAGE_SIZE);
  const paginatedRows = useMemo(
    () => filteredRows.slice(previewPage * PREVIEW_PAGE_SIZE, (previewPage + 1) * PREVIEW_PAGE_SIZE),
    [filteredRows, previewPage]
  );

  // Error summary grouped by type
  const errorSummary = useMemo(() => {
    const groups: Record<string, { count: number; severity: ValidationSeverity; example: string; suggestion: string }> = {};
    for (const v of allValidatedRows) {
      for (const fv of [...Object.values(v.errors), ...Object.values(v.warnings)]) {
        const key = fv.message;
        if (!groups[key]) {
          groups[key] = { count: 0, severity: fv.severity, example: fv.message, suggestion: fv.suggestion || "" };
        }
        groups[key].count++;
      }
    }
    return Object.entries(groups).sort((a, b) => b[1].count - a[1].count);
  }, [allValidatedRows]);

  // ─── Financial preview ───────────────────────────────────────────────
  const financialPreview = useMemo(() => {
    if (entityType !== "orcamentos" && entityType !== "despesas" && entityType !== "servicos") return null;
    const validRows = allValidatedRows.filter(v => !v.hasErrors);
    let receita = 0;
    let despesas = 0;
    let count = 0;

    for (const v of validRows) {
      if (entityType === "orcamentos") {
        const re = parseFloat(sanitizeCurrency(v.row.receita_esperada || "")) || 0;
        const vu = parseFloat(sanitizeCurrency(v.row.valor_unitario || "")) || 0;
        const qty = parseInt(v.row.quantidade || "1") || 1;
        const desc = parseFloat(sanitizeCurrency(v.row.desconto || "0")) || 0;
        const val = re > 0 ? re : (vu * qty) - desc;
        if (val > 0) { receita += val; count++; }
      } else if (entityType === "despesas") {
        const val = parseFloat(sanitizeCurrency(v.row.valor_da_despesa || "")) || 0;
        if (val > 0) { despesas += val; count++; }
      } else if (entityType === "servicos") {
        const val = parseFloat(sanitizeCurrency(v.row.receita_servico || "")) || 0;
        if (val > 0) { receita += val; count++; }
      }
    }

    if (receita === 0 && despesas === 0) return null;
    return { receita, despesas, lucro: receita - despesas, count };
  }, [allValidatedRows, entityType]);


  const checkDuplicates = useCallback(async () => {
    if (entityType !== "clientes" && entityType !== "servicos") return;

    const nameField = entityType === "clientes" ? "nome" : "nome_do_servico";
    const table = entityType === "clientes" ? "dim_cliente" : "fato_servico";
    const names = allValidatedRows
      .filter(v => !v.hasErrors)
      .map(v => v.row[nameField]?.trim().toLowerCase())
      .filter(Boolean);

    if (names.length === 0) return;

    const { data } = await supabase.from(table).select(nameField);
    if (!data) return;

    const existingNames = new Set(data.map((r: any) => r[nameField]?.toLowerCase()));
    const dupes = names.filter(n => existingNames.has(n));
    setDuplicateCount(dupes.length);
  }, [entityType, allValidatedRows]);

  // ─── Auto-linking (with auto-create) ────────────────────────────────

  const linkToClients = useCallback(async (records: Record<string, any>[]): Promise<Record<string, any>[]> => {
    if (entityType !== "propriedades" && entityType !== "servicos" && entityType !== "orcamentos") return records;

    const clienteHeader = headers.find(h => {
      const n = normalize(h);
      return ["cliente", "nomecliente", "proprietario", "dono", "nomedocliente", "clientenome"].some(s => n === s || n.includes(s));
    });
    if (!clienteHeader) return records;

    const { data: clientes } = await supabase.from("dim_cliente").select("id_cliente, nome");
    const clienteMap = new Map((clientes || []).map(c => [c.nome?.toLowerCase(), c.id_cliente]));
    const clienteIdx = headers.indexOf(clienteHeader);

    const namesToCreate = new Set<string>();
    for (let i = 0; i < records.length; i++) {
      if (records[i].id_cliente) continue;
      const rawRow = rawData[i];
      const nome = rawRow?.[clienteIdx]?.toString().trim();
      if (nome && !clienteMap.has(nome.toLowerCase())) {
        namesToCreate.add(nome);
      }
    }

    if (namesToCreate.size > 0) {
      const newClients = Array.from(namesToCreate).map(nome => ({ nome }));
      try {
        const result = await createClientesBatch(newClients);
        if (result.success > 0) {
          const { data: updated } = await supabase.from("dim_cliente").select("id_cliente, nome");
          if (updated) {
            for (const c of updated) {
              clienteMap.set(c.nome?.toLowerCase(), c.id_cliente);
            }
          }
          toast.success(`${result.success} cliente(s) criado(s) automaticamente`);
        }
      } catch (e) {
        console.error("Erro ao criar clientes automaticamente:", e);
      }
    }

    return records.map((r, i) => {
      if (r.id_cliente) return r;
      const rawRow = rawData[i];
      const clienteNome = rawRow?.[clienteIdx]?.toString().trim().toLowerCase();
      if (clienteNome) {
        const id = clienteMap.get(clienteNome);
        if (id) return { ...r, id_cliente: id };
      }
      return r;
    });
  }, [entityType, headers, rawData]);

  // ─── Import handler ───────────────────────────────────────────────

  const handleImport = async () => {
    const requiredMissing = SYSTEM_FIELDS.filter((f) => f.required && !mappings[f.key] && !defaultValues[f.key]?.trim());
    if (requiredMissing.length) {
      toast.error(`Campos obrigatórios: ${requiredMissing.map((f) => f.label).join(", ")}`);
      return;
    }

    setStep("importing");
    setIsLoading(true);
    setImportProgress(0);

    try {
      const skippedErrors: string[] = [];
      let recordsToInsert: Record<string, any>[] = [];
      const failedRows: Record<string, string>[] = [];

      for (let i = 0; i < allValidatedRows.length; i++) {
        const validation = allValidatedRows[i];
        // Only block on ERRORS, not warnings
        if (validation.hasErrors) {
          if (skipErrors) {
            const errorMessages = Object.entries(validation.errors)
              .map(([key, fv]) => {
                const field = SYSTEM_FIELDS.find(f => f.key === key);
                return `${field?.label || key}: ${fv.message}`;
              });
            skippedErrors.push(`Linha ${i + 2}: ${errorMessages.join(", ")}`);
            failedRows.push({ ...validation.row, _erro: errorMessages.join("; ") });
            continue;
          }
        }

        const record: Record<string, any> = {};
        for (const field of SYSTEM_FIELDS) {
          if (!mappings[field.key]) continue;
          if (field.key === "_categoria_lookup") continue; // lookup-only field, skip insert
          let val: any = validation.row[field.key];
          if (!val) { record[field.key] = null; continue; }
          if (field.type === "number") val = parseFloat(val) || null;
          record[field.key] = val;
        }
        if (entityType === "orcamentos" && !record.quantidade) record.quantidade = 1;
        if (entityType === "orcamentos" && !record.receita_esperada && record.valor_unitario) {
          const qty = record.quantidade || 1;
          const desc = record.desconto || 0;
          record.receita_esperada = (record.valor_unitario * qty) - desc;
        }
        if (entityType === "despesas" && !record.status) record.status = "confirmada";
        recordsToInsert.push(record);
      }

      setImportProgress(20);
      recordsToInsert = await linkToClients(recordsToInsert);
      setImportProgress(30);

      // Auto-link expenses to expense types by category name
      if (entityType === "despesas" && mappings["_categoria_lookup"]) {
        try {
          const { data: tiposDespesa } = await supabase.from("dim_tipodespesa").select("id_tipodespesa, categoria, subcategoria");
          if (tiposDespesa && tiposDespesa.length > 0) {
            const tipoMap = new Map<string, string>();
            for (const t of tiposDespesa) {
              tipoMap.set(normalize(t.categoria), t.id_tipodespesa);
              if (t.subcategoria) tipoMap.set(normalize(t.subcategoria), t.id_tipodespesa);
            }
            let linked = 0;
            for (const rec of recordsToInsert) {
              if (rec.id_tipodespesa) continue;
              const catIdx = headers.indexOf(mappings["_categoria_lookup"]);
              const rowIdx = recordsToInsert.indexOf(rec);
              const rawRow = rawData[allValidatedRows.findIndex((v, i) => !v.hasErrors && recordsToInsert.indexOf(rec) !== -1) || 0];
              const catValue = rawRow?.[catIdx]?.toString().trim();
              if (catValue) {
                const id = tipoMap.get(normalize(catValue));
                if (id) { rec.id_tipodespesa = id; linked++; }
              }
            }
            if (linked > 0) toast.success(`${linked} despesa(s) vinculada(s) automaticamente a tipos existentes`);
          }
        } catch (e) {
          console.warn("Erro ao vincular tipos de despesa:", e);
        }
      }

      setImportProgress(40);

      let result: { success: number; errors: string[] };
      switch (entityType) {
        case "propriedades": result = await createPropriedadesBatch(recordsToInsert as any); break;
        case "orcamentos": result = await createOrcamentosBatch(recordsToInsert as any); break;
        case "servicos": result = await createServicosBatch(recordsToInsert as any); break;
        case "despesas": result = await createDespesasBatch(recordsToInsert as any); break;
        default: result = await createClientesBatch(recordsToInsert as any); break;
      }

      setImportProgress(90);
      const allErrors = [...skippedErrors, ...result.errors];
      setImportResult({ success: result.success, errors: allErrors, failedRows });
      setStep("result");
      setImportProgress(100);

      logAuditEvent({
        action: 'INSERT', entity: `importacao_${entityType}`,
        newData: { entidade: entityType, arquivo: fileName, total_linhas: allValidatedRows.length, importados_com_sucesso: result.success, linhas_com_erro: allErrors.length, erros: allErrors.slice(0, 20) },
      });

      if (result.success > 0) {
        // Invalidate entity-specific + financial caches
        [entityLabel.queryKey, "resource-counts", "kpis", "dashboard-metrics", "financial-data", "chart-data"]
          .forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
        onSuccess?.();
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
      setStep("preview");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Download failed rows ────────────────────────────────────────

  const downloadFailedRows = () => {
    if (!importResult?.failedRows?.length) return;
    const fields = [...mappedFields.map(f => f.label), "Erro"];
    const keys = [...mappedFields.map(f => f.key), "_erro"];
    const rows = importResult.failedRows.map(r => keys.map(k => r[k] || "").join(";"));
    const csv = [fields.join(";"), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "linhas_com_erro.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const getNextStepTip = (): { text: string; route: string } | null => {
    switch (entityType) {
      case "clientes": return { text: "Próximo passo: vincule propriedades aos seus clientes", route: "/clientes" };
      case "propriedades": return { text: "Próximo passo: crie projetos para suas propriedades", route: "/projetos" };
      case "servicos": return { text: "Próximo passo: registre despesas dos seus projetos", route: "/despesas" };
      case "despesas": return { text: "Próximo passo: confira o painel financeiro", route: "/financeiro" };
      case "orcamentos": return { text: "Próximo passo: converta orçamentos em projetos", route: "/orcamentos" };
      default: return null;
    }
  };

  // ─── Cell render helper ──────────────────────────────────────────

  const renderCell = (v: RowValidation, fieldKey: string) => {
    const error = v.errors[fieldKey];
    const warning = v.warnings[fieldKey];
    const issue = error || warning;
    const value = v.row[fieldKey];

    const cellClass = error
      ? "text-destructive font-medium bg-destructive/5"
      : warning
      ? "text-amber-700 dark:text-amber-400 bg-amber-500/5"
      : "";

    const content = value ? (
      <span>
        {value}
        {issue && (
          <span className={`block text-xs font-normal ${error ? "text-destructive/80" : "text-amber-600 dark:text-amber-400"}`}>
            {issue.message}
          </span>
        )}
      </span>
    ) : <span className="text-muted-foreground/50">—</span>;

    if (!issue) {
      return <TableCell key={fieldKey} className="max-w-[200px] truncate">{content}</TableCell>;
    }

    return (
      <TableCell key={fieldKey} className={`max-w-[200px] truncate ${cellClass}`}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">{content}</div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-medium text-sm">
                  {error ? "❌" : "⚠️"} {issue.message}
                </p>
                {issue.suggestion && (
                  <p className="text-xs text-muted-foreground">💡 {issue.suggestion}</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importação Inteligente de {entityLabel.titlePlural}
          </DialogTitle>
          <div className="flex items-center gap-2 pt-2">
            {(["upload", "mapping", "preview", "result"] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <Badge
                  variant={
                    step === s || (step === "importing" && s === "preview") ? "default"
                    : ["upload", "mapping", "preview", "result"].indexOf(step === "importing" ? "preview" : step) > i ? "secondary" : "outline"
                  }
                  className="text-xs"
                >
                  {i + 1}. {STEP_LABELS[s]}
                </Badge>
                {i < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-4">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById("smart-import-file")?.click()}
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Arraste seu arquivo aqui ou clique para selecionar</p>
                <p className="text-sm text-muted-foreground mt-2">Aceita CSV, XLS e XLSX — não precisa seguir um modelo específico</p>
                <input id="smart-import-file" type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
              </div>
              <Button variant="outline" className="w-full" onClick={() => downloadEntityTemplate(initialEntityType)}>
                <Download className="h-4 w-4 mr-2" />
                Baixar Planilha Modelo ({ENTITY_LABELS[initialEntityType].titlePlural})
              </Button>
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === "mapping" && (
            <div className="space-y-4">
              {detectedEntity && detectedEntity.entity !== initialEntityType && detectedEntity.confidence > 40 && (
                <Alert className="border-primary/30 bg-primary/5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <AlertTitle>Detectamos que sua planilha contém {ENTITY_LABELS[detectedEntity.entity].titlePlural}</AlertTitle>
                  <AlertDescription className="flex items-center gap-3 mt-1">
                    <span className="text-sm">Confiança: {detectedEntity.confidence}%</span>
                    {entityType !== detectedEntity.entity && (
                      <Button size="sm" variant="outline" onClick={() => handleEntityChange(detectedEntity.entity)}>
                        Usar {ENTITY_LABELS[detectedEntity.entity].titlePlural}
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center gap-3">
                <Alert className="flex-1">
                  <FileSpreadsheet className="h-4 w-4" />
                  <AlertTitle>{fileName} — {rawData.length} linha(s) encontrada(s)</AlertTitle>
                  <AlertDescription>Associe as colunas do seu arquivo aos campos do sistema. Campos com * são obrigatórios.</AlertDescription>
                </Alert>
                <Select value={entityType} onValueChange={(v) => handleEntityChange(v as ImportEntityType)}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clientes">Clientes</SelectItem>
                    <SelectItem value="propriedades">Propriedades</SelectItem>
                    <SelectItem value="orcamentos">Orçamentos</SelectItem>
                    <SelectItem value="servicos">Serviços</SelectItem>
                    <SelectItem value="despesas">Despesas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="h-[350px]">
                <div className="grid gap-3">
                  {SYSTEM_FIELDS.map((field) => (
                    <div key={field.key} className="flex items-center gap-4 px-2">
                      <Label className="w-36 shrink-0 text-sm">
                        {field.label}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      <Select value={mappings[field.key] || ""} onValueChange={(v) => setMappings((prev) => ({ ...prev, [field.key]: v === "__none__" ? "" : v }))}>
                        <SelectTrigger className="w-52"><SelectValue placeholder="Ignorar esta coluna" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Ignorar esta coluna</SelectItem>
                          {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Preencher automaticamente"
                        className="w-40"
                        value={defaultValues[field.key] || ""}
                        onChange={(e) => setDefaultValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      />
                      {mappings[field.key] && (
                        <Badge variant="secondary" className={`text-xs shrink-0 ${
                          matchConfidences[field.key] === "exact" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : matchConfidences[field.key] === "synonym" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          : "bg-muted text-muted-foreground"
                        }`}>
                          {matchConfidences[field.key] === "exact" ? "✓ Exato" : matchConfidences[field.key] === "synonym" ? "≈ Sinônimo" : "~ Parcial"}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              {duplicateCount > 0 && (
                <Alert className="border-amber-500/50 bg-amber-500/10">
                  <Copy className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-700 dark:text-amber-300">{duplicateCount} possível(is) duplicata(s) detectada(s)</AlertTitle>
                  <AlertDescription className="text-amber-600 dark:text-amber-400">
                    Registros com nomes iguais já existem no sistema. Eles serão importados mesmo assim.
                  </AlertDescription>
                </Alert>
              )}
              {/* Financial preview card */}
              {financialPreview && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Impacto Financeiro Estimado</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    {financialPreview.receita > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground">Receita</p>
                        <p className="text-lg font-bold text-primary">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(financialPreview.receita)}
                        </p>
                        <p className="text-xs text-muted-foreground">{financialPreview.count} registro(s)</p>
                      </div>
                    )}
                    {financialPreview.despesas > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground">Despesas</p>
                        <p className="text-lg font-bold text-destructive">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(financialPreview.despesas)}
                        </p>
                        <p className="text-xs text-muted-foreground">{financialPreview.count} registro(s)</p>
                      </div>
                    )}
                    {financialPreview.receita > 0 && financialPreview.despesas > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground">Lucro</p>
                        <p className={`text-lg font-bold ${financialPreview.lucro >= 0 ? "text-primary" : "text-destructive"}`}>
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(financialPreview.lucro)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}


              {errorCount > 0 ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{errorCount} linha(s) com erro — {validCount} importáveis</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p className="text-sm">Linhas com erro (vermelho) serão ignoradas. Linhas com aviso (amarelo) serão importadas normalmente.</p>
                    <div className="flex items-center gap-2">
                      <Checkbox id="skip-errors" checked={skipErrors} onCheckedChange={(v) => setSkipErrors(!!v)} />
                      <Label htmlFor="skip-errors" className="text-sm font-medium cursor-pointer">Importar apenas as corretas (pular erros)</Label>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : warningCount > 0 ? (
                <Alert className="border-amber-500/30 bg-amber-500/5">
                  <Info className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-700 dark:text-amber-300">
                    Todas as {rawData.length} linhas serão importadas — {warningCount} com avisos
                  </AlertTitle>
                  <AlertDescription className="text-amber-600 dark:text-amber-400">
                    Os avisos indicam formatação atípica. Os dados serão importados mesmo assim.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-primary/30 bg-primary/5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertTitle>Todas as {rawData.length} linhas estão perfeitas!</AlertTitle>
                  <AlertDescription>Confira os dados abaixo e clique em Importar.</AlertDescription>
                </Alert>
              )}

              {/* Error summary badges */}
              {errorSummary.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {errorSummary.slice(0, 8).map(([msg, data]) => (
                    <TooltipProvider key={msg}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className={`text-xs cursor-help ${
                              data.severity === "error"
                                ? "border-destructive/40 text-destructive"
                                : "border-amber-500/40 text-amber-700 dark:text-amber-400"
                            }`}
                          >
                            {data.count}x {msg}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p className="text-xs">💡 {data.suggestion || "Verifique o dado na planilha original"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                  {errorSummary.length > 8 && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      +{errorSummary.length - 8} tipos
                    </Badge>
                  )}
                </div>
              )}

              {/* Filter + count bar */}
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Button
                  size="sm" variant={previewFilter === "all" ? "default" : "outline"}
                  className="h-7 text-xs" onClick={() => { setPreviewFilter("all"); setPreviewPage(0); }}
                >
                  Todas ({rawData.length})
                </Button>
                <Button
                  size="sm" variant={previewFilter === "valid" ? "default" : "outline"}
                  className="h-7 text-xs" onClick={() => { setPreviewFilter("valid"); setPreviewPage(0); }}
                >
                  ✓ Válidas ({validCount - warningCount})
                </Button>
                {warningCount > 0 && (
                  <Button
                    size="sm" variant={previewFilter === "warnings" ? "default" : "outline"}
                    className="h-7 text-xs" onClick={() => { setPreviewFilter("warnings"); setPreviewPage(0); }}
                  >
                    ⚠ Avisos ({warningCount})
                  </Button>
                )}
                {errorCount > 0 && (
                  <Button
                    size="sm" variant={previewFilter === "errors" ? "default" : "outline"}
                    className="h-7 text-xs" onClick={() => { setPreviewFilter("errors"); setPreviewPage(0); }}
                  >
                    ✗ Erros ({errorCount})
                  </Button>
                )}
                <span className="ml-auto text-muted-foreground text-xs">
                  Pág {previewPage + 1} de {totalPreviewPages || 1} ({filteredRows.length} linhas)
                </span>
              </div>

              <ScrollArea className="h-[280px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead className="w-10">Status</TableHead>
                      {mappedFields.map((f) => <TableHead key={f.key} className="whitespace-nowrap">{f.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.map((v) => (
                      <TableRow
                        key={v.originalIndex}
                        className={
                          v.hasErrors ? "bg-destructive/5 hover:bg-destructive/10"
                          : v.hasWarnings ? "bg-amber-500/5 hover:bg-amber-500/10"
                          : ""
                        }
                      >
                        <TableCell className="text-muted-foreground text-xs">{v.originalIndex + 2}</TableCell>
                        <TableCell>
                          {v.hasErrors ? (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          ) : v.hasWarnings ? (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </TableCell>
                        {mappedFields.map((f) => renderCell(v, f.key))}
                      </TableRow>
                    ))}
                    {paginatedRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={mappedFields.length + 2} className="text-center text-muted-foreground py-8">
                          Nenhuma linha nesta categoria
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination controls */}
              {totalPreviewPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    size="sm" variant="outline" className="h-7"
                    disabled={previewPage === 0}
                    onClick={() => setPreviewPage(p => p - 1)}
                  >
                    <ArrowLeft className="h-3 w-3" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {previewPage + 1} / {totalPreviewPages}
                  </span>
                  <Button
                    size="sm" variant="outline" className="h-7"
                    disabled={previewPage >= totalPreviewPages - 1}
                    onClick={() => setPreviewPage(p => p + 1)}
                  >
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium">Importando {entityLabel.plural}...</p>
              <p className="text-sm text-muted-foreground">Processando {skipErrors ? validCount : rawData.length} registros</p>
              <div className="w-full max-w-xs">
                <Progress value={importProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center mt-1">{importProgress}%</p>
              </div>
            </div>
          )}

          {/* Step 4: Result */}
          {step === "result" && importResult && (
            <div className="space-y-4">
              {importResult.success > 0 && (
                <Alert className="border-emerald-500/50 bg-emerald-500/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <AlertTitle className="text-emerald-600 dark:text-emerald-400">Importação Concluída!</AlertTitle>
                  <AlertDescription className="text-emerald-700 dark:text-emerald-300">
                    {importResult.success} {entityLabel.singular}(s) importado(s) com sucesso.
                  </AlertDescription>
                </Alert>
              )}

              {importResult.success > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => { onOpenChange(false); navigate(entityLabel.route); }}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver {entityLabel.titlePlural} importados
                  </Button>
                </div>
              )}

              {importResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{importResult.errors.length} linha(s) com erro — não importadas</AlertTitle>
                  <AlertDescription>
                    {/* Grouped error summary table */}
                    {errorSummary.filter(([_, d]) => d.severity === "error").length > 0 && (
                      <div className="mt-2 mb-3">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs h-8">Tipo de Erro</TableHead>
                              <TableHead className="text-xs h-8 w-16">Qtd</TableHead>
                              <TableHead className="text-xs h-8">Sugestão</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {errorSummary.filter(([_, d]) => d.severity === "error").slice(0, 10).map(([msg, data]) => (
                              <TableRow key={msg}>
                                <TableCell className="text-xs py-1.5">{msg}</TableCell>
                                <TableCell className="text-xs py-1.5 font-medium">{data.count}</TableCell>
                                <TableCell className="text-xs py-1.5 text-muted-foreground">{data.suggestion || "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    <ScrollArea className="h-[100px] mt-2">
                      <ul className="list-disc list-inside space-y-1">
                        {importResult.errors.slice(0, 50).map((e, i) => <li key={i} className="text-sm">{e}</li>)}
                        {importResult.errors.length > 50 && (
                          <li className="text-sm text-muted-foreground">... e mais {importResult.errors.length - 50} erro(s)</li>
                        )}
                      </ul>
                    </ScrollArea>
                    {importResult.failedRows.length > 0 && (
                      <Button variant="outline" size="sm" className="mt-3" onClick={downloadFailedRows}>
                        <Download className="h-4 w-4 mr-2" />
                        Baixar linhas com erro (.csv)
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {importResult.success > 0 && (() => {
                const tip = getNextStepTip();
                if (!tip) return null;
                return (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-sm text-muted-foreground">{tip.text}</p>
                    <Button variant="ghost" size="sm" className="ml-auto shrink-0" onClick={() => { onOpenChange(false); navigate(tip.route); }}>
                      Ir agora <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === "upload" && <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={reset}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
              <Button onClick={() => {
                const missing = SYSTEM_FIELDS.filter((f) => f.required && !mappings[f.key] && !defaultValues[f.key]?.trim());
                if (missing.length) { toast.error(`Associe ou preencha: ${missing.map((f) => f.label).join(", ")}`); return; }
                checkDuplicates();
                setPreviewFilter("all");
                setPreviewPage(0);
                setStep("preview");
                toast.success(`${validCount} de ${rawData.length} linhas importáveis${warningCount > 0 ? ` (${warningCount} com avisos)` : ""}`);
              }}>
                <Eye className="h-4 w-4 mr-2" />
                Conferir Dados
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("mapping")}><ArrowLeft className="h-4 w-4 mr-2" />Ajustar Colunas</Button>
              <Button onClick={handleImport} disabled={!canImport}>
                <Upload className="h-4 w-4 mr-2" />
                Importar {skipErrors ? validCount : rawData.length} {entityLabel.singular}(s)
              </Button>
            </>
          )}
          {step === "result" && (
            <>
              <Button variant="outline" onClick={reset}>Importar Outro Arquivo</Button>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
