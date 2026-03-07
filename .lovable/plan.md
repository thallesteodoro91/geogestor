

# Refatorar Relatório Executivo -- Design Editorial Profissional

## Problema
O relatório atual usa o mesmo visual do dashboard (cards flutuantes, fundo escuro, cores vibrantes) e não tem aparência profissional para impressão/PDF.

## Solução

### 1. Novo componente `PrintableReport.tsx`
Componente separado, renderizado dentro da página, com estilo editorial print-first:
- **Fundo branco forçado**, texto preto/cinza escuro (`#1a1a1a`, `#4b5563`)
- Font sans-serif limpa (Inter, já instalada)
- Sem cards flutuantes -- seções lineares separadas por `border-b` sutis
- Cabeçalho: nome da empresa à esquerda, "Relatório Mensal de Gestão" + período à direita
- **Sumário Executivo da IA** logo após os KPIs, em caixa com `border-l-4` e fundo `#f9fafb`
- KPIs em linha horizontal com separadores verticais (não cards)
- Tabelas com cabeçalhos `bg-gray-100` e linhas zebradas (`even:bg-gray-50`)
- Mensagem elegante para seções vazias: *"Não houve movimentação nesta categoria no período."*

### 2. Cores dos gráficos sóbrias para documento
- Barras: azul marinho `#1e3a5f` (entradas) e cinza `#9ca3af` (saídas)
- Donut: paleta sóbria (azul marinho, slate, teal, amber escuro)
- Remover `CartesianGrid`, manter apenas eixos limpos
- Legendas com fonte legível

### 3. CSS de impressão refinado
Atualizar `@media print` no `index.css`:
- Forçar fundo branco em tudo, sem sombras
- `page-break-inside: avoid` nas seções
- Ocultar toda UI (sidebar, header, controles)
- Garantir que o `PrintableReport` ocupe 100% da área

### 4. Fluxo de exportação
Manter `window.print()` (sem dependência extra). O componente `PrintableReport` já terá estilo editorial que funciona tanto na tela quanto impresso. A página `RelatorioExecutivo.tsx` mantém os controles (seletor de mês, filtro de datas) separados do conteúdo imprimível.

### Arquivos alterados
- **Criar**: `src/components/relatorio/PrintableReport.tsx` -- componente editorial
- **Editar**: `src/pages/RelatorioExecutivo.tsx` -- usar PrintableReport para o conteúdo do relatório
- **Editar**: `src/index.css` -- refinar print styles

