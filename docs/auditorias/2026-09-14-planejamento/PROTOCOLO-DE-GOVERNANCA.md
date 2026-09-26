# Protocolo de governança

## Sequência comprovada

| Marco | Estado controlado | Persistência esperada | Evidência |
|---|---|---|---|
| G-01 | Ciclo 2026 ativo; objetivo em andamento; KR manual 50%; fontes sem dados | Snapshot ao vivo com automáticos `null` | Integração: progresso manual 50 e fontes indisponíveis |
| G-02 | Revisão 30/07, atenção, confiança média, decisão pendente e próxima revisão 15/08 | Um check-in, um snapshot e no máximo uma decisão legada; ciclo atualizado | Contagens 1/1/1 e tendência indisponível |
| G-03 | Fixtures das fontes com data 15/07 | Valores 60/50/50/50; quatro stale mensais | Snapshot recalculado sem PATCH nos KRs automáticos |
| G-04 | Decisão concluída com nota | `status=concluida`, `concluidaEm` definido, pendentes 0 | PATCH sem nota foi 400; com nota foi 200 |
| G-05 | Objetivo/KR/iniciativa/risco alterados; narrativa da revisão 1 editada | Snapshot 1 imutável | `objetivosJson` e `progressoGeral` idênticos antes/depois |
| G-06 | Revisão 15/08, no rumo, confiança alta, próxima revisão 15/09 | Segundo snapshot e tendência 30/07→15/08 | `tendencias.disponivel=true` e datas exatas |
| G-07 | Decisão reaberta em andamento | `concluidaEm=null`; volta a pendente | Resumo retorna 1 pendente |
| G-08 | Revisão 30/07 excluída | Snapshot 1 soft-deletado; decisão preservada sem check-in | SQLite confirmou `deletedAt` e `checkinId=null` |

## Regras observadas

- Revisão com `proximaRevisao` anterior à própria data é rejeitada pelo contrato.
- O snapshot pertence a um check-in e não é uma projeção do estado ao vivo depois da captura.
- Tendência exige dois snapshots e ordena por `capturadoEm`, depois `createdAt`, depois `id`.
- A linha do tempo usa apenas eventos previstos, ordena por data/tipo/ID, limita o backend a 30 e a tela a 8.
- Concluir decisão exige `observacaoEncerramento`; reabrir limpa o momento de conclusão.
- Risco de outro ciclo não pode ser associado ao objetivo/iniciativa atual.

## Atomicidade e falha

A criação de ciclo foi executada com falha deliberada do audit log. A API respondeu 500 com mensagem genérica, não incluiu a expressão secreta do erro e a consulta por nome retornou zero linhas. Isso comprova rollback da mutação auditada. A criação de check-in, snapshot, decisão legada e atualização de próxima revisão foi reunida em uma transação.

## Limites da prova

A campanha confirmou disponibilidade básica da tendência e imutabilidade entre dois snapshots. Não executou todas as transições possíveis de objetivos, iniciativas, decisões e riscos, nem JSON inválido legado. Esses cenários constam como bloqueados na matriz.
