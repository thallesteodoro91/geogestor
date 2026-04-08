

## Plano: Checklist de Projetos Evoluído para Ferramenta de Execução

### Diagnóstico

Existem dois sistemas de tarefas no SkyGeo com maturidades muito diferentes:

1. **`ClienteTarefas`** (tarefas de cliente) — Já maduro: prioridade (baixa/média/alta/urgente), categoria com ícones, data de vencimento, responsável, observações, edição inline, confirmação de exclusão, timeline de eventos. Usa tabela `cliente_tarefas` com 16 colunas.

2. **`TarefasList`** (tarefas de projeto) — Primitivo: apenas título + checkbox + deletar. Input de texto simples. Sem prioridade, sem prazo, sem responsável, sem categoria. Tabela `servico_tarefas` tem apenas 7 colunas (titulo, concluida, ordem).

O problema central é que as tarefas de projeto — que são as mais operacionais e críticas — são as mais pobres em funcionalidade.

### Mudanças

#### 1. Migration: Expandir tabela `servico_tarefas`

Adicionar colunas para paridade com `cliente_tarefas`:
- `prioridade` (text, default 'media') — baixa, media, alta, urgente
- `data_vencimento` (date, nullable)
- `responsavel` (text, nullable) — nome do responsável
- `categoria` (text, default 'geral')
- `observacoes` (text, nullable)

#### 2. Atualizar service (`servico-tarefas.service.ts`)

Expandir interface `ServicoTarefa` com os novos campos. Nenhuma mudança nas queries — já usam `select('*')`.

#### 3. Reescrever `TarefasList` como ferramenta de execução

Inspirado na `ClienteTarefas` já funcional:

- **Cada tarefa mostra:** checkbox + título + badge de prioridade (cor na borda esquerda) + badge de categoria + indicador de vencimento (ícone vermelho se atrasada, amarelo se próxima)
- **Adicionar tarefa:** Substituir input simples por um formulário inline expandível com campos: título (obrigatório), prioridade (select), data de vencimento (date picker), responsável (text)
- **Editar tarefa:** Dialog com todos os campos (como `EditarTarefaDialog` do cliente)
- **Confirmar exclusão:** AlertDialog antes de deletar (como `ClienteTarefas`)
- **Feedback visual:** Tarefas urgentes com `animate-pulse` na borda, concluídas com opacidade reduzida e line-through

#### 4. Sugestões automáticas de tarefas

Ao criar um projeto sem tarefas, exibir botão "Sugerir tarefas padrão" que adiciona uma lista predefinida baseada na categoria do serviço topográfico:
- **Georreferenciamento:** Levantamento de campo, Processamento de dados, Confecção de planta, Protocolo SIGEF, Certificação INCRA
- **Desmembramento:** Levantamento topográfico, Memorial descritivo, Aprovação prefeitura, Registro cartório
- **Geral (fallback):** Planejamento, Execução de campo, Processamento, Entrega ao cliente

Estas são inseridas em batch via `createTarefa` com ordem sequencial.

### Detalhes técnicos

- Reutilizar os mesmos padrões visuais de `ClienteTarefas` (categoriaConfig, prioridadeConfig, getVencimentoStatus)
- Extrair função `getVencimentoStatus` para um utilitário compartilhado se necessário
- O `ProjectProgressCard` existente já calcula progresso baseado em tarefas — continua funcionando sem mudanças

### Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Migration | `ALTER TABLE servico_tarefas ADD COLUMN prioridade, data_vencimento, responsavel, categoria, observacoes` |
| Editar | `src/modules/operations/services/servico-tarefas.service.ts` (expandir interface) |
| Reescrever | `src/components/servicos/TarefasList.tsx` (UI completa com prioridade, prazo, sugestões) |

Nenhum novo componente — reutiliza padrões existentes do `ClienteTarefas`.

