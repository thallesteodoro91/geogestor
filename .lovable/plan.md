

## Plano: Progresso Inteligente com Contexto e Ações

### Diagnóstico

O progresso atual é uma barra simples (`Progress value={servico.progresso}`) com um número `%`. Não comunica:
- Se o projeto está atrasado ou no prazo
- Quantas tarefas foram feitas vs total
- Previsão de conclusão
- Qual a próxima ação

O cálculo já é baseado em tarefas (`calcularProgressoServico`), mas a UI não mostra isso.

### Mudanças

#### 1. Criar componente `ProjectProgressCard`

Novo componente que substitui o Card de progresso simples em `ServicoDetalhes.tsx`. Exibe:

**Barra segmentada com contexto:**
- Barra de progresso com cor dinâmica (verde = no prazo, amarelo = atenção, vermelho = atrasado)
- `3 de 8 tarefas concluídas (37%)`

**Indicador de prazo:**
- Calcula dias restantes vs % concluído
- "No prazo — faltam 12 dias" (verde)
- "Atenção — 60% do prazo usado, 30% concluído" (amarelo)  
- "Atrasado — prazo venceu há 3 dias" (vermelho)

**Previsão de conclusão:**
- Baseada na velocidade média de conclusão de tarefas (tarefas/dia desde o início)
- "Previsão: 15 de maio" ou "Sem dados suficientes"

**Próxima ação sugerida:**
- Se 0 tarefas: "Adicione tarefas para acompanhar o progresso"
- Se atrasado: "Priorize as tarefas pendentes para recuperar o prazo"
- Se no prazo: "Continue no ritmo atual — próxima tarefa pendente"
- Se concluído: "Projeto finalizado! Atualize o status para Concluído"

#### 2. Melhorar barra no Kanban

No `KanbanBoard.tsx`, a barra de 1.5px ganha cor contextual (verde/amarelo/vermelho) baseada no prazo, usando a mesma lógica.

#### 3. Passar dados de tarefas para o card

Em `ServicoDetalhes.tsx`, buscar tarefas no nível da página (já faz via `TarefasList`) e passar contagem para o `ProjectProgressCard`.

### Detalhes técnicos

- Lógica de "atrasado": `data_do_servico_fim < hoje && progresso < 100`
- Lógica de "atenção": `% tempo decorrido > % progresso + 20pp`
- Velocidade: `tarefas_concluidas / dias_desde_inicio`
- Previsão: `hoje + (tarefas_pendentes / velocidade_diaria)`

### Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/components/servicos/ProjectProgressCard.tsx` |
| Editar | `src/pages/ServicoDetalhes.tsx` (substituir card de progresso) |
| Editar | `src/components/servicos/KanbanBoard.tsx` (cor contextual na barra) |
| Editar | `src/components/servicos/index.ts` (exportar novo componente) |

Nenhuma migração de banco necessária.

