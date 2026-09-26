# Achados e correções

## Defeitos corrigidos

| ID | Sev. | Defeito e risco | Causa raiz | Correção | Reteste |
|---|---:|---|---|---|---|
| S08-001 | P1 | API aceitava datas/horas/tipos inválidos, texto vazio e campos extras. | Contrato permissivo sem schema estrito. | Schemas Zod estritos, data civil real, `HH:MM`, limites e PATCH não vazio. | Integração dedicada e API integral. |
| S08-002 | P1 | Cliente removido, projeto removido ou cliente divergente do projeto podiam ser vinculados. | Ausência de resolução transacional de referências. | Resolução ativa de cliente/projeto e cliente derivado do projeto, com recusa de conflito. | Casos válidos, removidos e cruzados. |
| S08-003 | P1 | Compromissos com hora eram enviados ao Google como dia inteiro e `dateTime` remoto podia cair no dia civil errado. | Mapeamento reduzia tudo a `date`; importação cortava a string em `T`. | Mapper civil dedicado em `America/Sao_Paulo`, fim exclusivo e duração de 1h. | 00:00, 23:59, bissexto e offsets UTC. |
| S08-004 | P2 | `JOIN` de cliente por `clienteId OR projeto.clienteId` podia duplicar e mostrar contexto inconsistente. | Junção ambígua. | `COALESCE` com precedência do cliente do projeto e exclusões lógicas. | Consulta com vínculo direto + projeto sem duplicidade. |
| S08-005 | P2 | As três fontes tinham limite silencioso de 500. | Limite fixo herdado de listagens. | Remoção do limite nos endpoints de calendário. | Intervalo com 505 compromissos, incluindo 501 de volume. |
| S08-006 | P2 | Detalhe de tarefa carregava lista limitada e procurava por ID no cliente. | Reuso indevido do endpoint de coleção. | `GET /api/tarefas/:id` e detalhe direto com contexto. | Tarefa válida/removida e rota profunda. |
| S08-007 | P2 | Tipo de detalhe desconhecido era tratado como compromisso. | `else` genérico. | Lista fechada de tipos e estado “Evento não encontrado”. | Rota adulterada dedicada. |
| S08-008 | P2 | Empates não tinham ordem total e requisições antigas podiam sobreviver à troca rápida de mês. | Comparador parcial e ausência de `AbortSignal`. | Desempate tipo/título/ID e sinal propagado às três fontes. | Ordem 00:00/09:00/23:59/dia inteiro e navegação rápida. |
| S08-009 | P2 | URL inválida persistia e Voltar/Avançar não representava mês/dia. | Toda escrita usava `replace` e estado/URL disputavam entre si. | Canonicalização sem disputa; navegação temporal usa `push`, filtros usam `replace`. | URL adulterada, PageUp, Voltar e retorno. |
| S08-010 | P2 | Voltar do detalhe descartava mês e dia selecionados. | Link fixo para `/calendario`. | Estado de retorno interno validado e preservado. | Detalhe → voltar mantém 29/02/2024. |
| S08-011 | P2 | Em 1120 px a coluna lateral estreitava a grade e causava sobreposição. | Breakpoint de quatro colunas em `lg`. | Divisão adiada para `xl`; em larguras médias os blocos empilham. | Captura 1120 px e inspeção visual. |
| S08-012 | P2 | Scheduler tentava sincronizar sem integração ativa; update local não atualizava o marco de sync. | Ausência de gate e persistência incompleta. | `isSyncEnabled`, gate no scheduler/sync e atualização de `ultimoSyncGoogle`. | Testes locais e revisão do fluxo. |

## Comportamentos deliberados, não chamados de correção perfeita

- “Desfazer” recria o compromisso via POST e gera novo ID. O teste confirma isso expressamente.
- Projeto e tarefa são origens derivadas: a Agenda não oferece exclusão direta para esses eventos.
- Quando uma das três fontes falha, a tela mostra o erro e mantém as fontes válidas; não apresenta o conjunto parcial como completo.
- O botão “Adicionar ao Google Agenda” apenas monta uma URL de template e não representa sincronização OAuth.

## Melhorias não bloqueantes e dívida

| ID | Prioridade | Melhoria |
|---|---:|---|
| S08-M01 | P1 | Definir e implementar política de conflito bidirecional por `updated`/`etag`, tombstone e autoria. |
| S08-M02 | P1 | Criar restauração real que preserve ID e `googleEventId`, ou remover “Desfazer” para itens sincronizados. |
| S08-M03 | P2 | Expor resultado por item/etapa na sincronização parcial em vez de apenas contadores. |
| S08-M04 | P2 | Paginar/virtualizar a agenda diária para dezenas de itens no mesmo dia. |
| S08-M05 | P2 | Executar matriz manual com leitor de tela, 200%, alto contraste e dispositivos físicos. |

