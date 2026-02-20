import { useState, useCallback } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/services/supabase.service";
import { formatPhoneNumber } from "@/lib/formatPhone";
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
  X,
} from "lucide-react";

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
}

const SYSTEM_FIELDS: SystemField[] = [
  { key: "nome", label: "Nome", required: true },
  { key: "cpf", label: "CPF", required: false, format: formatCPF },
  { key: "cnpj", label: "CNPJ", required: false, format: formatCNPJ },
  {
    key: "telefone",
    label: "Telefone",
    required: false,
    format: formatPhoneNumber,
  },
  {
    key: "celular",
    label: "Celular",
    required: false,
    format: formatPhoneNumber,
  },
  { key: "email", label: "Email", required: false },
  { key: "endereco", label: "Endereço", required: false },
  { key: "categoria", label: "Categoria", required: false },
  { key: "origem", label: "Origem", required: false },
  { key: "situacao", label: "Situação", required: false },
  { key: "anotacoes", label: "Observações", required: false },
  {
    key: "data_cadastro",
    label: "Data de Cadastro",
    required: false,
    format: formatDate,
  },
  { key: "idade", label: "Idade", required: false },
];

function formatCPF(value: string): string {
  const nums = value.replace(/\D/g, "");
  if (nums.length !== 11) return value;
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
}

function formatCNPJ(value: string): string {
  const nums = value.replace(/\D/g, "");
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

type Step = "upload" | "mapping" | "preview" | "importing" | "result";

export function SmartImporter({
  open,
  onOpenChange,
  onSuccess,
}: SmartImporterProps) {
  const [step, setStep] = useState<Step>("upload");
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    errors: string[];
  } | null>(null);

  const reset = () => {
    setStep("upload");
    setRawData([]);
    setHeaders([]);
    setMappings({});
    setFileName("");
    setImportResult(null);
  };

  const processFile = useCallback(
    (file: File) => {
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
          setRawData(data.slice(1).filter((r) => r.some((c) => c?.toString().trim())));
          autoMap(h);
          setStep("mapping");
        };
        reader.readAsArrayBuffer(file);
      } else {
        toast.error("Formato não suportado. Use CSV ou Excel (.xlsx/.xls)");
      }
    },
    []
  );

  const autoMap = (fileHeaders: string[]) => {
    const newMappings: Record<string, string> = {};
    for (const field of SYSTEM_FIELDS) {
      const match = fileHeaders.find((h) => {
        const a = h.toLowerCase().replace(/[_\s]/g, "");
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

  const getPreviewRows = () => {
    return rawData.slice(0, 5).map((row) => {
      const mapped: Record<string, string> = {};
      for (const field of SYSTEM_FIELDS) {
        const csvCol = mappings[field.key];
        if (!csvCol) continue;
        const idx = headers.indexOf(csvCol);
        if (idx === -1) continue;
        let val = (row[idx] ?? "").toString().trim();
        if (val && field.format) val = field.format(val);
        mapped[field.key] = val;
      }
      return mapped;
    });
  };

  const mappedFields = SYSTEM_FIELDS.filter((f) => mappings[f.key]);

  const handleImport = async () => {
    const requiredMissing = SYSTEM_FIELDS.filter(
      (f) => f.required && !mappings[f.key]
    );
    if (requiredMissing.length) {
      toast.error(
        `Campos obrigatórios não mapeados: ${requiredMissing.map((f) => f.label).join(", ")}`
      );
      return;
    }

    setStep("importing");
    setIsLoading(true);
    const errors: string[] = [];
    let success = 0;

    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        toast.error("Sessão inválida. Faça login novamente.");
        setIsLoading(false);
        setStep("mapping");
        return;
      }

      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        const record: Record<string, any> = { tenant_id: tenantId };

        for (const field of SYSTEM_FIELDS) {
          const csvCol = mappings[field.key];
          if (!csvCol) continue;
          const idx = headers.indexOf(csvCol);
          if (idx === -1) continue;

          let val: any = (row[idx] ?? "").toString().trim();
          if (!val) {
            record[field.key] = null;
            continue;
          }

          if (field.format) val = field.format(val);
          if (field.key === "idade") val = parseInt(val) || null;

          record[field.key] = val;
        }

        const { error } = await supabase
          .from("dim_cliente" as any)
          .insert([record as any]);

        if (error) {
          errors.push(`Linha ${i + 2}: ${error.message}`);
        } else {
          success++;
        }
      }

      setImportResult({ success, errors });
      setStep("result");
      if (success > 0) onSuccess?.();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
      setStep("mapping");
    } finally {
      setIsLoading(false);
    }
  };

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
                        : (["upload", "mapping", "preview", "result"].indexOf(step === "importing" ? "preview" : step) >
                          i
                          ? "secondary"
                          : "outline")
                    }
                    className="text-xs"
                  >
                    {i + 1}. {s === "upload" ? "Arquivo" : s === "mapping" ? "Mapear" : s === "preview" ? "Preview" : "Resultado"}
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
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById("smart-import-file")?.click()}
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

          {/* Step 3: Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              <Alert className="border-primary/30 bg-primary/5">
                <Eye className="h-4 w-4 text-primary" />
                <AlertTitle>Preview — Primeiras 5 linhas formatadas</AlertTitle>
                <AlertDescription>
                  Confira se os dados estão corretos antes de importar.
                </AlertDescription>
              </Alert>

              <ScrollArea className="h-[350px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      {mappedFields.map((f) => (
                        <TableHead key={f.key} className="whitespace-nowrap">
                          {f.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getPreviewRows().map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">
                          {i + 1}
                        </TableCell>
                        {mappedFields.map((f) => (
                          <TableCell
                            key={f.key}
                            className="max-w-[200px] truncate"
                          >
                            {row[f.key] || (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <p className="text-sm text-muted-foreground">
                Total de registros a importar:{" "}
                <strong>{rawData.length}</strong>
              </p>
            </div>
          )}

          {/* Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium">Importando dados...</p>
              <p className="text-sm text-muted-foreground">
                Processando {rawData.length} registros
              </p>
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
                    {importResult.errors.length} erro(s)
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
              <Button onClick={handleImport}>
                <Upload className="h-4 w-4 mr-2" />
                Importar {rawData.length} Cliente(s)
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
