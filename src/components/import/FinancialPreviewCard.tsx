import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Sparkles } from "lucide-react";
import type { ClassifiedColumn } from "@/lib/financialColumnClassifier";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

interface Props {
  receita: number;
  custo: number;
  despesa: number;
  rowsWithFinancial: number;
  totalRows: number;
  classified: ClassifiedColumn[];
  uniqueClientes: number;
  uniquePropriedades: number;
}

export function FinancialPreviewCard({
  receita, custo, despesa, rowsWithFinancial, totalRows,
  classified, uniqueClientes, uniquePropriedades,
}: Props) {
  const totalSaidas = custo + despesa;
  const lucro = receita - totalSaidas;
  const margem = receita > 0 ? (lucro / receita) * 100 : 0;
  const lucroIgualReceita = receita > 0 && totalSaidas === 0;

  const detected = classified.filter(c => c.role !== "ignorar");

  return (
    <div className="space-y-4">
      <Alert className="border-primary/30 bg-primary/5">
        <Sparkles className="h-4 w-4 text-primary" />
        <AlertTitle>Identificamos seus dados financeiros</AlertTitle>
        <AlertDescription>
          Reconhecemos {detected.length} coluna(s) e {rowsWithFinancial} de {totalRows} linha(s) com valores monetários.
          Estruturamos automaticamente clientes, propriedades, projetos, orçamentos e despesas.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Receita reconhecida
          </div>
          <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{fmt(receita)}</div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5 text-rose-500" /> Custos + Despesas
          </div>
          <div className="text-lg font-semibold text-rose-600 dark:text-rose-400">{fmt(totalSaidas)}</div>
          <div className="text-xs text-muted-foreground">
            Custo de obra: {fmt(custo)} · Despesa op.: {fmt(despesa)}
          </div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5 text-primary" /> Lucro calculado
          </div>
          <div className="text-lg font-semibold">{fmt(lucro)}</div>
          <div className="text-xs text-muted-foreground">Margem: {margem.toFixed(1)}%</div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="text-xs text-muted-foreground">Estrutura criada</div>
          <div className="text-sm font-medium">
            {uniqueClientes} cliente(s)<br />
            {uniquePropriedades} propriedade(s)
          </div>
        </Card>
      </div>

      {lucroIgualReceita && (
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Atenção: Lucro igual à receita</AlertTitle>
          <AlertDescription>
            Não detectamos custos ou despesas na planilha. O lucro será calculado igual à receita —
            o que normalmente indica que falta uma coluna de "Custo" ou "Despesa" no mapeamento.
            Volte ao passo anterior e mapeie a coluna correspondente, se existir.
          </AlertDescription>
        </Alert>
      )}

      {detected.length > 0 && (
        <Card className="p-4">
          <div className="text-xs font-medium text-muted-foreground mb-2">Colunas interpretadas</div>
          <div className="flex flex-wrap gap-1.5">
            {detected.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs"
                title={`Confiança: ${c.confidence}%`}
              >
                <span className="font-medium">{c.header}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-primary">{roleLabel(c.role)}</span>
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function roleLabel(r: string): string {
  const map: Record<string, string> = {
    receita_bruta: "Receita",
    receita_liquida: "Receita Líquida",
    valor_orcado: "Valor Orçado",
    custo_obra: "Custo de Obra",
    despesa_operacional: "Despesa Operacional",
    imposto: "Imposto",
    lucro_informado: "Lucro (informado)",
    margem_informada: "Margem (informada)",
    pipeline: "Pipeline",
    data_orcamento: "Data Orçamento",
    data_despesa: "Data Despesa",
    cliente_nome: "Cliente",
    propriedade_nome: "Propriedade",
    municipio: "Município",
    servico_nome: "Serviço/Projeto",
    categoria_despesa: "Categoria",
  };
  return map[r] ?? r;
}
