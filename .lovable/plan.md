

## Plano: Importação com Interpretação Financeira Completa

### Diagnóstico

O SmartImporter já possui boa mecânica de importação por entidade (clientes, orçamentos, despesas, serviços), mas o problema real é: **o usuário importa UMA planilha genérica com dados mistos** (clientes + valores + datas) e o sistema trata como uma única entidade. O resultado é que valores monetários entram como texto em campos de cliente, ou orçamentos são criados sem `id_cliente` (campo obrigatório na view de KPIs que calcula receita).

Causas raiz específicas dos KPIs zerados:
1. **`fato_orcamento.receita_esperada`** é o campo que alimenta `receita_total` na view `vw_kpis_financeiros`. Se o orçamento não tem `id_cliente` (obrigatório no schema), o INSERT falha silenciosamente via RLS.
2. **Orçamentos importados sem `id_cliente`**: O auto-link só funciona se a planilha tem coluna de cliente E o campo está mapeado. Se o usuário importa apenas valores, não há vínculo.
3. **Despesas sem `id_tipodespesa`**: Classificação FIXA/VARIAVEL não funciona, então custos variáveis ficam zerados.
4. **Sem painel pós-importação**: O usuário não vê se os dados realmente alimentaram os KPIs.

### Mudanças

#### 1. Tela de resultado com painel de verificação financeira

Após importação bem-sucedida, adicionar um card de "Verificação Financeira" que consulta os KPIs em tempo real e mostra:
- Receita Total atualizada
- Total de Despesas atualizada  
- Lucro Líquido
- Comparação "antes vs depois" (usando snapshot pré-importação)

Se KPIs continuam zerados após importar, mostrar alerta: "⚠ Os valores importados ainda não estão refletidos nos KPIs. Possíveis causas: orçamentos sem cliente vinculado, despesas sem categoria."

#### 2. Fallback inteligente para `id_cliente` em orçamentos

Se `entityType === "orcamentos"` e nenhum `id_cliente` foi vinculado (nem por mapeamento nem por auto-link):
- Buscar empresa principal do tenant (`dim_empresa`)
- Criar um cliente genérico "Cliente Importação" (se não existir)
- Vincular todos os orçamentos sem cliente a esse cliente
- Mostrar warning: "X orçamentos vinculados ao cliente 'Cliente Importação'. Edite-os para associar ao cliente correto."

Isso garante que o INSERT não falhe por falta de `id_cliente` (campo NOT NULL no schema).

#### 3. Auto-classificação de despesas sem tipo

Se `entityType === "despesas"` e registros ficam sem `id_tipodespesa`:
- Buscar se existe tipo "Sem classificação" no tenant
- Se não existir, criar automaticamente com classificação "VARIAVEL"
- Vincular despesas órfãs a esse tipo
- Warning: "X despesas classificadas como 'Sem classificação'. Edite-as em Cadastros > Tipos de Despesa."

#### 4. Snapshot de KPIs pré-importação

Antes de iniciar a importação (`handleImport`), capturar os KPIs atuais via `supabase.rpc('calcular_kpis_v2')`. Após a importação, refetch e comparar. Mostrar delta no painel de resultado.

#### 5. Importação de planilha genérica com detecção multi-entidade

Quando o auto-detect tem confiança < 40% e a planilha tem colunas de valor + nome:
- Mostrar prompt de classificação: "Detectamos valores monetários. Como classificar?"
  - ( ) Receita (criará orçamentos)
  - ( ) Despesa (criará despesas)
  - ( ) Ignorar valores
- Usar a resposta para criar a entidade correta automaticamente

#### 6. Garantir invalidação de cache com delay

Após importação, adicionar `await queryClient.invalidateQueries()` com `refetchType: 'all'` para forçar refresh imediato dos KPIs na tela.

### Detalhes técnicos

- Snapshot KPI: `useState<KPIData | null>(null)` capturado no início do `handleImport`
- Fallback cliente: query `dim_cliente` por nome "Cliente Importação", upsert se não existir
- Fallback tipo despesa: query `dim_tipodespesa` por categoria "Sem classificação", upsert se não existir
- Painel verificação: componente inline no step "result", usa `useKPIs()` hook com `refetchInterval: 2000` temporário
- Prompt classificação: radio group no step "mapping" quando confidence < 40%

### Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/import/SmartImporter.tsx` (fallbacks, painel verificação, prompt classificação) |

Nenhuma migração necessária — todas as tabelas e colunas já existem.

