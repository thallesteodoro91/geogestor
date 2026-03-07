

# Relatório Executivo Mensal (PDF) -- Plano de Implementação

## Visão Geral

Criar uma nova página `/relatorio-executivo` com layout otimizado para impressão (A4), que consolida dados financeiros mensais, gráficos Recharts e tabelas detalhadas, com botão de exportação via `window.print()` e sumário executivo gerado por IA.

## Arquitetura

```text
Nova página: src/pages/RelatorioExecutivo.tsx
  ├── Hook: src/hooks/useRelatorioData.ts (busca dados do mês)
  ├── Componentes visuais (Recharts) renderizados inline
  ├── Tabelas de clientes, serviços e orçamentos
  ├── Sumário executivo via edge function ai-insights
  └── Botão "Exportar PDF" → window.print()
```

## Etapas

### 1. Criar hook `useRelatorioData`
- Recebe mês/ano como parâmetros
- Usa `useDashboardMetrics` com `dataInicio`/`dataFim` do mês selecionado
- Busca adicionalmente:
  - Novos clientes do período (`dim_cliente` filtrado por `data_cadastro`)
  - Serviços com maior custo (`fato_servico` ordenado por `custo_servico DESC`)
  - Orçamentos pendentes (`fato_orcamento` com `situacao_do_pagamento = 'Pendente'`)
  - Dados semanais de receita/despesa (agrupa por semana do mês)
  - Receita por categoria de serviço (`fato_servico` agrupado por `categoria`)
- Calcula variação percentual vs mês anterior

### 2. Criar página `RelatorioExecutivo.tsx`
- **Cabeçalho**: Logo da empresa (de `dim_empresa`), nome da empresa, período do relatório
- **KPIs principais**: Total Faturado, Total Gasto, Lucro Líquido, Margem de Lucro, Taxa de Conversão
- **Gráfico de Barras** (Recharts): Comparativo semanal Entradas vs Saídas (4-5 semanas)
- **Gráfico Donut** (Recharts): Distribuição de receita por tipo de serviço
- **Tabela Novos Clientes**: Nome, data cadastro, telefone/email
- **Tabela Serviços com Maior Custo**: Nome, receita, custo, margem
- **Tabela Orçamentos Pendentes**: Código, cliente, valor, data faturamento
- **Sumário Executivo**: Texto gerado via IA (reutiliza a edge function `ai-insights` existente com prompt adaptado para relatório mensal)
- Seletor de mês/ano no topo (oculto na impressão)
- Botão "Exportar PDF" (oculto na impressão)

### 3. Estilização para impressão
- Usar classes Tailwind `print:hidden` nos controles (sidebar, header, botões)
- `@media print` no CSS global para forçar layout A4, margens, quebras de página (`page-break-before`, `page-break-inside: avoid`)
- Background branco forçado, cores visíveis na impressão

### 4. Integrar na navegação
- Adicionar rota `/relatorio-executivo` no `App.tsx` (protegida)
- Adicionar link no Sidebar na seção "Visão" com ícone `FileText`

### 5. Exportação PDF
- Usar `window.print()` com CSS `@media print` configurado -- abordagem mais leve, sem dependências extras
- Gráficos Recharts renderizam como SVG, compatíveis com impressão nativa

## Detalhes Técnicos

- **Dados semanais**: Processamento client-side agrupando registros do mês por número da semana (`getWeek` do date-fns)
- **Sumário IA**: Chamada à edge function existente `ai-insights` passando contexto do mês específico; texto exibido em card dedicado
- **Sem novas tabelas/migrações**: Todos os dados já existem nas tabelas `fato_orcamento`, `fato_despesas`, `fato_servico`, `dim_cliente`
- **Print CSS**: Adicionado em `src/index.css` com regras `@media print` para ocultar sidebar/header e ajustar layout

