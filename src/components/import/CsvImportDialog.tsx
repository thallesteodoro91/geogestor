import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Info } from "lucide-react";
import { getCurrentTenantId } from "@/services/supabase.service";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type TableType = "clientes" | "propriedades" | "tiposervico" | "tipodespesa";

interface ColumnMapping {
  csvColumn: string;
  dbColumn: string;
}

const TABLE_CONFIG: Record<TableType, { 
  tableName: string; 
  columns: { name: string; required: boolean; label: string; description?: string }[];
  displayName: string;
}> = {
  clientes: {
    tableName: "dim_cliente",
    displayName: "Clientes",
    columns: [
      { name: "nome", required: true, label: "Nome *", description: "Nome completo do cliente" },
      { name: "cpf", required: false, label: "CPF", description: "Cadastro de Pessoa Física (formato: 000.000.000-00)" },
      { name: "cnpj", required: false, label: "CNPJ", description: "Cadastro de Pessoa Jurídica (formato: 00.000.000/0000-00)" },
      { name: "endereco", required: false, label: "Endereço", description: "Endereço completo do cliente" },
      { name: "telefone", required: false, label: "Telefone", description: "Telefone fixo (formato: (00) 0000-0000)" },
      { name: "celular", required: false, label: "Celular", description: "Celular/WhatsApp (formato: (00) 00000-0000)" },
      { name: "email", required: false, label: "Email", description: "Email para contato" },
      { name: "categoria", required: false, label: "Categoria", description: "Tipo de cliente: Governo, Pessoa Física, Pessoa Jurídica, Produtor Rural" },
      { name: "origem", required: false, label: "Origem", description: "Canal de prospecção: Indicação, Site, Evento, Rede Social, Parceria" },
      { name: "situacao", required: false, label: "Situação", description: "Status do relacionamento: Ativo, Inativo, Pendente, Lead" },
      { name: "anotacoes", required: false, label: "Observações", description: "Notas e anotações gerais sobre o cliente" },
      { name: "data_cadastro", required: false, label: "Data de Cadastro", description: "Data de entrada do cliente no sistema (formato: AAAA-MM-DD)" },
      { name: "idade", required: false, label: "Idade", description: "Idade do cliente em anos (número inteiro)" },
    ],
  },
  propriedades: {
    tableName: "dim_propriedade",
    displayName: "Propriedades",
    columns: [
      { name: "nome_da_propriedade", required: true, label: "Nome da Propriedade *", description: "Nome identificador da propriedade" },
      { name: "nome_cliente", required: true, label: "Nome do Cliente *", description: "Nome exato do cliente para vincular (deve existir no sistema)" },
      { name: "cidade", required: false, label: "Cidade", description: "Cidade onde a propriedade está localizada" },
      { name: "municipio", required: false, label: "Município", description: "Município da propriedade" },
      { name: "area_ha", required: false, label: "Área (ha)", description: "Área total em hectares (número decimal, ex: 150.5)" },
      { name: "latitude", required: false, label: "Latitude", description: "Coordenada de latitude (formato decimal, ex: -15.7801)" },
      { name: "longitude", required: false, label: "Longitude", description: "Coordenada de longitude (formato decimal, ex: -47.9292)" },
      { name: "tipo", required: false, label: "Tipo", description: "Tipo de propriedade: Fazenda, Sítio, Chácara, Lote" },
      { name: "situacao_imovel", required: false, label: "Situação do Imóvel", description: "Status da documentação: Regular, Pendente, Irregular" },
      { name: "tipo_de_documento", required: false, label: "Tipo de Documento", description: "Tipo de documento de posse: Escritura, Contrato, Posse" },
      { name: "car", required: false, label: "CAR", description: "Código do Cadastro Ambiental Rural" },
      { name: "matricula", required: false, label: "Matrícula", description: "Número da matrícula do imóvel no cartório" },
    ],
  },
  tiposervico: {
    tableName: "dim_tiposervico",
    displayName: "Tipos de Serviço",
    columns: [
      { name: "nome", required: true, label: "Nome *", description: "Nome do tipo de serviço" },
      { name: "categoria", required: false, label: "Categoria", description: "Categoria do serviço: Topografia, Georreferenciamento, Ambiental" },
      { name: "valor_sugerido", required: false, label: "Valor Sugerido", description: "Valor base sugerido em R$ (número decimal, ex: 1500.00)" },
      { name: "descricao", required: false, label: "Descrição", description: "Descrição detalhada do serviço" },
    ],
  },
  tipodespesa: {
    tableName: "dim_tipodespesa",
    displayName: "Tipos de Despesa",
    columns: [
      { name: "categoria", required: true, label: "Categoria *", description: "Categoria principal da despesa: Operacional, Administrativa, Pessoal" },
      { name: "subcategoria", required: false, label: "Subcategoria", description: "Subcategoria para classificação mais específica" },
      { name: "descricao", required: false, label: "Descrição", description: "Descrição detalhada do tipo de despesa" },
    ],
  },
};

export function CsvImportDialog({ open, onOpenChange, onSuccess }: CsvImportDialogProps) {
  const [selectedTable, setSelectedTable] = useState<TableType>("clientes");
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const [step, setStep] = useState<"upload" | "mapping" | "result">("upload");

  const resetState = () => {
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMappings([]);
    setImportResult(null);
    setStep("upload");
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Por favor, selecione um arquivo CSV");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file, "UTF-8");
  };

  const parseCSV = (text: string) => {
    // Detect delimiter (comma or semicolon)
    const firstLine = text.split("\n")[0];
    const delimiter = firstLine.includes(";") ? ";" : ",";

    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      toast.error("O arquivo CSV precisa ter pelo menos um cabeçalho e uma linha de dados");
      return;
    }

    const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/"/g, ""));
    const data = lines.slice(1).map((line) => 
      line.split(delimiter).map((cell) => cell.trim().replace(/"/g, ""))
    );

    setCsvHeaders(headers);
    setCsvData(data);

    // Auto-map columns based on name similarity
    const config = TABLE_CONFIG[selectedTable];
    const autoMappings: ColumnMapping[] = [];
    
    headers.forEach((header) => {
      const headerLower = header.toLowerCase().replace(/[_\s]/g, "");
      const matchedColumn = config.columns.find((col) => {
        const colLower = col.name.toLowerCase().replace(/[_\s]/g, "");
        const labelLower = col.label.toLowerCase().replace(/[_\s*]/g, "");
        return headerLower === colLower || headerLower === labelLower || headerLower.includes(colLower) || colLower.includes(headerLower);
      });

      if (matchedColumn) {
        autoMappings.push({ csvColumn: header, dbColumn: matchedColumn.name });
      }
    });

    setColumnMappings(autoMappings);
    setStep("mapping");
  };

  const handleMappingChange = (csvColumn: string, dbColumn: string) => {
    setColumnMappings((prev) => {
      const filtered = prev.filter((m) => m.csvColumn !== csvColumn);
      if (dbColumn) {
        return [...filtered, { csvColumn, dbColumn }];
      }
      return filtered;
    });
  };

  const validateData = (): string[] => {
    const errors: string[] = [];
    const config = TABLE_CONFIG[selectedTable];
    const requiredColumns = config.columns.filter((c) => c.required);

    // Check if all required columns are mapped
    for (const reqCol of requiredColumns) {
      if (!columnMappings.find((m) => m.dbColumn === reqCol.name)) {
        errors.push(`Coluna obrigatória "${reqCol.label}" não está mapeada`);
      }
    }

    return errors;
  };

  const handleImport = async () => {
    const validationErrors = validateData();
    if (validationErrors.length > 0) {
      setImportResult({ success: 0, errors: validationErrors });
      setStep("result");
      return;
    }

    setIsLoading(true);
    const errors: string[] = [];
    let successCount = 0;

    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        toast.error("Erro: Sessão inválida. Faça login novamente.");
        setIsLoading(false);
        return;
      }

      const config = TABLE_CONFIG[selectedTable];

      // For propriedades, we need to fetch clients first to link by name
      let clientesByName: Record<string, string> = {};
      if (selectedTable === "propriedades") {
        const { data: clientes } = await supabase
          .from("dim_cliente")
          .select("id_cliente, nome");
        
        if (clientes) {
          clientesByName = Object.fromEntries(
            clientes.map((c) => [c.nome.toLowerCase().trim(), c.id_cliente])
          );
        }
      }

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const record: Record<string, any> = { tenant_id: tenantId };

        // Map CSV columns to DB columns
        for (const mapping of columnMappings) {
          const csvIndex = csvHeaders.indexOf(mapping.csvColumn);
          if (csvIndex !== -1) {
            let value: any = row[csvIndex];

            // Handle special column for propriedades (nome_cliente -> id_cliente)
            if (selectedTable === "propriedades" && mapping.dbColumn === "nome_cliente") {
              const clienteId = clientesByName[value?.toLowerCase().trim()];
              if (!clienteId) {
                errors.push(`Linha ${i + 2}: Cliente "${value}" não encontrado`);
                continue;
              }
              record["id_cliente"] = clienteId;
            } else {
              // Convert numeric fields
              if (["area_ha", "latitude", "longitude", "valor_sugerido", "idade"].includes(mapping.dbColumn)) {
                value = value ? parseFloat(value.replace(",", ".")) : null;
              }
              // Convert date fields
              if (mapping.dbColumn === "data_cadastro" && value) {
                // Try to parse date in various formats
                const dateValue = value.trim();
                if (dateValue) {
                  // Check if already in YYYY-MM-DD format
                  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                    value = dateValue;
                  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
                    // DD/MM/YYYY format
                    const [day, month, year] = dateValue.split('/');
                    value = `${year}-${month}-${day}`;
                  } else {
                    value = null;
                  }
                }
              }
              record[mapping.dbColumn] = value || null;
            }
          }
        }

        // Skip if we had a client linking error for propriedades
        if (selectedTable === "propriedades" && !record["id_cliente"] && columnMappings.find(m => m.dbColumn === "nome_cliente")) {
          continue;
        }

        // Insert record
        const { error } = await supabase
          .from(config.tableName as any)
          .insert([record as any]);

        if (error) {
          errors.push(`Linha ${i + 2}: ${error.message}`);
        } else {
          successCount++;
        }
      }

      setImportResult({ success: successCount, errors });
      setStep("result");
      
      if (successCount > 0) {
        onSuccess?.();
      }
    } catch (error: any) {
      toast.error(`Erro na importação: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const config = TABLE_CONFIG[selectedTable];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetState();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Dados CSV
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6 py-4">
          {step === "upload" && (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Dados</Label>
                  <Select
                    value={selectedTable}
                    onValueChange={(value) => {
                      setSelectedTable(value as TableType);
                      resetState();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clientes">Clientes</SelectItem>
                      <SelectItem value="propriedades">Propriedades</SelectItem>
                      <SelectItem value="tiposervico">Tipos de Serviço</SelectItem>
                      <SelectItem value="tipodespesa">Tipos de Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Colunas esperadas para {config.displayName}</AlertTitle>
                  <AlertDescription className="mt-2">
                    <TooltipProvider>
                      <div className="flex flex-wrap gap-2">
                        {config.columns.map((col) => (
                          <Tooltip key={col.name}>
                            <TooltipTrigger asChild>
                              <span
                                className={`px-2 py-1 rounded text-xs inline-flex items-center gap-1 cursor-help ${
                                  col.required
                                    ? "bg-destructive/10 text-destructive font-medium"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {col.label}
                                {col.description && <Info className="h-3 w-3 opacity-60" />}
                              </span>
                            </TooltipTrigger>
                            {col.description && (
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">{col.description}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        ))}
                      </div>
                    </TooltipProvider>
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="csv-upload">Arquivo CSV</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="cursor-pointer"
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById("csv-upload")?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Selecionar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formato: CSV (separado por vírgula ou ponto e vírgula) | Codificação: UTF-8
                  </p>
                </div>
              </div>
            </>
          )}

          {step === "mapping" && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Mapeamento de Colunas</AlertTitle>
                <AlertDescription>
                  Associe as colunas do seu CSV com os campos do banco de dados. As colunas marcadas com * são obrigatórias.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coluna do CSV</TableHead>
                      <TableHead>Campo no Sistema</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvHeaders.map((header) => (
                      <TableRow key={header}>
                        <TableCell className="font-medium">{header}</TableCell>
                        <TableCell>
                          <Select
                            value={columnMappings.find((m) => m.csvColumn === header)?.dbColumn || ""}
                            onValueChange={(value) => handleMappingChange(header, value)}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Não importar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Não importar</SelectItem>
                              {config.columns.map((col) => (
                                <SelectItem key={col.name} value={col.name}>
                                  {col.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="space-y-2">
                  <Label>Prévia dos Dados ({Math.min(5, csvData.length)} de {csvData.length} linhas)</Label>
                  <ScrollArea className="h-[200px] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {csvHeaders.map((header) => (
                            <TableHead key={header} className="whitespace-nowrap">
                              {header}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvData.slice(0, 5).map((row, i) => (
                          <TableRow key={i}>
                            {row.map((cell, j) => (
                              <TableCell key={j} className="max-w-[200px] truncate">
                                {cell}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </div>
            </>
          )}

          {step === "result" && importResult && (
            <div className="space-y-4">
              {importResult.success > 0 && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-600">Importação Concluída</AlertTitle>
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    {importResult.success} registro(s) importado(s) com sucesso.
                  </AlertDescription>
                </Alert>
              )}

              {importResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erros na Importação</AlertTitle>
                  <AlertDescription>
                    <ScrollArea className="h-[200px] mt-2">
                      <ul className="list-disc list-inside space-y-1">
                        {importResult.errors.map((error, i) => (
                          <li key={i} className="text-sm">{error}</li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
          
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Importar {csvData.length} Registro(s)
              </Button>
            </>
          )}

          {step === "result" && (
            <>
              <Button variant="outline" onClick={resetState}>
                Importar Outro
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
