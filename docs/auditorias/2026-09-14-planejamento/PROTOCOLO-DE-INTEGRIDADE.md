# Protocolo de integridade

## Banco e migrações

- Runtime schema: versão 15.
- Migrações estratégicas: `packages/database/drizzle/0010_strategic_planning.sql` e `packages/database/drizzle/0011_strategic_governance.sql`.
- `PRAGMA foreign_keys`: `1`, afirmado dentro do teste de integração que usa o SQLite descartável migrado.
- Foreign keys físicas continuam úteis, mas nenhuma conclusão sobre soft delete foi derivada delas.
- Inventário: nove tabelas (`ciclos`, `pilares`, `objetivos`, `resultados`, `iniciativas`, `check-ins`, `riscos`, `decisões` e `snapshots`) e 19 índices estratégicos nas duas migrações. As FKs declaram `CASCADE`, `RESTRICT` ou `SET NULL` conforme a relação física.

## Relações e política de exclusão lógica

| Entidade excluída | Dependência | Política aplicada | Prova desta campanha |
|---|---|---|---|
| Ciclo | pilares, objetivos, KRs, iniciativas, check-ins, snapshots, decisões, riscos | `deletedAt` explícito em toda a árvore, na mesma transação | Ciclo 2027, pilar e objetivo consultados com `deletedAt` |
| Pilar | objetivos ativos | bloqueio com quantidade e exemplo sanitizado | 400: um objetivo ativo, com título sintético |
| Objetivo | KRs e iniciativas | soft delete | implementação revisada; caminho integral não executado |
| Objetivo | riscos, check-ins e decisões | preservar histórico e definir `objetivoId=null` | implementação revisada; caminho integral não executado |
| Iniciativa | risco | definir `iniciativaId=null` | confirmado em SQLite |
| Check-in | snapshot | soft delete do snapshot | confirmado em SQLite |
| Check-in | decisão | preservar decisão e definir `checkinId=null` | confirmado em SQLite |
| KR | agregados | soft delete e recálculo na próxima leitura | implementação revisada; exclusão direta não executada |
| Decisão | timeline/resumo | soft delete | implementação revisada; exclusão direta não executada |
| Risco | resumo/exceções | soft delete | implementação revisada; exclusão direta não executada |

## Regras referenciais comprovadas

- Objetivo e pilar devem pertencer ao mesmo ciclo.
- Resultado-chave exige objetivo ativo.
- Iniciativa exige objetivo ativo.
- Risco, objetivo e iniciativa associados devem pertencer ao mesmo ciclo; a iniciativa deve pertencer ao objetivo quando ambos são informados.
- Check-in e objetivo opcional devem pertencer ao mesmo ciclo.
- Projeto/tarefa soft-deletado não aparece como vínculo ativo no snapshot.
- Metadados derivados de uma fonte automática não são controlados pelo cliente.

## Transações

| Operação | Fronteira |
|---|---|
| Ativação de ciclo | alteração do ciclo alvo e passagem dos demais ativos para `em_revisao`, mais auditoria |
| Criação de revisão | check-in + snapshot + decisão legada opcional + próxima revisão + auditoria |
| Exclusão de ciclo/objetivo/iniciativa/check-in | dependências, desvinculações e auditoria |
| Leitura de snapshot | uma read transaction para o conjunto coerente |

Uma falha injetada no registro de auditoria de ciclo resultou em rollback completo. A API retornou `500` com `Não foi possível concluir a operação estratégica. Tente novamente.` e não expôs `segredo interno da auditoria`.

## Auditoria observada

Consultas a `audit_logs` confirmaram ao menos:

- `INSERT` de `Ciclo Estratégico`;
- `INSERT` de `Resultado-chave`;
- `UPDATE` de `Decisão Estratégica`.

A Sessão 14 deverá verificar exaustivamente antes/depois, todos os oito CRUDs e conteúdo sensível. Nesta sessão, o objetivo foi validar atomicidade e presença dos eventos sintéticos ligados ao Planejamento.

## Dados reais e limpeza

| Caminho | Antes/depois | SHA-256 |
|---|---|---|
| `data/geogestor.db` | 1.990.656 bytes; `LastWriteTime` inalterado | `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471` |
| `%APPDATA%/geogestor-desktop/geogestor.db` | 1.163.264 bytes; `LastWriteTime` inalterado | `D4B4169A496501DD3A28746AD49792DB5CFA00CF7D096AB8744B4EE0229CF4DA` |

O harness de integração agora aguarda `client.close()` e remove todo o diretório do processo no `finally`; o reteste confirmou que `scratch/strategic-planning-29968` não existia após a saída. Antes da correção, WALs/logs tinham deixado diretórios numerados: 145 alvos `strategic-planning-<PID>` foram resolvidos, validados como filhos diretos de `scratch` e removidos; contagem posterior zero. O harness E2E removeu `scratch/run-1789508256577-24396-1cb0e9f0-bd22-4534-ad84-b5ca96ad6698`. A cópia temporária `scratch/qa-audit-s12-baseline-20260914` foi removida somente depois da igualdade dos hashes (`StillExists: False`). Resíduo em bases reais: **zero**.

Foram preservados por serem preexistentes e datados de 30–31/07/2026: `scratch/strategic-visual.db*`, `strategic-api.*.log`, `strategic-web.*.log`, `validate-strategic-polish.mjs` e `validate-strategic-ui.mjs`.

## Pontos não comprovados

- Interleaving de dois processos ativando ciclos ou gravando check-ins.
- Lock SQLite e leitura durante escrita em processo separado.
- Upgrade/reinício do aplicativo instalado mantendo a mesma base.
- Varredura tabela a tabela após cada uma das oito exclusões por API e UI.

Esses itens estão `BLOQUEADO`; não foram inferidos a partir do código.
