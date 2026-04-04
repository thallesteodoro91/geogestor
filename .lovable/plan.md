

## Plano: Padronizacao Global de Empty States

### Diagnostico

O sistema possui 3 categorias de empty states:

1. **Ja usa `EmptyState` component** (3 telas): Clientes, Servicos, Despesas — bom, mas textos podem melhorar
2. **Empty state manual inline** (8+ locais): ServicosOrcamentos, Orcamentos, Calendario (semanal/diario/tabela), ClienteServicos, ClienteOrcamentos, ClientePropriedades, ClienteTimeline, ClienteTarefas — inconsistentes, sem CTA
3. **Mensagens genericas** (10+ locais): "Nenhum encontrado" em filtros, charts, dashboards — sem orientacao

### Solucao

Usar o componente `EmptyState` existente em todos os locais que hoje tem empty states manuais. Para estados de filtro vazio (quando ha dados mas filtro nao retorna), usar um componente leve padronizado.

---

### Mudancas por arquivo

#### Paginas principais (usar `EmptyState` component)

**`src/pages/ServicosOrcamentos.tsx`** — Substituir empty state inline (linhas 228-236) por `EmptyState` com icon=FileText, titulo="Comece criando seu primeiro orcamento", descricao="Envie propostas comerciais para seus clientes e acompanhe conversoes e pagamentos.", CTA="+ Criar Orcamento", tip="Importe orcamentos de planilhas para agilizar"

**`src/pages/Orcamentos.tsx`** — Substituir "Nenhum orcamento encontrado" (linha 455) por `EmptyState` similar

#### Subcomponentes de Cliente

**`src/components/cliente/ClienteServicos.tsx`** — Substituir empty state manual por `EmptyState` com icon=Wrench, titulo="Nenhum servico vinculado", descricao="Crie um servico para este cliente e acompanhe prazos e execucao.", CTA="+ Criar Servico"

**`src/components/cliente/ClienteOrcamentos.tsx`** — Substituir por `EmptyState` com icon=FileText, titulo="Nenhum orcamento emitido", descricao="Crie um orcamento para formalizar propostas e acompanhar pagamentos.", CTA="+ Criar Orcamento"

**`src/components/cliente/ClientePropriedades.tsx`** — Substituir por `EmptyState` com descricao melhorada

**`src/components/cliente/ClienteTimeline.tsx`** — Ja tem CTA, melhorar titulo/descricao

**`src/components/cliente/ClienteTarefas.tsx`** — Ja tem CTA, melhorar titulo/descricao

#### Calendario

**`src/components/calendario/CalendarioSemanal.tsx`** — Substituir texto generico por card com icone e orientacao
**`src/components/calendario/CalendarioDiario.tsx`** — Mesmo tratamento
**`src/components/calendario/CalendarioTabela.tsx`** — Mesmo tratamento

#### Melhorar textos existentes

**`src/pages/Clientes.tsx`** — Atualizar titulo para "Organize sua base de clientes", descricao mais orientadora
**`src/pages/Servicos.tsx`** — Atualizar titulo para "Crie seu primeiro servico"
**`src/pages/Despesas.tsx`** — Atualizar titulo para "Controle seus custos"

#### Filtro vazio padronizado

Criar `src/components/ui/filter-empty-state.tsx` — componente leve para quando filtros nao retornam resultados: icone Search, "Nenhum resultado para os filtros aplicados", sugestao "Tente termos diferentes ou limpe os filtros", botao "Limpar filtros". Substituir todas as mensagens genericas de filtro por este componente.

---

### Microcopy completa

| Modulo | Titulo | Descricao | CTA | Tip |
|--------|--------|-----------|-----|-----|
| Clientes | Organize sua base de clientes | Cadastre clientes para gerar servicos, orcamentos e acompanhar receita por projeto. | + Novo Cliente | Importe clientes de uma planilha para comecar rapido |
| Servicos | Crie seu primeiro servico | Registre servicos para acompanhar prazos, equipe e o progresso de cada projeto. | + Criar Servico | Vincule a clientes e orcamentos para gestao completa |
| Despesas | Controle seus custos | Registre despesas para entender sua margem de lucro real e tomar decisoes melhores. | + Registrar Despesa | Vincule a servicos para rastrear custos por projeto |
| Orcamentos | Envie sua primeira proposta | Crie orcamentos profissionais e acompanhe aprovacoes e pagamentos dos clientes. | + Criar Orcamento | Importe orcamentos de planilhas para agilizar |
| Calendario (vazio) | Sua agenda esta livre | Crie servicos ou orcamentos com datas para ve-los aqui automaticamente. | + Novo Compromisso | — |
| Cliente > Servicos | Este cliente ainda nao tem servicos | Crie um servico vinculado para acompanhar a execucao dos projetos deste cliente. | + Criar Servico | — |
| Cliente > Orcamentos | Nenhum orcamento emitido | Formalize propostas comerciais e acompanhe pagamentos deste cliente. | + Criar Orcamento | — |
| Cliente > Propriedades | Nenhuma propriedade vinculada | Cadastre propriedades para visualizar areas no mapa e vincular a servicos. | + Adicionar Propriedade | — |
| Cliente > Timeline | Nenhum evento registrado | Registre eventos para manter o historico completo de interacoes com este cliente. | + Adicionar Evento | — |
| Cliente > Tarefas | Nenhuma tarefa pendente | Crie tarefas para organizar o acompanhamento deste cliente. | + Nova Tarefa | — |

---

### Arquivos

| Acao | Arquivo |
|------|---------|
| Criar | `src/components/ui/filter-empty-state.tsx` |
| Editar | `src/pages/Clientes.tsx` |
| Editar | `src/pages/Servicos.tsx` |
| Editar | `src/pages/Despesas.tsx` |
| Editar | `src/pages/ServicosOrcamentos.tsx` |
| Editar | `src/pages/Orcamentos.tsx` |
| Editar | `src/components/cliente/ClienteServicos.tsx` |
| Editar | `src/components/cliente/ClienteOrcamentos.tsx` |
| Editar | `src/components/cliente/ClientePropriedades.tsx` |
| Editar | `src/components/cliente/ClienteTimeline.tsx` |
| Editar | `src/components/cliente/ClienteTarefas.tsx` |
| Editar | `src/components/calendario/CalendarioSemanal.tsx` |
| Editar | `src/components/calendario/CalendarioDiario.tsx` |
| Editar | `src/components/calendario/CalendarioTabela.tsx` |

Nenhuma migracao de banco necessaria.

