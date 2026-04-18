
The user wants a post-import validation system that compares spreadsheet input vs database output, detects discrepancies (missing values, duplicates, sum mismatches), and reports back with actionable explanations.

Looking at current code: SmartImporter already has `debugStats` tracking (rows processed, revenues classified, expenses classified) and a "Before/After KPIs" comparison. What's missing:
1. Pre-import baseline of the SPREADSHEET itself (sum of all monetary cells, count of rows with financial data)
2. Post-import database verification (query what was actually inserted in this batch)
3. Reconciliation panel comparing spreadsheet totals vs database totals
4. Duplicate detection (clients/properties created with same name)
5. Clear "100% consistent" or "discrepancy of R$ X" verdict

Scope: enhance SmartImporter only. No DB migration needed.

## Plano: Sistema de Validação Pós-Importação

### O que existe hoje
- `debugStats` rastreia linhas processadas e valores classificados durante a importação
- Comparação Before/After de KPIs gerais (mas pega TODO o tenant, não só o que foi importado)

### O que falta (núcleo do plano)

**1. Snapshot da planilha ANTES de importar** (`spreadsheetSummary`)
Calcular antes de chamar `handleImport`:
- Total de linhas com dado financeiro (qualquer valor > 0)
- Soma de receitas detectadas (campos: receita_esperada, valor_unitario × quantidade, valor_total, faturamento)
- Soma de despesas detectadas (custo_servico, valor_da_despesa)
- Soma total monetária (receitas + despesas)
- Contagem de clientes únicos (por nome normalizado)
- Contagem de propriedades únicas (por nome+cliente)

**2. Snapshot do banco APÓS importar** (`databaseSummary`)
Após `handleImport` concluir, query direta filtrando pelos IDs criados nesta sessão:
```sql
SELECT 
  COUNT(*) as orcamentos_criados,
  SUM(receita_esperada) as receita_total
FROM fato_orcamento WHERE id_orcamento IN (...ids criados...)
```
Mesmo para `fato_despesas` e `fato_servico`. Guardar arrays de IDs criados em cada step do pipeline.

**3. Painel de Reconciliação** (novo step `validation` antes de `result`)
Tabela visual com 3 colunas: Métrica | Planilha | Sistema | Status

| Métrica | Planilha | Sistema | Status |
|---|---|---|---|
| Linhas processadas | 73 | 73 | ✓ |
| Receita total | R$ 145.000 | R$ 145.000 | ✓ |
| Despesas total | R$ 38.500 | R$ 38.500 | ✓ |
| Clientes criados | 73 únicos | 73 | ✓ |
| Propriedades | 73 | 73 | ✓ |

Tolerância: diferença ≤ R$ 0,01 = ✓ (arredondamento). Diferença maior = ⚠ com valor exato.

**4. Detecção de duplicatas**
Query pós-importação:
```sql
SELECT nome, COUNT(*) FROM dim_cliente 
WHERE tenant_id = X 
GROUP BY nome HAVING COUNT(*) > 1
```
Mostrar lista se houver, com sugestão "Considere mesclar manualmente".

**5. Veredicto Final** (no topo do painel)
- **Tudo bate**: badge verde grande "✓ Os dados importados estão 100% consistentes com a planilha"
- **Diferença detectada**: badge âmbar "⚠ Diferença de R$ X detectada — veja detalhes abaixo" + lista de causas prováveis (linhas descartadas por validação, valores em formato não reconhecido, duplicatas mescladas)

**6. Explicação de erros**
Para cada linha descartada (já temos `debugStats.linhasDescartadas`), mostrar a razão exata e sugestão:
- "Linha 47: sem cliente nem propriedade → adicione coluna 'Nome' ou 'Propriedade'"
- "Linha 89: valor R$ ABC não numérico → verifique formatação de célula"

### Detalhes técnicos

Arquivo único a editar: **`src/components/import/SmartImporter.tsx`**

Mudanças:
- Adicionar função `calculateSpreadsheetSummary(rawData, mappings)` chamada no step `preview` antes de `handleImport`
- No `handleImport`, capturar `id_orcamento`, `id_despesas`, `id_servico` retornados de cada INSERT em arrays
- Após pipeline, fazer queries de reconciliação no Supabase com os IDs capturados
- Criar novo state `validationReport` com os summaries e o veredicto
- Adicionar novo step `validation` no enum `Step` (entre `importing` e `result`)
- Renderizar painel de reconciliação com tabela comparativa, lista de duplicatas e veredicto

Sem migrações. Sem mudanças em outros arquivos.

### Princípio de confiança garantida
Toda importação termina com UM número claro: "Diferença = R$ 0,00" ou "Diferença = R$ X". O usuário sabe exatamente se pode confiar nos KPIs.
