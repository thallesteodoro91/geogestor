# Achados — Sessão 09

Todos os achados abaixo foram corrigidos e retestados. A severidade registra o risco original.

| ID | Sev. | Achado e impacto | Evidência antes | Correção | Reteste |
|---|---:|---|---|---|---|
| S09-F01 | P1 | Listagem legada e consumidores podiam truncar tarefas silenciosamente em 50/100; progresso de projeto ficava incorreto. | Teste vermelho com 101 tarefas. | Modo legado sem limite oculto; modo paginado com totais e `statusTotals`; projeto usa total global. | API focada, E2E 101+ e projeto 33/102. |
| S09-F02 | P1 | Aplicação de modelo lia e gravava partes fora da mesma transação; falha intermediária podia deixar tarefas sem aplicação/auditoria correspondente. | Inspeção do fluxo e fronteiras de transação. | Projeto, modelo, deduplicação, tarefas, auditorias, aplicação e jornada no mesmo `db.transaction`. | Teste de aplicação, histórico, idempotência e suíte transacional global. |
| S09-F03 | P1 | Resposta antiga de busca ou falha antiga de status podia sobrescrever uma ação mais recente. | Revisão do estado assíncrono. | Contadores de versão por listagem e por tarefa. | E2E com falha PATCH controlada, rollback e nova transição bem-sucedida. |
| S09-F04 | P2 | Busca visual prometia tarefa, mas o backend pesquisava menos campos e dependia de acentos. | Testes vermelhos por descrição/projeto/cliente. | Texto pesquisável composto e normalizado. | API e E2E por “memorial descritivo” e “sao jose”. |
| S09-F05 | P2 | Query aceitava página/limite fracionários, datas impossíveis, intervalos invertidos, enum inválido e campos extras. | 200 indevido no teste vermelho. | Schemas Zod estritos e datas civis reais. | Casos negativos retornam 400. |
| S09-F06 | P2 | Tarefa direta com cliente inexistente causava erro interno/registro inconsistente. | Teste vermelho recebeu 500. | `resolveClientProjectLink` na criação e edição. | Cliente/projeto inexistente, inativo ou cruzado retornam 400/404 sem escrita. |
| S09-F07 | P2 | PATCH vazio gerava atualização/auditoria sem mudança semântica. | Contrato permissivo. | PATCH exige ao menos um campo e rejeita extras. | 400 no teste focado. |
| S09-F08 | P2 | A tela confundia carregamento, erro, coleção vazia e filtro sem resultado. | Inspeção visual/código. | Estados distintos, retry e preservação de dados anteriores em falha. | E2E e Axe. |
| S09-F09 | P2 | Deep link podia ficar oculto por filtros, alterar a busca para o título e remover o parâmetro antes de foco perceptível. | Fluxo anterior e regressão de 101+. | Busca dedicada por ID, filtros ignorados, foco no cartão, destaque de 2,4 s e canonicalização posterior. | E2E em tarefa da segunda página. |
| S09-F10 | P2 | Status/prioridade legados desapareciam ou eram apresentados como se fossem válidos. | Massa com `Aguardando terceiro`/`Urgente`. | Coluna neutra de recuperação em “A Fazer”, badges e alerta global. | E2E + Axe. |
| S09-F11 | P2 | Fonte de alertas possuía limite fixo de 500 tarefas, permitindo omissão silenciosa. | Inspeção do serviço. | Remoção do teto e ordenação estável por prazo/ID. | Suíte API e integração alerta/tarefa. |
| S09-F12 | P2 | Formulários perdiam rascunho no Escape/fechamento; edição intacta também alertava; vínculo direto era ambíguo. | Jornada exploratória/código. | Dirty-check por snapshot, `beforeunload`, confirmação somente quando necessário e aviso de vínculo direto. | E2E cancelar/confirmar e editar sem alteração. |
| S09-F13 | P2 | Semântica de lista vazia e contrastes 4,47:1/4,39:1 falhavam no Axe; atraso dependia excessivamente de cor. | Duas execuções vermelhas do Axe. | `section`/`group`/`article`, tons mais escuros, texto “Atrasada” e foco visível. | Axe integral nas três jornadas: zero violações. |
| S09-F14 | P2 | Timestamps mistos (`YYYY-MM-DD HH…` e ISO com `T`) colocavam tarefa recém-criada depois de registros antigos. | E2E mostrou 104 totais, mas novo cartão ausente da página 1. | Criação manual e por modelo grava `createdAt/updatedAt` em ISO. | CRUD E2E encontra a tarefa imediatamente. |
| S09-F15 | P2 | Filtro somente com data final incluía tarefas sem prazo, porque texto vazio é lexicograficamente menor que uma data. | Revisão do predicado e teste de fronteira. | Intervalo exige `dataLimite` não nula e não vazia antes de aplicar `gte/lte`. | Teste focado confirma 102 datadas e exclui o status legado sem prazo. |

## Observações de regressão

O teste `shared-records.integration.test.ts` inseria cliente sintético sem `situacao`. Com a validação correta de cliente ativo, essa massa passou a falhar. O fixture foi corrigido para `situacao: 'Ativo'`; o contrato de produção não foi relaxado.
