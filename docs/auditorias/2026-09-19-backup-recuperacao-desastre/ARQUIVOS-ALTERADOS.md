# Arquivos alterados pela auditoria

| Arquivo | Motivo |
|---|---|
| `apps/api/src/services/backup.service.ts` | completude da raiz, inventário estrito, fingerprint, retenção por tamanho real e preservação de inválidos |
| `apps/api/src/services/restore-authorization.service.ts` | ligar nonce testado ao fingerprint do bundle |
| `apps/api/src/server.ts` | transportar/verificar fingerprint até o worker gerenciado |
| `apps/api/src/backup-restore.integration.test.ts` | regressões, criação database-only e métricas A/B |
| `apps/api/src/restore-authorization.test.ts` | troca do bundle depois do teste |
| `apps/api/src/backup-retention.test.ts` | tamanho real, 25 versões e inválidos preservados |
| `docs/auditorias/2026-09-19-backup-recuperacao-desastre/*` | dossiê desta auditoria |

O diff global contém muitas alterações preexistentes de outras sessões. Esta relação não atribui essas mudanças à auditoria atual.
