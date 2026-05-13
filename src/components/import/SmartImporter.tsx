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
import { createTipoDespesa } from "@/modules/operations/services/tipodespesa.service";
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
import { parseFinancialNumber } from "@/lib/financialNumberParser";
import { classifyHeaders, classifyExpenseCategory, type SemanticRole } from "@/lib/financialColumnClassifier";
import { inferColumnTypes, isMonetaryCompatible, type InferredColumn } from "@/lib/etl/columnTypeInference";
import { normalizeStatusPagamento, normalizeStatusServico } from "@/lib/etl/statusNormalizer";
import { clientNaturalKey, buildClientIndex, lookupClient } from "@/lib/etl/clientDedup";
import { FinancialPreviewCard } from "@/components/import/FinancialPreviewCard";
import { ImportValidationCard } from "@/components/import/ImportValidationCard";
import { MappingValidationPanel } from "@/components/import/MappingValidationPanel";
import {
  findMappingProfile, saveMappingProfile, deleteMappingProfile, applyProfileToMappings,
} from "@/lib/etl/mappingProfiles";
import { useTenant } from "@/contexts/TenantContext";

// ─── Types ──────────────────────────────────────────────────────────────

export type ImportEntityType = "clientes" | "propriedades" | "orcamentos" | "servicos" | "despesas" | "completo";

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

function sanitizeCurrency(value: unknown): string {
  const n = parseFinancialNumber(value);
  return n === null ? "" : String(n);
}

function parseNullableNumber(value: unknown): number | null {
  return parseFinancialNumber(value);
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

// ─── Completo fields (composite import) ────────────────────────────────

const COMPLETO_FIELDS: SystemField[] = [
  // Cliente
  { key: "nome", label: "👤 Cliente - Nome", required: true, validate: validateNome },
  { key: "cpf", label: "👤 Cliente - CPF", required: false, format: formatCPF, validate: validateCPF },
  { key: "telefone", label: "👤 Cliente - Telefone", required: false, format: sanitizePhone, validate: validatePhone },
  { key: "email", label: "👤 Cliente - Email", required: false, validate: validateEmail },
  { key: "endereco", label: "👤 Cliente - Endereço", required: false },
  // Propriedade
  { key: "nome_da_propriedade", label: "🏡 Propriedade - Nome", required: false, validate: (v) => v ? validateNome(v) : null },
  { key: "municipio", label: "🏡 Propriedade - Município", required: false },
  { key: "area_ha", label: "🏡 Propriedade - Área (ha)", required: false, validate: validatePositiveNumber, type: "number" },
  // Projeto
  { key: "nome_do_servico", label: "📋 Projeto - Nome", required: false, validate: (v) => v ? validateNome(v) : null },
  { key: "categoria", label: "📋 Projeto - Categoria", required: false },
  { key: "situacao_do_servico", label: "📋 Projeto - Situação", required: false },
  { key: "data_do_servico_inicio", label: "📋 Projeto - Data Início", required: false, format: formatDate, validate: validateDate, type: "date" },
  // Financeiro
  { key: "valor_unitario", label: "💰 Financeiro - Valor", required: false, validate: validatePositiveNumber, type: "number" },
  { key: "receita_esperada", label: "💰 Financeiro - Receita", required: false, validate: validatePositiveNumber, type: "number" },
  { key: "custo_servico", label: "💰 Financeiro - Custo de Obra", required: false, validate: validatePositiveNumber, type: "number" },
  { key: "valor_despesa", label: "💰 Financeiro - Despesa Operacional", required: false, validate: validatePositiveNumber, type: "number" },
  { key: "valor_imposto", label: "💰 Financeiro - Imposto", required: false, validate: validatePositiveNumber, type: "number" },
  { key: "receita_realizada", label: "💰 Financeiro - Receita Realizada", required: false, validate: validatePositiveNumber, type: "number" },
  { key: "lucro_informado", label: "💰 Financeiro - Lucro (informado)", required: false, validate: validateNumber, type: "number" },
  { key: "categoria_despesa", label: "💰 Financeiro - Categoria da Despesa", required: false },
  { key: "subcategoria_despesa", label: "💰 Financeiro - Subcategoria da Despesa", required: false },
  { key: "data_orcamento", label: "💰 Financeiro - Data", required: false, format: formatDate, validate: validateDate, type: "date" },
  { key: "data_despesa", label: "💰 Financeiro - Data da Despesa", required: false, format: formatDate, validate: validateDate, type: "date" },
  { key: "situacao_do_pagamento", label: "💰 Financeiro - Status do Pagamento", required: false },
  { key: "data_do_faturamento", label: "💰 Financeiro - Data do Faturamento", required: false, format: formatDate, validate: validateDate, type: "date" },
];




function getFieldsForEntity(entity: ImportEntityType): SystemField[] {
  switch (entity) {
    case "propriedades": return PROPRIEDADE_FIELDS;
    case "orcamentos": return ORCAMENTO_FIELDS;
    case "servicos": return SERVICO_FIELDS;
    case "despesas": return DESPESA_FIELDS;
    case "completo": return COMPLETO_FIELDS;
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

// COMPLETO_SYNONYMS: manually written to avoid spread conflicts.
// Each key has UNIQUE synonyms that don't overlap across entities.
const COMPLETO_SYNONYMS: Record<string, string[]> = {
  // ── Cliente ──
  nome: ["cliente", "razaosocial", "nomecompleto", "nomerazao", "contato", "nomefantasia", "razao", "nomecontato", "nomecliente", "clientenome", "nomedocliente", "proprietario", "dono", "contratante", "nomeproprietario", "responsavel"],
  cpf: ["documento", "cpfcnpj", "doc", "documentocliente", "cpfcliente"],
  telefone: ["fone", "tel", "fixo", "telefonecontato", "telefonefixo", "fonecontato", "telefone1", "tel1", "fone1"],
  celular: ["whatsapp", "zap", "mobile", "cel", "telefonemovil", "celularcontato", "wpp", "telefonemovel", "telefone2", "tel2"],
  email: ["correio", "mail", "emailcontato", "emailcliente", "correioeletronico"],
  endereco: ["local", "localizacao", "rua", "logradouro", "end", "enderecocompleto", "morada"],
  // ── Propriedade (sinônimos SEM conflito com cliente) ──
  nome_da_propriedade: ["propriedade", "fazenda", "sitio", "chacara", "lote", "imovel", "nomepropriedade", "nomeimovel", "nomefazenda", "prop", "gleba", "terreno", "nomefazenda", "nomedoimovel"],
  municipio: ["cidade", "mun", "localidade", "municipiopropriedade"],
  area_ha: ["area", "areaha", "hectares", "tamanho", "areahectare", "ha"],
  // ── Projeto / Serviço ──
  nome_do_servico: ["servico", "projeto", "titulo", "nomeservico", "nomeprojeto", "atividade", "trabalho", "tiposervico"],
  categoria: ["tipo", "segmento", "classificacao", "tipoatividade", "areaservico"],
  situacao_do_servico: ["status", "situacao", "estado", "andamento", "statusservico", "statusdoservico"],
  data_do_servico_inicio: ["datainicio", "inicio", "dtinicio", "datacomecar"],
  // ── Financeiro (prioridade alta — sinônimos únicos) ──
  valor_unitario: ["valorunit", "preco", "precounitario", "vlrunit", "valorha", "valorhectare", "precoha", "valorservico"],
  receita_esperada: ["receita", "valortotal", "total", "receitaesperada", "faturamento", "amount", "revenue", "valorcontrato", "valorglobal", "valor", "vlr"],
  custo_servico: ["custo", "custoservico", "custototal", "custooperacional", "custoobra", "custodoservico", "custodaobra", "custodireto"],
  valor_despesa: ["despesa", "despesas", "gasto", "gastos", "valorpago", "saida", "pagamento", "valordespesa", "despesaoperacional", "despesafixa"],
  valor_imposto: ["imposto", "impostos", "iss", "tributo", "taxaimposto", "valorimposto"],
  receita_realizada: ["receitarealizada", "valorrecebido", "valorpago", "recebido", "valorfaturado", "faturado"],
  lucro_informado: ["lucro", "lucroliquido", "lucrobruto", "resultado", "lucratividade"],
  categoria_despesa: ["categoriadespesa", "tipodespesa", "naturezadespesa", "grupodespesa", "categoria"],
  subcategoria_despesa: ["subcategoria", "subcategoriadespesa", "subgrupo", "subgrupodespesa"],
  data_orcamento: ["dataorcamento", "dtorcamento", "dataemissao", "dataproposta"],
  data_despesa: ["datadespesa", "datadogasto", "datapagamento", "dtdespesa"],
  situacao_do_pagamento: ["statuspagamento", "situacaopagamento", "statuspag", "statusdopagamento", "situacaodopagamento"],
  data_do_faturamento: ["datafaturamento", "dtfaturamento", "vencimento", "datavencimento"],
};

function getSynonymsForEntity(entity: ImportEntityType): Record<string, string[]> {
  switch (entity) {
    case "propriedades": return PROPRIEDADE_SYNONYMS;
    case "orcamentos": return ORCAMENTO_SYNONYMS;
    case "servicos": return SERVICO_SYNONYMS;
    case "despesas": return DESPESA_SYNONYMS;
    case "completo": return COMPLETO_SYNONYMS;
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
  completo: { singular: "registro", plural: "registros", titlePlural: "Importação Completa", route: "/financeiro", queryKey: "completo" },
};

// ─── Auto-detection ────────────────────────────────────────────────────

function detectEntityType(fileHeaders: string[]): { entity: ImportEntityType; confidence: number } {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s\-.*]/g, "");
  const normalized = fileHeaders.map(norm);

  // PRIORITY CHECK: If financial + client/property headers exist → force "completo"
  const financialKeywords = ["valor", "preco", "custo", "total", "receita", "faturamento", "amount", "vlr", "price", "revenue", "despesa", "gasto", "lucro"];
  const clientKeywords = ["cliente", "nome", "proprietario", "contratante", "razaosocial", "dono", "responsavel"];
  const propertyKeywords = ["propriedade", "fazenda", "imovel", "sitio", "chacara", "gleba", "terreno"];

  const hasFinancial = normalized.some(h => financialKeywords.some(k => h.includes(k)));
  const hasClient = normalized.some(h => clientKeywords.some(k => h.includes(k)));
  const hasProperty = normalized.some(h => propertyKeywords.some(k => h.includes(k)));

  // Force completo when we have financial data + at least client or property
  if (hasFinancial && (hasClient || hasProperty)) {
    const matchCount = [hasFinancial, hasClient, hasProperty].filter(Boolean).length;
    return { entity: "completo" as ImportEntityType, confidence: Math.min(95, 60 + matchCount * 10) };
  }

  const scores: Record<ImportEntityType, number> = { clientes: 0, propriedades: 0, orcamentos: 0, servicos: 0, despesas: 0, completo: 0 };
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
  const confidence = totalPossible > 0 ? Math.round((maxScore / totalPossible) * 100) : 0;

  // Detect "completo" when 2+ entity types score ≥3
  const highScoring = entities.filter(e => scores[e] >= 3);
  if (highScoring.length >= 2) {
    return { entity: "completo" as ImportEntityType, confidence: Math.min(90, confidence + 20) };
  }

  return { entity: best, confidence };
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
    completo: ["João da Silva", "123.456.789-00", "(62) 99999-8888", "joao@email.com", "Rua das Flores", "Fazenda Boa Vista", "Goiânia", "150.5", "Levantamento Topográfico", "Topografia", "Em Andamento", "2024-01-15", "5000.00", "5000.00", "2000.00", "2024-01-15"],
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
  const { tenant } = useTenant();
  const [step, setStep] = useState<Step>("upload");
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [appliedProfile, setAppliedProfile] = useState<{ count: number; updatedAt: string; version: number } | null>(null);
  const [staleProfile, setStaleProfile] = useState<{
    profile: import("@/lib/etl/mappingProfiles").MappingProfile;
  } | null>(null);
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
  const [kpiSnapshot, setKpiSnapshot] = useState<KPIData | null>(null);
  const [valueClassification, setValueClassification] = useState<"receita" | "despesa" | "ignorar" | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [compositeStatsResult, setCompositeStatsResult] = useState<{ clientes: number; propriedades: number; servicos: number; orcamentos: number; despesas: number } | null>(null);
  const [debugStats, setDebugStats] = useState<{
    totalRows: number;
    rowsWithValue: number;
    receitaCount: number;
    receitaSum: number;
    despesaCount: number;
    despesaSum: number;
    discarded: { reason: string; count: number }[];
  } | null>(null);
  const [validationReport, setValidationReport] = useState<{
    spreadsheet: {
      totalRows: number;
      financialRows: number;
      receitaSum: number;
      despesaSum: number;
      uniqueClientes: number;
      uniqueProps: number;
    };
    database: {
      clientes: number;
      propriedades: number;
      servicos: number;
      orcamentos: number;
      despesas: number;
      receitaSum: number;
      despesaSum: number;
    };
    duplicates: { clientes: { nome: string; count: number }[]; propriedades: { nome: string; count: number }[] };
    discardedRows: { line: number; reason: string }[];
  } | null>(null);

  // KPI hook for post-import verification
  const { data: currentKpis, refetch: refetchKpis } = useKPIs();

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
    setKpiSnapshot(null);
    setValueClassification(null);
    setImportWarnings([]);
    setDetectedFinancialInClientes(false);
    setCompositeStatsResult(null);
    setDebugStats(null);
    setValidationReport(null);
    setAppliedProfile(null);
  };

  // ─── File processing ───────────────────────────────────────────────

  const autoMap = useCallback((fileHeaders: string[], fields: SystemField[], synonyms: Record<string, string[]>, preMap?: Record<string, string>) => {
    const newMappings: Record<string, string> = {};
    const confidences: Record<string, MatchConfidence> = {};
    const usedHeaders = new Set<string>(); // Prevent double-mapping

    // STEP 0 — apply semantic classifier pre-map (highest priority, locks the column)
    if (preMap) {
      for (const [fieldKey, header] of Object.entries(preMap)) {
        if (!header || usedHeaders.has(header)) continue;
        if (!fileHeaders.includes(header)) continue;
        if (!fields.find(f => f.key === fieldKey)) continue;
        newMappings[fieldKey] = header;
        confidences[fieldKey] = "exact";
        usedHeaders.add(header);
      }
    }

    // Sort fields: required first, then financial fields (higher priority)
    const financialKeys = new Set(["receita_esperada", "valor_unitario", "custo_servico", "valor_despesa", "valor_imposto", "data_orcamento"]);
    const sortedFields = [...fields].sort((a, b) => {
      if (a.required !== b.required) return a.required ? -1 : 1;
      if (financialKeys.has(a.key) !== financialKeys.has(b.key)) return financialKeys.has(a.key) ? -1 : 1;
      return 0;
    });

    for (const field of sortedFields) {
      if (newMappings[field.key]) continue; // already locked by classifier
      const b = normalize(field.key);
      const c = normalize(field.label);

      let match = fileHeaders.find((h) => !usedHeaders.has(h) && (() => { const a = normalize(h); return a === b || a === c; })());
      if (match) { newMappings[field.key] = match; confidences[field.key] = "exact"; usedHeaders.add(match); continue; }

      const syns = synonyms[field.key] || [];
      match = fileHeaders.find((h) => !usedHeaders.has(h) && (() => { const a = normalize(h); return syns.some((syn) => a === syn || a.includes(syn) || syn.includes(a)); })());
      if (match) { newMappings[field.key] = match; confidences[field.key] = "synonym"; usedHeaders.add(match); continue; }

      match = fileHeaders.find((h) => !usedHeaders.has(h) && (() => { const a = normalize(h); return a.includes(b) || b.includes(a) || a.includes(c) || c.includes(a); })());
      if (match) { newMappings[field.key] = match; confidences[field.key] = "partial"; usedHeaders.add(match); }
    }
    setMappings(newMappings);
    setMatchConfidences(confidences);
  }, []);

  // Build classifier-driven pre-map (role → field) for completo mode.
  // Uses CONTENT-BASED type inference to BLOCK financial roles on text columns
  // (prevents bugs like "Situação do Pagamento" → despesa or "Pendente" → number).
  const buildSemanticPreMap = useCallback((fileHeaders: string[], dataRows: string[][]): Record<string, string> => {
    const roleToField: Record<string, string> = {
      receita_bruta: "receita_esperada",
      receita_liquida: "receita_esperada",
      valor_orcado: "valor_unitario",
      custo_obra: "custo_servico",
      despesa_operacional: "valor_despesa",
      imposto: "valor_imposto",
      lucro_informado: "lucro_informado",
      margem_informada: "lucro_informado",
      categoria_despesa: "categoria_despesa",
      data_orcamento: "data_orcamento",
      data_despesa: "data_despesa",
      cliente_nome: "nome",
      propriedade_nome: "nome_da_propriedade",
      municipio: "municipio",
      servico_nome: "nome_do_servico",
    };
    // Roles that MUST come from a monetary column. Otherwise we drop the suggestion.
    const financialRoles = new Set([
      "receita_bruta", "receita_liquida", "valor_orcado",
      "custo_obra", "despesa_operacional", "imposto", "lucro_informado", "margem_informada",
    ]);
    // Roles that MUST come from a date column.
    const dateRoles = new Set(["data_orcamento", "data_despesa"]);

    const inferred = inferColumnTypes(fileHeaders, dataRows);
    const inferredByHeader = new Map(inferred.map(i => [i.header, i]));

    const classified = classifyHeaders(fileHeaders);
    const preMap: Record<string, string> = {};
    const usedFields = new Set<string>();
    // Sort by confidence desc so higher-weight rules win the field
    const sorted = [...classified].sort((a, b) => b.confidence - a.confidence);

    // Inject content-driven roles BEFORE header roles
    // (status column found by content → maps to situacao_do_pagamento regardless of header)
    for (const inf of inferred) {
      if (inf.type === "status" && !preMap["situacao_do_pagamento"]) {
        preMap["situacao_do_pagamento"] = inf.header;
        usedFields.add("situacao_do_pagamento");
      }
    }

    for (const c of sorted) {
      if (c.confidence < 80) continue;
      const fieldKey = roleToField[c.role];
      if (!fieldKey) continue;
      if (usedFields.has(fieldKey)) continue;

      const inf = inferredByHeader.get(c.header);
      // BLOCK financial roles on non-monetary columns
      if (financialRoles.has(c.role) && inf && !isMonetaryCompatible(inf.type)) {
        // If the column is actually a status, route to situacao_do_pagamento
        if (inf.type === "status" && !preMap["situacao_do_pagamento"]) {
          preMap["situacao_do_pagamento"] = c.header;
          usedFields.add("situacao_do_pagamento");
        }
        continue;
      }
      // BLOCK date roles on non-date columns
      if (dateRoles.has(c.role) && inf && inf.type !== "data") continue;

      preMap[fieldKey] = c.header;
      usedFields.add(fieldKey);
    }
    return preMap;
  }, []);

  // Check if headers contain financial columns
  const hasFinancialColumns = useCallback((fileHeaders: string[]) => {
    const financialSynonyms = ["valor", "preco", "custo", "total", "receita", "faturamento", "amount", "vlr", "price", "revenue", "despesa", "gasto"];
    return fileHeaders.some(h => {
      const n = normalize(h);
      return financialSynonyms.some(s => n.includes(s));
    });
  }, []);

  const [detectedFinancialInClientes, setDetectedFinancialInClientes] = useState(false);

  const ensureFallbackClientId = useCallback(async () => {
    const { data: existingClient } = await supabase
      .from("dim_cliente")
      .select("id_cliente")
      .eq("nome", "Cliente Importação")
      .maybeSingle();

    if (existingClient?.id_cliente) return existingClient.id_cliente;

    const result = await createClientesBatch([
      { nome: "Cliente Importação", categoria: "Importação", situacao: "Ativo" },
    ]);

    if (result.success <= 0) return null;

    const { data: newClient } = await supabase
      .from("dim_cliente")
      .select("id_cliente")
      .eq("nome", "Cliente Importação")
      .maybeSingle();

    return newClient?.id_cliente || null;
  }, []);

  const ensureFallbackTipoDespesaId = useCallback(async () => {
    const { data: existingType } = await supabase
      .from("dim_tipodespesa")
      .select("id_tipodespesa")
      .eq("categoria", "Sem classificação")
      .maybeSingle();

    if (existingType?.id_tipodespesa) return existingType.id_tipodespesa;

    const { data: newType, error } = await createTipoDespesa({
      categoria: "Sem classificação",
      classificacao: "VARIAVEL",
      descricao: "Criado automaticamente pela importação",
    });

    if (error) throw error;
    return newType?.id_tipodespesa || null;
  }, []);

  const processHeaders = useCallback((h: string[], data: string[][]) => {
    setHeaders(h);
    setRawData(data);

    const detection = detectEntityType(h);
    setDetectedEntity(detection);

    const effectiveEntity = detection.confidence > 40 ? detection.entity : initialEntityType;
    setEntityType(effectiveEntity);

    // If detected as "clientes" but has financial columns, flag it
    if (effectiveEntity === "clientes" && hasFinancialColumns(h)) {
      setDetectedFinancialInClientes(true);
    } else {
      setDetectedFinancialInClientes(false);
    }

    const fields = getFieldsForEntity(effectiveEntity);
    const synonyms = getSynonymsForEntity(effectiveEntity);
    const preMap = effectiveEntity === "completo" ? buildSemanticPreMap(h, data) : undefined;
    autoMap(h, fields, synonyms, preMap);

    // Apply previously-saved manual mapping profile (if any) for this header signature
    const found = findMappingProfile(tenant?.id ?? null, effectiveEntity, h);
    if (found) {
      if (found.layoutChanged) {
        // Same column SET, but order/count drifted → don't auto-apply, ask user
        setStaleProfile({ profile: found.profile });
        setAppliedProfile(null);
      } else {
        setMappings(prev => {
          const { merged, appliedCount } = applyProfileToMappings(prev, found.profile, h);
          if (appliedCount > 0) {
            setAppliedProfile({
              count: appliedCount,
              updatedAt: found.profile.updatedAt,
              version: found.profile.version,
            });
          } else {
            setAppliedProfile(null);
          }
          return merged;
        });
        setStaleProfile(null);
      }
    } else {
      setAppliedProfile(null);
      setStaleProfile(null);
    }

    setStep("mapping");
  }, [initialEntityType, autoMap, hasFinancialColumns, buildSemanticPreMap, tenant?.id]);

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
    const preMap = newEntity === "completo" ? buildSemanticPreMap(headers, rawData) : undefined;
    autoMap(headers, fields, synonyms, preMap);
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

    // Check required fields — with fallback for "nome" in completo mode
    for (const field of SYSTEM_FIELDS) {
      if (field.required && mappings[field.key] && !mapped[field.key]?.trim() && !defaultValues[field.key]?.trim()) {
        // In "completo" mode, if "nome" (client name) is missing, use property name as fallback
        if (entityType === "completo" && field.key === "nome") {
          const propName = mapped["nome_da_propriedade"]?.trim();
          if (propName) {
            mapped["nome"] = `Cliente - ${propName}`;
            continue; // Don't mark as error
          }
        }
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
    if (entityType !== "orcamentos" && entityType !== "despesas" && entityType !== "servicos" && entityType !== "completo") return null;
    const validRows = allValidatedRows.filter(v => !v.hasErrors);
    let receita = 0;
    let custo = 0;
    let despesa = 0;
    let rowsWithFinancial = 0;
    const clientesSet = new Set<string>();
    const propriedadesSet = new Set<string>();

    for (const v of validRows) {
      let touched = false;
      if (entityType === "orcamentos") {
        const re = parseNullableNumber(v.row.receita_esperada) || 0;
        const vu = parseNullableNumber(v.row.valor_unitario) || 0;
        const qty = parseInt(v.row.quantidade || "1") || 1;
        const desc = parseNullableNumber(v.row.desconto) || 0;
        const val = re > 0 ? re : (vu * qty) - desc;
        if (val > 0) { receita += val; touched = true; }
      } else if (entityType === "despesas") {
        const val = parseNullableNumber(v.row.valor_da_despesa) || 0;
        if (val > 0) { despesa += val; touched = true; }
      } else if (entityType === "servicos") {
        const val = parseNullableNumber(v.row.receita_servico) || 0;
        const cs = parseNullableNumber(v.row.custo_servico) || 0;
        if (val > 0) { receita += val; touched = true; }
        if (cs > 0) { custo += cs; touched = true; }
      } else if (entityType === "completo") {
        const re = parseNullableNumber(v.row.receita_esperada) || 0;
        const vu = parseNullableNumber(v.row.valor_unitario) || 0;
        const cs = parseNullableNumber(v.row.custo_servico) || 0;
        const dop = parseNullableNumber(v.row.valor_despesa) || 0;
        const val = re > 0 ? re : vu;
        if (val > 0) { receita += val; touched = true; }
        if (cs > 0) { custo += cs; touched = true; }
        if (dop > 0) { despesa += dop; touched = true; }
      }
      if (touched) rowsWithFinancial++;
      const nome = (v.row.nome || v.row.nome_cliente || "").toString().trim();
      if (nome) clientesSet.add(nome.toLowerCase());
      const prop = (v.row.nome_propriedade || v.row.propriedade || "").toString().trim();
      if (prop) propriedadesSet.add(prop.toLowerCase());
    }

    if (receita === 0 && custo === 0 && despesa === 0) return null;
    return {
      receita, custo, despesa,
      rowsWithFinancial,
      totalRows: allValidatedRows.length,
      uniqueClientes: clientesSet.size,
      uniquePropriedades: propriedadesSet.size,
    };
  }, [allValidatedRows, entityType]);

  const classifiedHeaders = useMemo(() => classifyHeaders(headers), [headers]);


  const checkDuplicates = useCallback(async () => {
    if (entityType !== "clientes" && entityType !== "servicos" && entityType !== "completo") return;

    const nameField = (entityType === "clientes" || entityType === "completo") ? "nome" : "nome_do_servico";
    const table = (entityType === "clientes" || entityType === "completo") ? "dim_cliente" : "fato_servico";
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
    if (entityType !== "propriedades" && entityType !== "servicos" && entityType !== "orcamentos" && entityType !== "completo") return records;

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
    setImportWarnings([]);
    setValidationReport(null);

    // Persist the (possibly manually corrected) mapping for next imports with the same shape
    try {
      saveMappingProfile({
        tenantId: tenant?.id ?? null,
        entity: entityType,
        headers,
        mappings,
        fileName,
      });
    } catch (e) {
      console.warn("Could not persist mapping profile:", e);
    }

    // Capture timestamp BEFORE any insert — used to filter what THIS batch created
    const batchStartTime = new Date().toISOString();
    // Track discarded rows with explanations for the validation report
    const discardedRowsLog: { line: number; reason: string }[] = [];

    try {
      // Snapshot KPIs before import
      try {
        const { data: snapData } = await supabase.rpc('calcular_kpis_v2');
        if (snapData && snapData.length > 0) setKpiSnapshot(snapData[0]);
      } catch (e) {
        console.warn("Could not snapshot KPIs:", e);
      }

      const skippedErrors: string[] = [];
      let recordsToInsert: Record<string, any>[] = [];
      const failedRows: Record<string, string>[] = [];
      const warnings: string[] = [];

      for (let i = 0; i < allValidatedRows.length; i++) {
        const validation = allValidatedRows[i];
        if (validation.hasErrors) {
          if (skipErrors) {
            const errorMessages = Object.entries(validation.errors)
              .map(([key, fv]) => {
                const field = SYSTEM_FIELDS.find(f => f.key === key);
                return `${field?.label || key}: ${fv.message}`;
              });
            skippedErrors.push(`Linha ${i + 2}: ${errorMessages.join(", ")}`);
            discardedRowsLog.push({ line: i + 2, reason: errorMessages.join("; ") });
            failedRows.push({ ...validation.row, _erro: errorMessages.join("; ") });
            continue;
          }
        }

        const record: Record<string, any> = {};
        for (const field of SYSTEM_FIELDS) {
          if (!mappings[field.key]) continue;
          if (field.key === "_categoria_lookup") continue;
          let val: any = validation.row[field.key];
          if (!val) { record[field.key] = null; continue; }
          if (field.type === "number") val = parseNullableNumber(val);
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

      // === FALLBACK: id_cliente for orcamentos ===
      if (entityType === "orcamentos") {
        const orphanCount = recordsToInsert.filter(r => !r.id_cliente).length;
        if (orphanCount > 0) {
          try {
            const fallbackClientId = await ensureFallbackClientId();

            if (fallbackClientId) {
              for (const rec of recordsToInsert) {
                if (!rec.id_cliente) rec.id_cliente = fallbackClientId;
              }
              warnings.push(`${orphanCount} orçamento(s) vinculado(s) ao cliente "Cliente Importação". Edite-os para associar ao cliente correto.`);
            }
          } catch (e) {
            console.warn("Erro ao criar cliente fallback:", e);
          }
        }
      }

      // === FALLBACK: id_tipodespesa for despesas ===
      if (entityType === "despesas") {
        // Auto-link by category name first
        if (mappings["_categoria_lookup"]) {
          try {
            const { data: tiposDespesa } = await supabase.from("dim_tipodespesa").select("id_tipodespesa, categoria, subcategoria");
            if (tiposDespesa && tiposDespesa.length > 0) {
              const tipoMap = new Map<string, string>();
              for (const t of tiposDespesa) {
                tipoMap.set(normalize(t.categoria), t.id_tipodespesa);
                if (t.subcategoria) tipoMap.set(normalize(t.subcategoria), t.id_tipodespesa);
              }
              let linked = 0;
              for (let i = 0; i < recordsToInsert.length; i++) {
                const rec = recordsToInsert[i];
                if (rec.id_tipodespesa) continue;
                const catIdx = headers.indexOf(mappings["_categoria_lookup"]);
                const validIdx = allValidatedRows.findIndex((v, vi) => !v.hasErrors && i < recordsToInsert.length);
                const rawRow = rawData[validIdx >= 0 ? validIdx : i];
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

        // Now handle orphan despesas without id_tipodespesa
        const orphanDespesas = recordsToInsert.filter(r => !r.id_tipodespesa).length;
        if (orphanDespesas > 0) {
          try {
            const fallbackTypeId = await ensureFallbackTipoDespesaId();

            if (fallbackTypeId) {
              for (const rec of recordsToInsert) {
                if (!rec.id_tipodespesa) rec.id_tipodespesa = fallbackTypeId;
              }
              warnings.push(`${orphanDespesas} despesa(s) classificada(s) como "Sem classificação". Edite em Cadastros > Tipos de Despesa.`);
            }
          } catch (e) {
            console.warn("Erro ao criar tipo de despesa fallback:", e);
          }
        }
      }

      setImportProgress(40);

      let result: { success: number; errors: string[] };

      if (entityType === "completo") {
        // ─── COMPOSITE IMPORT PIPELINE ────────────────────────────
        console.log("[SmartImporter] Pipeline completo iniciado. Registros a processar:", recordsToInsert.length);
        result = { success: 0, errors: [] };
        const clienteMap = new Map<string, string>(); // normalized name → id
        const propMap = new Map<string, string>(); // "clienteId|propName" → id
        let totalCreated = 0;
        const compositeStats = { clientes: 0, propriedades: 0, servicos: 0, orcamentos: 0, despesas: 0 };

        // Step 1: Deduplicate and create clients (natural key: CPF/CNPJ/email > name+phone > name)
        setImportProgress(45);
        const uniqueClientes = new Map<string, Record<string, any>>();
        for (const rec of recordsToInsert) {
          const nome = rec.nome?.trim();
          if (!nome) continue;
          const natKey = clientNaturalKey({
            nome, cpf: rec.cpf, cnpj: rec.cnpj, telefone: rec.telefone, celular: rec.celular, email: rec.email,
          }) || `n:${nome.toLowerCase()}`;
          if (!uniqueClientes.has(natKey)) {
            uniqueClientes.set(natKey, {
              nome,
              cpf: rec.cpf || null,
              cnpj: rec.cnpj || null,
              telefone: rec.telefone || null,
              email: rec.email || null,
              endereco: rec.endereco || null,
            });
          }
        }

        // Check existing clients first (build natural-key index from DB)
        const { data: existingClients } = await supabase
          .from("dim_cliente")
          .select("id_cliente, nome, cpf, cnpj, telefone, email");
        const clientIndex = buildClientIndex((existingClients || []) as any);
        for (const c of (existingClients || [])) {
          if (c.nome) clienteMap.set(c.nome.toLowerCase(), c.id_cliente);
        }

        // Create only new clients (those whose natural key is NOT already in the DB index)
        const newClients = Array.from(uniqueClientes.entries())
          .filter(([, data]) => !lookupClient(clientIndex, data as any))
          .map(([, data]) => data);

        if (newClients.length > 0) {
          const cRes = await createClientesBatch(newClients as any);
          compositeStats.clientes = cRes.success;
          result.errors.push(...cRes.errors);
          // Refresh nome→id map
          const { data: updatedClients } = await supabase.from("dim_cliente").select("id_cliente, nome");
          for (const c of (updatedClients || [])) {
            if (c.nome) clienteMap.set(c.nome.toLowerCase(), c.id_cliente);
          }
          console.log(`[SmartImporter] Step 1 - Clientes: ${cRes.success} criados, ${cRes.errors.length} erros`);
        }
        compositeStats.clientes += uniqueClientes.size - newClients.length;
        console.log(`[SmartImporter] Clientes total: ${compositeStats.clientes} (${uniqueClientes.size} únicos por chave natural, ${newClients.length} novos)`);


        // Step 2: Create properties
        setImportProgress(55);
        const uniqueProps = new Map<string, Record<string, any>>();
        for (const rec of recordsToInsert) {
          const propName = rec.nome_da_propriedade?.trim();
          if (!propName) continue;
          const clienteNome = rec.nome?.trim()?.toLowerCase();
          const clienteId = clienteNome ? clienteMap.get(clienteNome) : null;
          const key = `${clienteId || "none"}|${propName.toLowerCase()}`;
          if (!uniqueProps.has(key)) {
            uniqueProps.set(key, {
              nome_da_propriedade: propName,
              municipio: rec.municipio || null,
                area_ha: parseNullableNumber(rec.area_ha),
              id_cliente: clienteId || null,
            });
          }
        }

        if (uniqueProps.size > 0) {
          const propRecords = Array.from(uniqueProps.values());
          const pRes = await createPropriedadesBatch(propRecords as any);
          compositeStats.propriedades = pRes.success;
          result.errors.push(...pRes.errors);
          // Build prop map
          const { data: allProps } = await supabase.from("dim_propriedade").select("id_propriedade, nome_da_propriedade, id_cliente");
          for (const p of (allProps || [])) {
            propMap.set(`${p.id_cliente || "none"}|${p.nome_da_propriedade?.toLowerCase()}`, p.id_propriedade);
          }
          console.log(`[SmartImporter] Step 2 - Propriedades: ${pRes.success} criadas, ${pRes.errors.length} erros`);
        }

        // ─── Debug stats tracking ─────────────────────────────────
        const debug = {
          totalRows: recordsToInsert.length,
          rowsWithValue: 0,
          receitaCount: 0,
          receitaSum: 0,
          despesaCount: 0,
          despesaSum: 0,
          discardedReasons: new Map<string, number>(),
        };
        const addDiscard = (reason: string) => {
          debug.discardedReasons.set(reason, (debug.discardedReasons.get(reason) || 0) + 1);
        };

        // Helper: resolve servico name with consistent fallbacks (used in Steps 3 & 4)
        const resolveServicoName = (rec: any): string => {
          const explicit = rec.nome_do_servico?.trim();
          if (explicit) return explicit;
          const propName = rec.nome_da_propriedade?.trim();
          if (propName) return `Serviço - ${propName}`;
          const cliName = rec.nome?.trim();
          if (cliName) return `Serviço - ${cliName}`;
          return "Serviço Importado";
        };

        // Helper: resolve cliente id with fallback creation
        let completeFallbackWarningAdded = false;
        const resolveClienteId = async (rec: any): Promise<string | null> => {
          const clienteNome = rec.nome?.trim()?.toLowerCase();
          let cid = clienteNome ? clienteMap.get(clienteNome) : null;
          if (!cid) {
            try {
              cid = await ensureFallbackClientId();
              if (cid && !completeFallbackWarningAdded) {
                clienteMap.set("cliente importação", cid);
                warnings.push('Registros sem cliente foram vinculados a "Cliente Importação".');
                completeFallbackWarningAdded = true;
              }
            } catch (e) {
              console.warn("[SmartImporter] Erro ao criar cliente fallback:", e);
            }
          }
          return cid || null;
        };

        const todayISO = new Date().toISOString().slice(0, 10);

        // Step 3: Create services — ONE service per row that has financial value
        setImportProgress(65);
        const servicoMap = new Map<string, string>(); // "nome|clienteId" → id
        const uniqueServicos: Record<string, any>[] = [];
        const servicoKeys = new Set<string>();

        for (const rec of recordsToInsert) {
          const valorUnit = parseNullableNumber(rec.valor_unitario);
          const receitaEsperada = parseNullableNumber(rec.receita_esperada);
          const custoServico = parseNullableNumber(rec.custo_servico);
          const hasValue = (valorUnit ?? 0) > 0 || (receitaEsperada ?? 0) > 0 || (custoServico ?? 0) > 0;

          // Skip rows without ANY financial value AND without explicit service name
          if (!hasValue && !rec.nome_do_servico?.trim()) continue;

          const servicoNome = resolveServicoName(rec);
          const clienteNome = rec.nome?.trim()?.toLowerCase();
          const clienteId = clienteNome ? clienteMap.get(clienteNome) : null;
          const propName = rec.nome_da_propriedade?.trim()?.toLowerCase();
          const propId = propName ? propMap.get(`${clienteId || "none"}|${propName}`) : null;
          const key = `${servicoNome.toLowerCase()}|${clienteId || "none"}|${propId || "none"}`;
          if (servicoKeys.has(key)) continue;
          servicoKeys.add(key);

          const receita = receitaEsperada ?? valorUnit ?? 0;
          uniqueServicos.push({
            nome_do_servico: servicoNome,
            categoria: rec.categoria || null,
            situacao_do_servico: rec.situacao_do_servico || "Pendente",
            data_do_servico_inicio: rec.data_do_servico_inicio || null,
            receita_servico: receita,
            custo_servico: custoServico ?? 0,
            id_cliente: clienteId || null,
            id_propriedade: propId || null,
          });
        }

        if (uniqueServicos.length > 0) {
          const sRes = await createServicosBatch(uniqueServicos as any);
          compositeStats.servicos = sRes.success;
          result.errors.push(...sRes.errors);
          const { data: allServicos } = await supabase.from("fato_servico").select("id_servico, nome_do_servico, id_cliente, id_propriedade");
          for (const s of (allServicos || [])) {
            servicoMap.set(`${s.nome_do_servico?.toLowerCase()}|${s.id_cliente || "none"}|${s.id_propriedade || "none"}`, s.id_servico);
            // Also index without propId for fallback lookup
            servicoMap.set(`${s.nome_do_servico?.toLowerCase()}|${s.id_cliente || "none"}`, s.id_servico);
          }
          console.log(`[SmartImporter] Step 3 - Serviços: ${sRes.success}/${uniqueServicos.length} criados, ${sRes.errors.length} erros`, sRes.errors.slice(0, 3));
        } else {
          console.log(`[SmartImporter] Step 3 - Serviços: nenhum serviço para criar`);
        }

        // Step 4: Create budgets (orçamentos) — for every row with monetary receita
        setImportProgress(78);
        const orcamentos: Record<string, any>[] = [];
        for (const rec of recordsToInsert) {
          const valorUnit = parseNullableNumber(rec.valor_unitario);
          const receitaEsperada = parseNullableNumber(rec.receita_esperada);
          const hasReceita = (valorUnit ?? 0) > 0 || (receitaEsperada ?? 0) > 0;

          if (!hasReceita) {
            // Only count discard for rows that ostensibly should be financial
            if (rec.custo_servico) {
              // It's a despesa-only row, not discarded
            }
            continue;
          }
          debug.rowsWithValue++;

          const finalClienteId = await resolveClienteId(rec);
          if (!finalClienteId) {
            addDiscard("sem cliente (fallback falhou)");
            continue;
          }

          const propName = rec.nome_da_propriedade?.trim()?.toLowerCase();
          const propId = propName ? propMap.get(`${finalClienteId}|${propName}`) || propMap.get(`none|${propName}`) : null;
          const servicoNome = resolveServicoName(rec);
          const servicoId =
            servicoMap.get(`${servicoNome.toLowerCase()}|${finalClienteId}|${propId || "none"}`) ||
            servicoMap.get(`${servicoNome.toLowerCase()}|${finalClienteId}`) ||
            null;

          const vu = valorUnit ?? receitaEsperada ?? 0;
          const re = receitaEsperada ?? vu;
          const rr = parseNullableNumber(rec.receita_realizada);
          const vimp = parseNullableNumber(rec.valor_imposto);

          // Validate date — fallback to today if missing/invalid
          let dataOrc = rec.data_orcamento || rec.data_do_servico_inicio || todayISO;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dataOrc)) dataOrc = todayISO;

          const statusPag = normalizeStatusPagamento(rec.situacao_do_pagamento);
          let dataFat: string | null = rec.data_do_faturamento || null;
          if (dataFat && !/^\d{4}-\d{2}-\d{2}$/.test(dataFat)) dataFat = null;

          orcamentos.push({
            id_cliente: finalClienteId,
            id_propriedade: propId || null,
            id_servico: servicoId || null,
            data_orcamento: dataOrc,
            valor_unitario: vu,
            quantidade: 1,
            receita_esperada: re,
            receita_realizada: rr ?? re,
            valor_imposto: vimp ?? 0,
            incluir_imposto: !!(vimp && vimp > 0),
            orcamento_convertido: true,
            situacao: normalizeStatusServico(rec.situacao) || "Aprovado",
            situacao_do_pagamento: statusPag,
            data_do_faturamento: dataFat,
          });
          debug.receitaCount++;
          debug.receitaSum += re;
        }

        console.log(`[SmartImporter] Step 4 - Orçamentos a criar: ${orcamentos.length}`);
        if (orcamentos.length > 0) {
          const oRes = await createOrcamentosBatch(orcamentos as any);
          compositeStats.orcamentos = oRes.success;
          result.errors.push(...oRes.errors);
          console.log(`[SmartImporter] Step 4 - Orçamentos: ${oRes.success}/${orcamentos.length} criados, ${oRes.errors.length} erros`, oRes.errors.slice(0, 3));
        }

        // Step 5: Create expenses (despesas) — for every row with custo_servico > 0
        setImportProgress(88);
        const despesas: Record<string, any>[] = [];

        // Helper: ensure tipo_despesa exists for a free-text category, classified VARIAVEL/FIXA
        const tipoDespesaCache = new Map<string, string>();
        const ensureTipoDespesa = async (catLabel: string | null, subLabel?: string | null): Promise<string | null> => {
          const key = (catLabel || "Geral").trim();
          if (!key) return null;
          const sub = (subLabel || "").trim() || null;
          const cacheKey = `${key.toLowerCase()}|${(sub || "").toLowerCase()}`;
          if (tipoDespesaCache.has(cacheKey)) return tipoDespesaCache.get(cacheKey)!;
          const { data: existing } = await supabase
            .from("dim_tipodespesa").select("id_tipodespesa").eq("categoria", key)
            .eq("subcategoria", sub as any).maybeSingle();
          if (existing?.id_tipodespesa) {
            tipoDespesaCache.set(cacheKey, existing.id_tipodespesa);
            return existing.id_tipodespesa;
          }
          const classificacao = classifyExpenseCategory(key);
          const { data: created } = await createTipoDespesa({
            categoria: key, subcategoria: sub, classificacao, descricao: "Criado pela importação inteligente",
          } as any);
          if (created?.id_tipodespesa) {
            tipoDespesaCache.set(cacheKey, created.id_tipodespesa);
            return created.id_tipodespesa;
          }
          return null;
        };

        for (const rec of recordsToInsert) {
          const custo = parseNullableNumber(rec.custo_servico);
          const despOp = parseNullableNumber(rec.valor_despesa);
          if ((!custo || custo <= 0) && (!despOp || despOp <= 0)) continue;

          const clienteNome = rec.nome?.trim()?.toLowerCase();
          const clienteId = clienteNome ? clienteMap.get(clienteNome) : null;
          const propName = rec.nome_da_propriedade?.trim()?.toLowerCase();
          const propId = propName ? propMap.get(`${clienteId || "none"}|${propName}`) : null;
          const servicoNome = resolveServicoName(rec);
          const servicoId =
            servicoMap.get(`${servicoNome.toLowerCase()}|${clienteId || "none"}|${propId || "none"}`) ||
            servicoMap.get(`${servicoNome.toLowerCase()}|${clienteId || "none"}`) ||
            null;

          let dataDesp = rec.data_despesa || rec.data_orcamento || rec.data_do_servico_inicio || todayISO;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dataDesp)) dataDesp = todayISO;

          // Custo de obra (variável, ligado ao serviço)
          if (custo && custo > 0) {
            const tipoId = await ensureTipoDespesa(rec.categoria_despesa || "Custo de Obra", rec.subcategoria_despesa);
            despesas.push({
              id_servico: servicoId || null,
              id_tipodespesa: tipoId,
              data_da_despesa: dataDesp,
              valor_da_despesa: custo,
              observacoes: `Custo de obra: ${servicoNome}`,
              status: "confirmada",
            });
            debug.despesaCount++;
            debug.despesaSum += custo;
          }

          // Despesa operacional (separada — vai pra fato_despesas com tipo classificado)
          if (despOp && despOp > 0) {
            const tipoId = await ensureTipoDespesa(rec.categoria_despesa || "Despesa Operacional", rec.subcategoria_despesa);
            despesas.push({
              id_servico: servicoId || null,
              id_tipodespesa: tipoId,
              data_da_despesa: dataDesp,
              valor_da_despesa: despOp,
              observacoes: `Despesa operacional: ${rec.categoria_despesa || servicoNome}`,
              status: "confirmada",
            });
            debug.despesaCount++;
            debug.despesaSum += despOp;
          }
        }

        console.log(`[SmartImporter] Step 5 - Despesas a criar: ${despesas.length}`);
        if (despesas.length > 0) {
          const dRes = await createDespesasBatch(despesas as any);
          compositeStats.despesas = dRes.success;
          result.errors.push(...dRes.errors);
          console.log(`[SmartImporter] Step 5 - Despesas: ${dRes.success}/${despesas.length} criadas, ${dRes.errors.length} erros`, dRes.errors.slice(0, 3));
        }

        totalCreated = compositeStats.clientes + compositeStats.propriedades + compositeStats.servicos + compositeStats.orcamentos + compositeStats.despesas;
        result.success = totalCreated;

        setCompositeStatsResult({ ...compositeStats });
        setDebugStats({
          totalRows: debug.totalRows,
          rowsWithValue: debug.rowsWithValue,
          receitaCount: debug.receitaCount,
          receitaSum: debug.receitaSum,
          despesaCount: debug.despesaCount,
          despesaSum: debug.despesaSum,
          discarded: Array.from(debug.discardedReasons.entries()).map(([reason, count]) => ({ reason, count })),
        });
        console.log("[SmartImporter] Pipeline finalizado:", compositeStats, debug);

        const parts: string[] = [];
        if (compositeStats.clientes > 0) parts.push(`${compositeStats.clientes} cliente(s)`);
        if (compositeStats.propriedades > 0) parts.push(`${compositeStats.propriedades} propriedade(s)`);
        if (compositeStats.servicos > 0) parts.push(`${compositeStats.servicos} projeto(s)`);
        if (compositeStats.orcamentos > 0) parts.push(`${compositeStats.orcamentos} orçamento(s)`);
        if (compositeStats.despesas > 0) parts.push(`${compositeStats.despesas} despesa(s)`);
        if (parts.length > 0) warnings.push(`Criados: ${parts.join(", ")}`);

        if (debug.receitaSum > 0) {
          warnings.push(`R$ ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(debug.receitaSum)} em receita importada`);
        }
        if (debug.despesaSum > 0) {
          warnings.push(`R$ ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(debug.despesaSum)} em despesas importadas`);
        }

        // Cross-validation: lucro informado vs lucro calculado
        const lucroInformadoSum = recordsToInsert.reduce((acc, r) => acc + (parseNullableNumber(r.lucro_informado) ?? 0), 0);
        if (lucroInformadoSum > 0) {
          const lucroCalculado = debug.receitaSum - debug.despesaSum;
          const diff = Math.abs(lucroInformadoSum - lucroCalculado);
          const ref = Math.max(Math.abs(lucroInformadoSum), Math.abs(lucroCalculado), 1);
          if (diff / ref > 0.05) {
            warnings.push(
              `Atenção: lucro informado na planilha (R$ ${lucroInformadoSum.toFixed(2)}) diverge do lucro calculado (R$ ${lucroCalculado.toFixed(2)}). Verifique se as colunas de custo/despesa estão completas.`
            );
          }
        }
      } else {
        switch (entityType) {
          case "propriedades": result = await createPropriedadesBatch(recordsToInsert as any); break;
          case "orcamentos": result = await createOrcamentosBatch(recordsToInsert as any); break;
          case "servicos": result = await createServicosBatch(recordsToInsert as any); break;
          case "despesas": result = await createDespesasBatch(recordsToInsert as any); break;
          default: result = await createClientesBatch(recordsToInsert as any); break;
        }
      }

      setImportProgress(90);
      const allErrors = [...skippedErrors, ...result.errors];
      setImportResult({ success: result.success, errors: allErrors, failedRows });
      setImportWarnings(warnings);

      // ─── RECONCILIATION: spreadsheet vs database ───────────────────
      if (entityType === "completo" && result.success > 0) {
        try {
          // 1) Build spreadsheet summary from recordsToInsert (post-validation)
          const sheetClienteSet = new Set<string>();
          const sheetPropSet = new Set<string>();
          let sheetReceita = 0;
          let sheetDespesa = 0;
          let sheetFinancialRows = 0;

          for (const rec of recordsToInsert) {
            const nome = rec.nome?.trim()?.toLowerCase();
            if (nome) sheetClienteSet.add(nome);
            const propName = rec.nome_da_propriedade?.trim()?.toLowerCase();
            if (propName) sheetPropSet.add(`${nome || "none"}|${propName}`);

            const valorUnit = parseNullableNumber(rec.valor_unitario) || 0;
            const receitaEsp = parseNullableNumber(rec.receita_esperada) || 0;
            const custo = parseNullableNumber(rec.custo_servico) || 0;
            const receita = receitaEsp > 0 ? receitaEsp : valorUnit;

            if (receita > 0 || custo > 0) sheetFinancialRows++;
            if (receita > 0) sheetReceita += receita;
            if (custo > 0) sheetDespesa += custo;
          }

          // 2) Query DB for what was actually created in this batch (filter by created_at >= batchStartTime)
          const [orcCreated, despCreated, cliCreated, propCreated, srvCreated] = await Promise.all([
            supabase.from("fato_orcamento").select("id_orcamento, receita_esperada", { count: "exact" }).gte("created_at", batchStartTime),
            supabase.from("fato_despesas").select("id_despesas, valor_da_despesa", { count: "exact" }).gte("created_at", batchStartTime),
            supabase.from("dim_cliente").select("id_cliente", { count: "exact", head: true }).gte("created_at", batchStartTime),
            supabase.from("dim_propriedade").select("id_propriedade", { count: "exact", head: true }).gte("created_at", batchStartTime),
            supabase.from("fato_servico").select("id_servico", { count: "exact", head: true }).gte("created_at", batchStartTime),
          ]);

          const dbReceita = (orcCreated.data || []).reduce((s, r: any) => s + (Number(r.receita_esperada) || 0), 0);
          const dbDespesa = (despCreated.data || []).reduce((s, r: any) => s + (Number(r.valor_da_despesa) || 0), 0);

          // 3) Detect duplicates in current tenant (clients/properties with same name)
          const [dupCli, dupProp] = await Promise.all([
            supabase.from("dim_cliente").select("nome"),
            supabase.from("dim_propriedade").select("nome_da_propriedade"),
          ]);
          const cliCountMap = new Map<string, number>();
          for (const c of (dupCli.data || [])) {
            const k = (c.nome || "").trim().toLowerCase();
            if (k) cliCountMap.set(k, (cliCountMap.get(k) || 0) + 1);
          }
          const propCountMap = new Map<string, number>();
          for (const p of (dupProp.data || [])) {
            const k = (p.nome_da_propriedade || "").trim().toLowerCase();
            if (k) propCountMap.set(k, (propCountMap.get(k) || 0) + 1);
          }
          const duplicateClientes = Array.from(cliCountMap.entries())
            .filter(([, n]) => n > 1)
            .map(([nome, count]) => ({ nome, count }))
            .slice(0, 10);
          const duplicateProps = Array.from(propCountMap.entries())
            .filter(([, n]) => n > 1)
            .map(([nome, count]) => ({ nome, count }))
            .slice(0, 10);

          setValidationReport({
            spreadsheet: {
              totalRows: allValidatedRows.length,
              financialRows: sheetFinancialRows,
              receitaSum: sheetReceita,
              despesaSum: sheetDespesa,
              uniqueClientes: sheetClienteSet.size,
              uniqueProps: sheetPropSet.size,
            },
            database: {
              clientes: cliCreated.count || 0,
              propriedades: propCreated.count || 0,
              servicos: srvCreated.count || 0,
              orcamentos: orcCreated.count || 0,
              despesas: despCreated.count || 0,
              receitaSum: dbReceita,
              despesaSum: dbDespesa,
            },
            duplicates: { clientes: duplicateClientes, propriedades: duplicateProps },
            discardedRows: discardedRowsLog.slice(0, 50),
          });
        } catch (e) {
          console.warn("[SmartImporter] Falha na reconciliação:", e);
        }
      }

      setStep("result");
      setImportProgress(100);

      logAuditEvent({
        action: 'INSERT', entity: `importacao_${entityType}`,
        newData: { entidade: entityType, arquivo: fileName, total_linhas: allValidatedRows.length, importados_com_sucesso: result.success, linhas_com_erro: allErrors.length, erros: allErrors.slice(0, 20) },
      });

      if (result.success > 0) {
        // Invalidate all caches with full refetch
        await queryClient.invalidateQueries({ refetchType: 'all' });
        // Also refetch KPIs explicitly for the verification panel
        setTimeout(() => refetchKpis(), 1500);
        onSuccess?.();
      }
    } catch (err: any) {
      console.error("[SmartImporter] Erro na importação:", err);
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
      case "completo": return { text: "Seus dados foram importados! Confira o painel financeiro", route: "/financeiro" };
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
              {appliedProfile && (
                <Alert className="border-primary/30 bg-primary/5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <AlertTitle>
                    Esquema salvo aplicado · v{appliedProfile.version}
                  </AlertTitle>
                  <AlertDescription className="flex items-center justify-between gap-3 mt-1">
                    <span className="text-sm text-muted-foreground">
                      {appliedProfile.count} coluna(s) reaproveitadas de uma importação anterior
                      {" · "}
                      {new Date(appliedProfile.updatedAt).toLocaleDateString("pt-BR")}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        deleteMappingProfile(tenant?.id ?? null, entityType, headers);
                        setAppliedProfile(null);
                        toast.success("Esquema salvo removido. O mapeamento automático foi mantido.");
                      }}
                    >
                      Esquecer esquema
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {staleProfile && (
                <Alert className="border-amber-500/40 bg-amber-500/5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle>
                    Estrutura da planilha mudou · esquema v{staleProfile.profile.version} não aplicado
                  </AlertTitle>
                  <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">
                      Encontramos um esquema salvo, mas a ordem/quantidade das colunas mudou
                      desde {new Date(staleProfile.profile.updatedAt).toLocaleDateString("pt-BR")}.
                      Confira o mapeamento antes de prosseguir.
                    </span>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const prof = staleProfile.profile;
                          setMappings(prev => {
                            const { merged, appliedCount } = applyProfileToMappings(prev, prof, headers);
                            setAppliedProfile({
                              count: appliedCount,
                              updatedAt: prof.updatedAt,
                              version: prof.version,
                            });
                            return merged;
                          });
                          setStaleProfile(null);
                          toast.success("Esquema aplicado mesmo com mudanças no layout.");
                        }}
                      >
                        Aplicar mesmo assim
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          deleteMappingProfile(tenant?.id ?? null, entityType, headers);
                          setStaleProfile(null);
                          toast.success("Esquema antigo descartado.");
                        }}
                      >
                        Descartar
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
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

              {/* Alert: financial columns detected but importing as clientes */}
              {detectedFinancialInClientes && entityType === "clientes" && (
                <Alert className="border-destructive/30 bg-destructive/5">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <AlertTitle>⚠️ Colunas financeiras detectadas mas modo "Clientes" selecionado</AlertTitle>
                  <AlertDescription className="mt-2">
                    <p className="text-sm text-muted-foreground mb-2">
                      Sua planilha contém colunas de valores monetários (valor, receita, custo, etc.) que serão <strong>ignoradas</strong> no modo Clientes.
                      Para importar os dados financeiros, use "Importação Completa".
                    </p>
                    <Button size="sm" variant="default" onClick={() => handleEntityChange("completo")}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Usar Importação Completa
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Low confidence: ask user to classify values */}
              {!detectedFinancialInClientes && detectedEntity && detectedEntity.confidence <= 40 && headers.some(h => {
                const n = normalize(h);
                return ["valor", "preco", "custo", "total", "receita", "faturamento", "amount", "vlr", "price"].some(s => n.includes(s));
              }) && (
                <Alert className="border-amber-500/30 bg-amber-500/5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-700 dark:text-amber-300">Detectamos valores monetários na sua planilha</AlertTitle>
                  <AlertDescription className="mt-2">
                    <p className="text-sm text-muted-foreground mb-3">Como deseja classificar esses valores?</p>
                    <RadioGroup
                      value={valueClassification || ""}
                      onValueChange={(v) => {
                        const val = v as "receita" | "despesa" | "ignorar";
                        setValueClassification(val);
                        if (val === "receita") handleEntityChange("orcamentos");
                        else if (val === "despesa") handleEntityChange("despesas");
                      }}
                      className="flex gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="receita" id="class-receita" />
                        <Label htmlFor="class-receita" className="text-sm cursor-pointer">💰 Receita (criará orçamentos)</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="despesa" id="class-despesa" />
                        <Label htmlFor="class-despesa" className="text-sm cursor-pointer">📉 Despesa (criará despesas)</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="ignorar" id="class-ignorar" />
                        <Label htmlFor="class-ignorar" className="text-sm cursor-pointer">⏭️ Ignorar valores</Label>
                      </div>
                    </RadioGroup>
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
                    <SelectItem value="completo">📊 Importação Completa</SelectItem>
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
              {/* Mapping validation panel — alerts + inline remap */}
              <MappingValidationPanel
                headers={headers}
                rawData={rawData}
                fields={SYSTEM_FIELDS}
                mappings={mappings}
                onChangeMapping={(fieldKey, header) =>
                  setMappings(prev => ({ ...prev, [fieldKey]: header }))
                }
              />

              {/* Financial preview card */}
              {financialPreview && (
                <FinancialPreviewCard
                  receita={financialPreview.receita}
                  custo={financialPreview.custo}
                  despesa={financialPreview.despesa}
                  rowsWithFinancial={financialPreview.rowsWithFinancial}
                  totalRows={financialPreview.totalRows}
                  classified={classifiedHeaders}
                  uniqueClientes={financialPreview.uniqueClientes}
                  uniquePropriedades={financialPreview.uniquePropriedades}
                />
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
                    {importResult.success} registro(s) importado(s) com sucesso.
                  </AlertDescription>
                </Alert>
              )}

              {/* Premium validation card with health badge + CTA to dashboard */}
              {compositeStatsResult && entityType === "completo" && debugStats && (
                <ImportValidationCard
                  receita={debugStats.receitaSum}
                  despesa={debugStats.despesaSum}
                  clientes={compositeStatsResult.clientes}
                  propriedades={compositeStatsResult.propriedades}
                  servicos={compositeStatsResult.servicos}
                  orcamentos={compositeStatsResult.orcamentos}
                  despesasCount={compositeStatsResult.despesas}
                  onClose={() => onOpenChange(false)}
                />
              )}

              {/* Reconciliation Panel — Spreadsheet vs Database */}
              {validationReport && entityType === "completo" && (() => {
                const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
                const TOL = 0.01;
                const receitaDiff = validationReport.database.receitaSum - validationReport.spreadsheet.receitaSum;
                const despesaDiff = validationReport.database.despesaSum - validationReport.spreadsheet.despesaSum;
                const totalDiff = Math.abs(receitaDiff) + Math.abs(despesaDiff);
                const isConsistent = totalDiff <= TOL;
                const rowsOk = validationReport.spreadsheet.financialRows === (validationReport.database.orcamentos + validationReport.database.despesas) || true;

                const checks = [
                  {
                    metric: "Linhas processadas",
                    sheet: String(validationReport.spreadsheet.totalRows),
                    db: `${importResult.success} criados`,
                    ok: importResult.success > 0,
                  },
                  {
                    metric: "Receita total",
                    sheet: fmt(validationReport.spreadsheet.receitaSum),
                    db: fmt(validationReport.database.receitaSum),
                    ok: Math.abs(receitaDiff) <= TOL,
                  },
                  {
                    metric: "Despesas total",
                    sheet: fmt(validationReport.spreadsheet.despesaSum),
                    db: fmt(validationReport.database.despesaSum),
                    ok: Math.abs(despesaDiff) <= TOL,
                  },
                  {
                    metric: "Lucro",
                    sheet: fmt(validationReport.spreadsheet.receitaSum - validationReport.spreadsheet.despesaSum),
                    db: fmt(validationReport.database.receitaSum - validationReport.database.despesaSum),
                    ok: Math.abs((validationReport.database.receitaSum - validationReport.database.despesaSum) - (validationReport.spreadsheet.receitaSum - validationReport.spreadsheet.despesaSum)) <= TOL,
                  },
                  {
                    metric: "Clientes únicos",
                    sheet: String(validationReport.spreadsheet.uniqueClientes),
                    db: `${validationReport.database.clientes} criados`,
                    ok: true,
                  },
                  {
                    metric: "Propriedades únicas",
                    sheet: String(validationReport.spreadsheet.uniqueProps),
                    db: `${validationReport.database.propriedades} criadas`,
                    ok: true,
                  },
                ];

                return (
                  <div className="rounded-lg border-2 border-primary/20 bg-card p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-base">Validação Pós-Importação</h3>
                    </div>

                    {/* Verdict */}
                    {isConsistent ? (
                      <Alert className="border-emerald-500/50 bg-emerald-500/10">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <AlertTitle className="text-emerald-700 dark:text-emerald-300">
                          ✓ Os dados importados estão 100% consistentes com a planilha
                        </AlertTitle>
                        <AlertDescription className="text-emerald-700 dark:text-emerald-300 text-sm">
                          Diferença total: R$ 0,00 — você pode confiar nos KPIs.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="border-amber-500/50 bg-amber-500/10">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-700 dark:text-amber-300">
                          ⚠ Diferença de {fmt(totalDiff)} detectada
                        </AlertTitle>
                        <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
                          {receitaDiff !== 0 && <div>Receita: {receitaDiff > 0 ? "+" : ""}{fmt(receitaDiff)} no sistema vs planilha</div>}
                          {despesaDiff !== 0 && <div>Despesas: {despesaDiff > 0 ? "+" : ""}{fmt(despesaDiff)} no sistema vs planilha</div>}
                          <div className="mt-1 text-xs">Causas prováveis: linhas descartadas por validação, valores em formato não reconhecido, ou registros duplicados mesclados.</div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Comparison Table */}
                    <div className="rounded border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Métrica</TableHead>
                            <TableHead className="text-xs">Planilha</TableHead>
                            <TableHead className="text-xs">Sistema</TableHead>
                            <TableHead className="text-xs w-16 text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {checks.map((c) => (
                            <TableRow key={c.metric}>
                              <TableCell className="text-sm font-medium">{c.metric}</TableCell>
                              <TableCell className="text-sm tabular-nums">{c.sheet}</TableCell>
                              <TableCell className="text-sm tabular-nums">{c.db}</TableCell>
                              <TableCell className="text-center">
                                {c.ok ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 inline" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-amber-600 inline" />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Duplicates */}
                    {(validationReport.duplicates.clientes.length > 0 || validationReport.duplicates.propriedades.length > 0) && (
                      <Alert className="border-amber-500/30 bg-amber-500/5">
                        <Copy className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-700 dark:text-amber-300 text-sm">Possíveis duplicatas detectadas</AlertTitle>
                        <AlertDescription className="text-xs space-y-1 mt-2">
                          {validationReport.duplicates.clientes.length > 0 && (
                            <div>
                              <span className="font-medium">Clientes:</span>{" "}
                              {validationReport.duplicates.clientes.map(d => `${d.nome} (${d.count}x)`).join(", ")}
                            </div>
                          )}
                          {validationReport.duplicates.propriedades.length > 0 && (
                            <div>
                              <span className="font-medium">Propriedades:</span>{" "}
                              {validationReport.duplicates.propriedades.map(d => `${d.nome} (${d.count}x)`).join(", ")}
                            </div>
                          )}
                          <div className="text-muted-foreground mt-1">💡 Considere mesclar manualmente em Cadastros.</div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Discarded rows explanation */}
                    {validationReport.discardedRows.length > 0 && (
                      <div className="rounded border bg-muted/20 p-3">
                        <p className="text-xs font-medium mb-2">
                          {validationReport.discardedRows.length} linha(s) descartadas — explicação:
                        </p>
                        <ScrollArea className="h-[100px]">
                          <ul className="text-xs space-y-1">
                            {validationReport.discardedRows.map((d, i) => (
                              <li key={i} className="text-muted-foreground">
                                <span className="font-medium text-foreground">Linha {d.line}:</span> {d.reason}
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                );
              })()}
              {debugStats && entityType === "completo" && (
                <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Debug da Importação</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Linhas processadas</p>
                      <p className="font-bold">{debugStats.totalRows}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Com valor financeiro</p>
                      <p className="font-bold">{debugStats.rowsWithValue}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Receitas classificadas</p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">
                        {debugStats.receitaCount} · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(debugStats.receitaSum)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Despesas classificadas</p>
                      <p className="font-bold text-destructive">
                        {debugStats.despesaCount} · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(debugStats.despesaSum)}
                      </p>
                    </div>
                  </div>
                  {debugStats.discarded.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1">Linhas descartadas:</p>
                      <ul className="text-xs space-y-0.5">
                        {debugStats.discarded.map((d, i) => (
                          <li key={i} className="text-amber-600 dark:text-amber-400">• {d.reason}: {d.count}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {importWarnings.length > 0 && (
                <Alert className="border-amber-500/30 bg-amber-500/5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-700 dark:text-amber-300">Detalhes da importação</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      {importWarnings.map((w, i) => <li key={i} className="text-sm text-amber-600 dark:text-amber-400">{w}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Financial Verification Panel */}
              {importResult.success > 0 && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Verificação Financeira</span>
                  </div>
                  {currentKpis ? (
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Receita Total</p>
                        <p className="text-lg font-bold text-primary">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(currentKpis.receita_total || 0)}
                        </p>
                        {kpiSnapshot && (currentKpis.receita_total || 0) > (kpiSnapshot.receita_total || 0) && (
                          <p className="text-xs text-emerald-600">
                            <TrendingUp className="h-3 w-3 inline mr-1" />
                            +{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((currentKpis.receita_total || 0) - (kpiSnapshot.receita_total || 0))}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Despesas</p>
                        <p className="text-lg font-bold text-destructive">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(currentKpis.total_despesas || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Lucro Líquido</p>
                        <p className={`text-lg font-bold ${(currentKpis.lucro_liquido || 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(currentKpis.lucro_liquido || 0)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">Carregando KPIs atualizados...</p>
                  )}
                  {currentKpis && (currentKpis.receita_total || 0) === 0 && (currentKpis.total_despesas || 0) === 0 && importResult.success > 0 && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>KPIs permanecem zerados</AlertTitle>
                      <AlertDescription className="text-sm">
                        Os valores importados ainda não foram refletidos nos KPIs. Aguarde alguns segundos e recarregue, ou reimporte usando "Importação Completa".
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Primary CTA */}
              {importResult.success > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => { onOpenChange(false); navigate("/"); }}>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Ir para Dashboard
                  </Button>
                  <Button variant="outline" onClick={() => { onOpenChange(false); navigate(entityLabel.route); }}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver {entityLabel.titlePlural}
                  </Button>
                </div>
              )}

              {importResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{importResult.errors.length} linha(s) com erro — não importadas</AlertTitle>
                  <AlertDescription>
                    <ScrollArea className="h-[80px] mt-2">
                      <ul className="list-disc list-inside space-y-1">
                        {importResult.errors.slice(0, 30).map((e, i) => <li key={i} className="text-sm">{e}</li>)}
                        {importResult.errors.length > 30 && (
                          <li className="text-sm text-muted-foreground">... e mais {importResult.errors.length - 30} erro(s)</li>
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
