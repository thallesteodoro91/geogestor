

## Plano: Importação Financeiramente Inteligente

### Diagnóstico

Após auditoria do fluxo completo (SmartImporter → batch services → KPI view), identifiquei 3 causas raiz:

1. **Orçamentos sem `receita_esperada`**: O campo `valor_unitario` é mapeado corretamente, mas `receita_esperada` (que alimenta `receita_total` nos KPIs) não é calculado automaticamente. O campo existe no formulário de importação mas é opcional — se o usuário não mapear, fica `null` e o KPI mostra R$ 0.

2. **Despesas sem `id_tipodespesa`**: Sem vínculo ao tipo de despesa, a classificação FIXA/VARIAVEL não funciona. Custos variáveis ficam zerados nos KPIs.

3. **Sem preview financeiro**: O usuário não vê o impacto dos dados importados antes de confirmar.

### Mudanças

#### 1. Auto-cálculo de campos derivados no `handleImport`

Antes de enviar os records para o batch service, calcular automaticamente:

**Orçamentos:**
- `receita_esperada = (valor_unitario * quantidade) - desconto` (se não mapeado explicitamente)
- `quantidade = 1` (se não mapeado — já existe)
- `desconto = 0` (se não mapeado)

**Serviços:**
- Se `receita_servico` não foi mapeado mas existe coluna de valor, usar como receita

#### 2. Vinculação inteligente de despesas a tipos existentes

No `handleImport`, antes do batch insert:
- Buscar `dim_tipodespesa` do tenant
- Se a planilha tem coluna mapeada como "categoria" ou "tipo", tentar match por nome com os tipos existentes
- Se encontrou match → setar `id_tipodespesa` automaticamente
- Se não encontrou → importar sem vínculo (comportamento atual) mas mostrar warning

Adicionar campo opcional nos `DESPESA_FIELDS`:
- `categoria_despesa` (key: `_categoria_lookup`, label: "Categoria/Tipo de Despesa") — usado apenas para lookup, não inserido diretamente

#### 3. Preview financeiro antes da importação

Na tela de preview (step "preview"), adicionar um card de resumo financeiro acima da tabela:

```text
┌─────────────────────────────────────────────────┐
│ 📊 Impacto Financeiro Estimado                  │
│                                                  │
│  Receita:  R$ 150.000,00  (12 orçamentos)       │
│  Despesas: R$ 45.000,00   (28 registros)        │
│  Lucro:    R$ 105.000,00                        │
│                                                  │
│  ⚠ 3 despesas sem categoria (serão importadas   │
│    como "Sem classificação")                     │
└─────────────────────────────────────────────────┘
```

Calculado a partir dos dados validados:
- Orçamentos: soma de `receita_esperada` (calculada ou mapeada)
- Despesas: soma de `valor_da_despesa`
- Serviços: soma de `receita_servico`

#### 4. Sinônimos financeiros expandidos

Adicionar sinônimos para melhor detecção de colunas de valor:

**Orçamentos:**
- `receita_esperada`: adicionar "faturamento", "valortotalservico", "amount", "revenue", "precoservico", "valorcontrato"
- `valor_unitario`: adicionar "valorha", "valorhectare", "precoha"

**Despesas:**
- `valor_da_despesa`: adicionar "amount", "expense", "pagamento", "valorpago", "despesa"
- Novo campo lookup: `_categoria_lookup` com sinônimos "categoria", "tipo", "classificacao", "natureza", "grupo"

**Serviços:**
- `receita_servico`: adicionar "valorservico", "amount", "revenue", "valorcontrato", "total"

#### 5. Invalidação de cache financeiro após importação

No `handleImport`, após sucesso, invalidar queries financeiras:
```typescript
["kpis", "dashboard-metrics", "financial-data", "chart-data"].forEach(key => 
  queryClient.invalidateQueries({ queryKey: [key] })
);
```

### Detalhes técnicos

- Auto-cálculo no `handleImport`: após montar `record`, verificar se `entityType === "orcamentos"` e calcular `receita_esperada` se ausente
- Lookup de `id_tipodespesa`: query única antes do batch, criar mapa `nome_normalizado → id`
- Preview financeiro: componente inline no step "preview", calcula soma dos campos numéricos validados
- Nenhuma migração necessária — todas as colunas já existem no banco

### Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/import/SmartImporter.tsx` (auto-cálculo, preview financeiro, sinônimos, cache) |

