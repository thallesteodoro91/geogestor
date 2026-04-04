
## Plano: Design System com Componentes Reutilizáveis e Regras de Priorização

### Problema

Cada página reimplementa os mesmos padrões (header, filtros, KPIs, tabela com paginação, empty states) com variações inconsistentes: espaçamentos diferentes, headers com/sem ícone, filtros em Card ou soltos, KPIs com KPICard ou mini-cards manuais. Isso gera ~200 linhas repetidas por página.

### Solução: 4 Componentes de Layout Reutilizáveis

---

#### 1. `PageHeader` -- Cabecalho padronizado

```text
┌──────────────────────────────────────────────┐
│ Titulo (3xl bold)         [+ Novo Item]      │
│ Subtitulo (muted)                            │
└──────────────────────────────────────────────┘
```

Substitui os blocos de header repetidos em todas as 6 paginas. Garante consistencia de tipografia, espacamento e posicao do CTA.

---

#### 2. `FilterBar` -- Barra de filtros consistente

Wrapper que padroniza layout de filtros (Search + Select + DatePickers) em todas as paginas. Atualmente cada uma monta filtros de forma diferente.

---

#### 3. `ContextualKPIs` -- Mini-KPIs operacionais

Substitui os mini-cards manuais do Calendario e do Pulso Operacional no Dashboard. Recebe array de items e renderiza em grid compacto.

---

#### 4. `PageContent` -- Container de conteudo

Wrapper `Card > CardHeader > CardContent` que todas as tabelas usam. Elimina repeticao do mesmo padrao em Clientes, Servicos, Despesas.

---

### Regras de Priorizacao por Tipo de Tela

| Tipo de Tela | Hierarquia Visual (topo a base) |
|---|---|
| **Hub Analitico** (Dashboard 360, Financeiro) | Alertas - KPIs - Insights IA - Graficos - Narrativas |
| **Execucao com lista** (Clientes, Servicos, Despesas) | Header+CTA - KPIs contextuais (max 3) - Filtros - Tabela+Paginacao |
| **Execucao comercial** (Orcamentos) | Header+CTA - KPIs (max 2) - Filtros com periodo - Tabela |
| **Agenda** (Calendario) | Header+CTA - KPIs operacionais (max 3) - Filtros - Tabs de visualizacao |
| **Configuracao** (Cadastros) | Header - Tabs de entidades - Tabela por tab |

Regra geral: Paginas de execucao nunca tem mais de 3 KPIs contextuais. Graficos e insights IA ficam exclusivamente nos hubs analiticos.

---

### Refactor das Paginas

Cada pagina sera simplificada usando os novos componentes, reduzindo ~30% das linhas por pagina.

### Arquivos

| Acao | Arquivo |
|------|---------|
| Criar | `src/components/layout/PageHeader.tsx` |
| Criar | `src/components/layout/FilterBar.tsx` |
| Criar | `src/components/layout/ContextualKPIs.tsx` |
| Criar | `src/components/layout/PageContent.tsx` |
| Editar | `src/pages/Clientes.tsx` |
| Editar | `src/pages/Servicos.tsx` |
| Editar | `src/pages/Despesas.tsx` |
| Editar | `src/pages/ServicosOrcamentos.tsx` |
| Editar | `src/pages/Calendario.tsx` |
| Editar | `src/pages/GestaoEmpresa.tsx` |
| Editar | `src/pages/Cadastros.tsx` |

Nenhuma migracao de banco necessaria.
