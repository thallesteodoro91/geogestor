import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { createClientesBatch } from "@/modules/crm/services/cliente.service";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  ArrowRight,
  ArrowLeft,
  Download,
  AlertTriangle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────

interface SmartImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface SystemField {
  key: string;
  label: string;
  required: boolean;
  format?: (value: string) => string;
  validate?: (value: string) => string | null; // returns error string or null
}

interface RowValidation {
  row: Record<string, string>;
  errors: Record<string, string>; // field key -> error message
  hasErrors: boolean;
}

type Step = "upload" | "mapping" | "preview" | "importing" | "result";

// ─── Sanitizers ─────────────────────────────────────────────────────────

function sanitizeCurrency(value: string): string {
  return value
    .replace(/R\$\s*/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
}

function sanitizeDigitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function sanitizePhone(value: string): string {
  const digits = sanitizeDigitsOnly(value);
  return formatPhoneNumber(digits);
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split("/");
    return `${y}-${m}-${d}`;
  }
  return trimmed;
}

// ─── Validators ─────────────────────────────────────────────────────────

function validateEmail(value: string): string | null {
  if (!value) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value) ? null : "Email inválido";
}

function validateCPF(value: string): string | null {
  if (!value) return null;
  const nums = sanitizeDigitsOnly(value);
  if (nums.length !== 11) return "CPF deve ter 11 dígitos";
  return null;
}

function validateCNPJ(value: string): string | null {
  if (!value) return null;
  const nums = sanitizeDigitsOnly(value);
  if (nums.length !== 14) return "CNPJ deve ter 14 dígitos";
  return null;
}

function validatePhone(value: string): string | null {
  if (!value) return null;
  const nums = sanitizeDigitsOnly(value);
  if (nums.length < 10 || nums.length > 11)
    return "Telefone deve ter 10 ou 11 dígitos";
  return null;
}

function validateAge(value: string): string | null {
  if (!value) return null;
  const n = parseInt(value);
  if (isNaN(n) || n < 0 || n > 150) return "Idade inválida";
  return null;
}

function validateDate(value: string): string | null {
  if (!value) return null;
  const formatted = formatDate(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(formatted)) return "Data inválida (use DD/MM/AAAA ou AAAA-MM-DD)";
  const d = new Date(formatted);
  if (isNaN(d.getTime())) return "Data inválida";
  return null;
}

function validateNome(value: string): string | null {
  if (!value || !value.trim()) return "Nome é obrigatório";
  if (value.trim().length < 2) return "Nome muito curto";
  return null;
}

// ─── Field definitions ──────────────────────────────────────────────────

const SYSTEM_FIELDS: SystemField[] = [
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
  { key: "idade", label: "Idade", required: false, validate: validateAge },
];

// ─── Template download ─────────────────────────────────────────────────

function downloadTemplate() {
  const headers = SYSTEM_FIELDS.map((f) => f.label + (f.required ? " *" : ""));
  const exampleRow = [
    "João da Silva",
    "123.456.789-00",
    "",
    "(62) 3333-4444",
    "(62) 99999-8888",
    "joao@email.com",
    "Rua das Flores, 123",
    "Produtor Rural",
    "Indicação",
    "Ativo",
    "Cliente fiel",
    "2024-01-15",
    "45",
  ];
  const csvContent = [headers.join(";"), exampleRow.join(";")].join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_importacao_clientes.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ──────────────────────────────────────────────────────────

export function SmartImporter({
  open,
  onOpenChange,
  onSuccess,
}: SmartImporterProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("upload");
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [skipErrors, setSkipErrors] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    errors: string[];
  } | null>(null);
  const [importProgress, setImportProgress] = useState(0);

  const reset = () => {
    setImportProgress(0);
    setStep("upload");
    setRawData([]);
    setHeaders([]);
    setMappings({});
    setFileName("");
    setImportResult(null);
    setSkipErrors(false);
  };

  // ─── File processing ───────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv" || ext === "txt") {
      Papa.parse(file, {
        encoding: "UTF-8",
        complete: (results) => {
          const data = results.data as string[][];
          if (data.length < 2) {
            toast.error("Arquivo precisa ter cabeçalho e dados");
            return;
          }
          const h = data[0].map((c) => (c ?? "").toString().trim());
          setHeaders(h);
          setRawData(data.slice(1).filter((r) => r.some((c) => c?.trim())));
          autoMap(h);
          setStep("mapping");
        },
        error: () => toast.error("Erro ao ler arquivo CSV"),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: string[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: "",
        });
        if (data.length < 2) {
          toast.error("Arquivo precisa ter cabeçalho e dados");
          return;
        }
        const h = data[0].map((c) => (c ?? "").toString().trim());
        setHeaders(h);
        setRawData(
          data.slice(1).filter((r) => r.some((c) => c?.toString().trim()))
        );
        autoMap(h);
        setStep("mapping");
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Formato não suportado. Use CSV ou Excel (.xlsx/.xls)");
    }
  }, []);

  const autoMap = (fileHeaders: string[]) => {
    const newMappings: Record<string, string> = {};
    for (const field of SYSTEM_FIELDS) {
      const match = fileHeaders.find((h) => {
        const a = h.toLowerCase().replace(/[_\s*]/g, "");
        const b = field.key.toLowerCase().replace(/[_\s]/g, "");
        const c = field.label.toLowerCase().replace(/[_\s]/g, "");
        return a === b || a === c || a.includes(b) || b.includes(a);
      });
      if (match) newMappings[field.key] = match;
    }
    setMappings(newMappings);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  // ─── Validation engine ────────────────────────────────────────────

  const validateAndFormatRow = useCallback(
    (row: string[]): RowValidation => {
      const mapped: Record<string, string> = {};
      const errors: Record<string, string> = {};

      for (const field of SYSTEM_FIELDS) {
        const csvCol = mappings[field.key];
        if (!csvCol) continue;
        const idx = headers.indexOf(csvCol);
        if (idx === -1) continue;

        let val = (row[idx] ?? "").toString().trim();

        // Sanitize currency-like values
        if (val && /R\$|,\d{2}$/.test(val)) {
          val = sanitizeCurrency(val);
        }

        // Apply field formatter
        if (val && field.format) val = field.format(val);
        mapped[field.key] = val;

        // Validate
        if (field.validate) {
          const err = field.validate(val);
          if (err) errors[field.key] = err;
        }
      }

      // Check required fields
      for (const field of SYSTEM_FIELDS) {
        if (field.required && mappings[field.key] && !mapped[field.key]?.trim()) {
          errors[field.key] = `${field.label} é obrigatório`;
        }
      }

      return { row: mapped, errors, hasErrors: Object.keys(errors).length > 0 };
    },
    [mappings, headers]
  );

  const allValidatedRows = useMemo(() => {
    return rawData.map((row) => validateAndFormatRow(row));
  }, [rawData, validateAndFormatRow]);

  const previewValidations = useMemo(() => {
    return allValidatedRows.slice(0, 5);
  }, [allValidatedRows]);

  const errorCount = useMemo(() => {
    return allValidatedRows.filter((v) => v.hasErrors).length;
  }, [allValidatedRows]);

  const validCount = useMemo(() => {
    return allValidatedRows.filter((v) => !v.hasErrors).length;
  }, [allValidatedRows]);

  const mappedFields = SYSTEM_FIELDS.filter((f) => mappings[f.key]);

  const canImport = skipErrors ? validCount > 0 : errorCount === 0;

  // ─── Import handler ───────────────────────────────────────────────

  const handleImport = async () => {
    const requiredMissing = SYSTEM_FIELDS.filter(
      (f) => f.required && !mappings[f.key]
    );
    if (requiredMissing.length) {
      toast.error(
        `Campos obrigatórios: ${requiredMissing.map((f) => f.label).join(", ")}`
      );
      return;
    }

    setStep("importing");
    setIsLoading(true);
    setImportProgress(0);

    try {
      // 1. Build all records as a single array BEFORE calling the API
      const skippedErrors: string[] = [];
      const recordsToInsert: Record<string, any>[] = [];

      for (let i = 0; i < allValidatedRows.length; i++) {
        const validation = allValidatedRows[i];

        if (validation.hasErrors) {
          if (skipErrors) {
            skippedErrors.push(
              `Linha ${i + 2}: Pulada — ${Object.values(validation.errors).join(", ")}`
            );
            continue;
          }
        }

        const record: Record<string, any> = {};
        for (const field of SYSTEM_FIELDS) {
          if (!mappings[field.key]) continue;
          let val: any = validation.row[field.key];
          if (!val) {
            record[field.key] = null;
            continue;
          }
          if (field.key === "idade") val = parseInt(val) || null;
          record[field.key] = val;
        }
        recordsToInsert.push(record);
      }

      setImportProgress(30);

      // 2. Single batch insert call
      const result = await createClientesBatch(recordsToInsert as any);

      setImportProgress(90);

      const allErrors = [...skippedErrors, ...result.errors];
      setImportResult({ success: result.success, errors: allErrors });
      setStep("result");
      setImportProgress(100);

      if (result.success > 0) {
        // 3. Invalidate React Query cache for immediate UI refresh
        queryClient.invalidateQueries({ queryKey: ["clientes"] });
        queryClient.invalidateQueries({ queryKey: ["resource-counts"] });
        onSuccess?.();
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
      setStep("preview");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importação Inteligente de Clientes
          </DialogTitle>
          <div className="flex items-center gap-2 pt-2">
            {(["upload", "mapping", "preview", "result"] as const).map(
              (s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <Badge
                    variant={
                      step === s || (step === "importing" && s === "preview")
                        ? "default"
                        : ["upload", "mapping", "preview", "result"].indexOf(
                              step === "importing" ? "preview" : step
                            ) > i
                          ? "secondary"
                          : "outline"
                    }
                    className="text-xs"
                  >
                    {i + 1}.{" "}
                    {s === "upload"
                      ? "Arquivo"
                      : s === "mapping"
                        ? "Mapear"
                        : s === "preview"
                          ? "Preview"
                          : "Resultado"}
                  </Badge>
                  {i < 3 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              )
            )}
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
                onClick={() =>
                  document.getElementById("smart-import-file")?.click()
                }
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">
                  Arraste seu arquivo aqui ou clique para selecionar
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Suporta CSV, XLS e XLSX
                </p>
                <input
                  id="smart-import-file"
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) processFile(f);
                  }}
                />
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={downloadTemplate}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar Planilha Modelo
              </Button>
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === "mapping" && (
            <div className="space-y-4">
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertTitle>
                  {fileName} — {rawData.length} linha(s) encontrada(s)
                </AlertTitle>
                <AlertDescription>
                  Associe as colunas do seu arquivo aos campos do sistema. Campos
                  com * são obrigatórios.
                </AlertDescription>
              </Alert>

              <ScrollArea className="h-[350px]">
                <div className="grid gap-3">
                  {SYSTEM_FIELDS.map((field) => (
                    <div
                      key={field.key}
                      className="flex items-center gap-4 px-2"
                    >
                      <Label className="w-40 shrink-0 text-sm">
                        {field.label}
                        {field.required && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </Label>
                      <Select
                        value={mappings[field.key] || ""}
                        onValueChange={(v) =>
                          setMappings((prev) => ({
                            ...prev,
                            [field.key]: v === "__none__" ? "" : v,
                          }))
                        }
                      >
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="— Não importar —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            — Não importar —
                          </SelectItem>
                          {headers.map((h) => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {mappings[field.key] && (
                        <Badge variant="secondary" className="text-xs">
                          ✓ Mapeado
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Step 3: Preview with validation */}
          {step === "preview" && (
            <div className="space-y-4">
              {/* Error summary */}
              {errorCount > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>
                    {errorCount} linha(s) com erro de {rawData.length}
                  </AlertTitle>
                  <AlertDescription className="flex items-center gap-4 mt-2">
                    <span className="text-sm">
                      Corrija os dados ou ative "Pular linhas com erro" para
                      importar apenas as válidas.
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Checkbox
                        id="skip-errors"
                        checked={skipErrors}
                        onCheckedChange={(v) => setSkipErrors(!!v)}
                      />
                      <Label
                        htmlFor="skip-errors"
                        className="text-sm font-medium cursor-pointer whitespace-nowrap"
                      >
                        Pular linhas com erro
                      </Label>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {errorCount === 0 && (
                <Alert className="border-primary/30 bg-primary/5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertTitle>
                    Todas as {rawData.length} linhas estão válidas!
                  </AlertTitle>
                  <AlertDescription>
                    Confira o preview abaixo e clique em Importar.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{validCount} válidas</Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive">{errorCount} com erro</Badge>
                )}
                <span className="ml-auto">Preview: primeiras 5 linhas</span>
              </div>

              <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead className="w-10">Status</TableHead>
                      {mappedFields.map((f) => (
                        <TableHead key={f.key} className="whitespace-nowrap">
                          {f.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewValidations.map((v, i) => (
                      <TableRow
                        key={i}
                        className={
                          v.hasErrors
                            ? "bg-destructive/10 hover:bg-destructive/15"
                            : ""
                        }
                      >
                        <TableCell className="text-muted-foreground">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          {v.hasErrors ? (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </TableCell>
                        {mappedFields.map((f) => {
                          const hasFieldError = !!v.errors[f.key];
                          return (
                            <TableCell
                              key={f.key}
                              className={`max-w-[200px] truncate ${hasFieldError ? "text-destructive font-medium" : ""}`}
                              title={hasFieldError ? v.errors[f.key] : undefined}
                            >
                              {v.row[f.key] ? (
                                <span>
                                  {v.row[f.key]}
                                  {hasFieldError && (
                                    <span className="block text-xs text-destructive/80 font-normal">
                                      {v.errors[f.key]}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">
                                  —
                                </span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium">Importando dados...</p>
              <p className="text-sm text-muted-foreground">
                Processando{" "}
                {skipErrors ? validCount : rawData.length} registros
              </p>
              <div className="w-full max-w-xs">
                <Progress value={importProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center mt-1">
                  {importProgress}%
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Result */}
          {step === "result" && importResult && (
            <div className="space-y-4">
              {importResult.success > 0 && (
                <Alert className="border-emerald-500/50 bg-emerald-500/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <AlertTitle className="text-emerald-600 dark:text-emerald-400">
                    Importação Concluída
                  </AlertTitle>
                  <AlertDescription className="text-emerald-700 dark:text-emerald-300">
                    {importResult.success} cliente(s) importado(s) com sucesso.
                  </AlertDescription>
                </Alert>
              )}
              {importResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {importResult.errors.length} erro(s) / linhas puladas
                  </AlertTitle>
                  <AlertDescription>
                    <ScrollArea className="h-[200px] mt-2">
                      <ul className="list-disc list-inside space-y-1">
                        {importResult.errors.map((e, i) => (
                          <li key={i} className="text-sm">
                            {e}
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === "upload" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={reset}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button
                onClick={() => {
                  const missing = SYSTEM_FIELDS.filter(
                    (f) => f.required && !mappings[f.key]
                  );
                  if (missing.length) {
                    toast.error(
                      `Mapeie os campos obrigatórios: ${missing.map((f) => f.label).join(", ")}`
                    );
                    return;
                  }
                  setStep("preview");
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("mapping")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Ajustar Mapeamento
              </Button>
              <Button onClick={handleImport} disabled={!canImport}>
                <Upload className="h-4 w-4 mr-2" />
                Importar{" "}
                {skipErrors ? validCount : rawData.length} Cliente(s)
              </Button>
            </>
          )}
          {step === "result" && (
            <>
              <Button variant="outline" onClick={reset}>
                Importar Outro
              </Button>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
