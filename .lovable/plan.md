## Padronização de Módulos — Plano de Implementação

### Diagnóstico dos Problemas Atuais

| Módulo | Problema Principal |
|--------|--------------------|
| **Clientes** | É um dashboard de analytics (Pareto, LTV, gráficos) — **não tem lista de clientes nem CRUD**. A gestão real está em Cadastros. Função confusa. |
| **Serviços** | Bom, mas KPIs redundantes com Dashboard 360 (Total, Concluídos, Em Andamento, Média Progresso) |
| **Orçamentos** | KPIs redundantes. Tem `DespesasPendentes` que não pertence aqui. Código de serviços não utilizado. |
| **Despesas** | Treemap + GlobalFilters + TimeGranularityControl = complexidade excessiva para tela de execução. 3 KPIs redundantes. |
| **Cadastros** | Título "Base de Dados" é confuso. Sem EmptyState padronizado. |
| **Calendário** | KPIs financeiros (Valor Total, Orçamentos) não pertencem aqui. |

---

### 1. CLIENTES E PROJETOS → Gestão de Relacionamento

**Transformação:** De dashboard analítico → Lista de clientes com CRUD e visão de relacionamento.

**Estrutura nova:**
```
Header: "Clientes e Projetos" + "Gerencie seus clientes e acompanhe projetos"
CTA: [+ Novo Cliente]
─────────────────────────────
Busca + Filtros (situação, cidade)
─────────────────────────────
Tabela de clientes:
  Nome | CPF/CNPJ | Contato | Propriedades | Serviços Ativos | Situação | Ações
  Ações: Ver detalhes | Editar | Novo Serviço | Excluir
─────────────────────────────
EmptyState: "Cadastre seu primeiro cliente para organizar projetos e faturamento"
```

**O que REMOVE:** Todos os gráficos (Pareto, LTV, Rentabilidade), KPIs analíticos, StoryCards. Essas análises pertencem ao Dashboard Financeiro ou a uma aba futura de "Análise de Clientes".

**O que ADICIONA:** Lista real de clientes com CRUD (reutilizando dados que hoje estão só em Cadastros), contagem de serviços ativos por cliente, ações rápidas visíveis.

---

### 2. SERVIÇOS → Execução Operacional

**Mudanças:**
- **Remover KPIs** "Total de Serviços" e "Média de Progresso" (já estão no Dashboard 360 como Pulso Operacional)
- **Manter apenas 2 KPIs contextuais:** "Em Andamento" e "Atrasados" (data_fim < hoje e não concluído)
- Header: subtítulo de "Acompanhe o andamento de todos os serviços" → "Gerencie a execução dos seus serviços"
- **Adicionar EmptyState** padronizado usando componente `EmptyState`

---

### 3. ORÇAMENTOS → Conversão Comercial

**Mudanças:**
- **Remover `DespesasPendentes`** (pertence à tela Despesas)
- **Reduzir KPIs de 4 → 2:** Manter "Total de Orçamentos" e "Taxa de Conversão". Remover "Receita Orçada" e "Ticket Médio" (pertencem ao Dashboard Financeiro)
- **Adicionar EmptyState** padronizado
- Header já está bom

---

### 4. DESPESAS → Controle de Custos

**Mudanças:**
- **Remover Treemap** (visualização analítica → pertence ao Dashboard Financeiro)
- **Remover GlobalFilters e TimeGranularityControl** (complexidade excessiva para execução)
- **Reduzir KPIs de 3 → 1:** Manter apenas "Total do Mês" como contexto rápido
- **Adicionar filtros simples:** Busca + Select de categoria + Filtro de data (igual ao padrão Serviços)
- **Mover CTA para o header** (hoje está dentro do CardHeader da tabela)
- **Adicionar EmptyState** padronizado

---

### 5. CADASTROS → Configuração do Sistema

**Mudanças:**
- **Título:** "Base de Dados" → "Cadastros"
- **Subtítulo:** → "Configure os dados base do sistema: clientes, tipos de serviço e categorias de despesa"
- **Adicionar EmptyState** por aba quando vazia

---

### 6. CALENDÁRIO → Agenda Operacional

**Mudanças:**
- **Remover KPIs financeiros** (Orçamentos, Valor Total) — não pertencem à agenda
- **Manter apenas 2 KPIs contextuais:** "Compromissos Hoje" e "Próximos 7 dias"
- Já está bem estruturado no resto

---

### Resumo de Arquivos

| Ação | Arquivo |
|------|---------|
| Reescrever | `src/pages/Clientes.tsx` (de analytics → lista CRUD) |
| Editar | `src/pages/Servicos.tsx` (reduzir KPIs, EmptyState) |
| Editar | `src/pages/ServicosOrcamentos.tsx` (remover DespesasPendentes, reduzir KPIs, EmptyState) |
| Editar | `src/pages/Despesas.tsx` (remover Treemap/GlobalFilters, simplificar) |
| Editar | `src/pages/Cadastros.tsx` (renomear, EmptyStates) |
| Editar | `src/pages/Calendario.tsx` (trocar KPIs) |

**Nenhum componente novo necessário** — usa `EmptyState` existente em todas as telas.
**Nenhuma migração de banco necessária.**
