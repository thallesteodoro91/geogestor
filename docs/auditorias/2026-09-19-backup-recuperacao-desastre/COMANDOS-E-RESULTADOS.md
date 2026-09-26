# Comandos e resultados

| Comando | Resultado |
|---|---|
| teste vermelho de autorização + retenção | 3 passaram, 2 falharam como esperado antes da correção |
| teste vermelho de completo sem raiz | 0/1; rejeição ausente reproduzida |
| integração final de backup/restauração | 1/1, 35,469 s |
| retenção final | 4/4, incluindo 25 versões |
| `pnpm run test:api` | 192/192, 112,310 s |
| `pnpm run test:web` | 202/202, 3,125 s |
| `pnpm run test:electron` equivalente | 18/18 |
| `pnpm run test:e2e -- backup-protection.spec.ts` | 5/5, 1,1 min; resíduos removidos pelo runner |
| `pnpm run typecheck` | aprovado |
| `pnpm run lint` | aprovado |
| `pnpm --filter api build` | aprovado; worker/API compilados |
| `git diff --check -- <arquivos auditados>` | aprovado; somente avisos de normalização LF/CRLF |

## Métricas emitidas pela integração final

`backup=2623.49ms`, `teste-isolado=4414.50ms`, `restauração-A=2867.71ms`, `restauração-B=10104.09ms`, `RPO-observado=8054ms`.

O teste completo da API foi repetido depois dos últimos ajustes de compatibilidade e dos acréscimos de cobertura.
