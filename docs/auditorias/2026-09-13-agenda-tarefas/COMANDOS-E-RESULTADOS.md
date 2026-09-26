# Comandos e resultados

Execução em `C:\Users\Thalles\Documents\Codex\2026-06-22\a\work\Geogestor`.

| Comando | Resultado final |
|---|---|
| `tsx --test --test-concurrency=1 --test-force-exit apps/api/src/session09-tasks.integration.test.ts` | 6/6 aprovados na verificação final, ~9,3 s |
| `tsx --test --test-concurrency=1 --test-force-exit apps/api/src/shared-records.integration.test.ts` | 1/1 aprovado, ~11,0 s |
| `pnpm run test:e2e -- tests/e2e/session09-tasks.spec.ts` | 4/4 aprovados, ~1,2 min |
| `pnpm run typecheck` | aprovado: web + API |
| `pnpm run lint` | aprovado: zero erro |
| `pnpm run test:web` | 182/182 aprovados |
| `pnpm run test:electron` | 18/18 aprovados |
| `pnpm run test:api` | 184/184 aprovados, ~133,6 s |
| `pnpm run build` | aprovado: contracts, database, API, web e instalador Windows 1.0.4 |
| `pnpm run release:smoke-package` | aprovado: abertura, bloqueio local, banco criptografado e ausência de segredo exposto |
| `git diff --check` nos arquivos versionados tocados | aprovado; apenas aviso informativo LF/CRLF do Windows |
| `Get-FileHash data/geogestor.db -Algorithm SHA256` | hash idêntico ao baseline |

## Ciclo vermelho → verde

O primeiro teste focado da API falhou 6/6 e comprovou: query permissiva, ausência de totais, vínculo inexistente levando a erro e payload de modelo aceitando campo extra. Após as correções, passou 6/6.

No E2E, as falhas intermediárias produziram evidência útil:

1. semântica ARIA de lista vazia e contrastes insuficientes;
2. tarefa criada ausente da primeira página por formato misto de timestamp;
3. expectativa aritmética incorreta no teste do progresso do projeto;
4. Axe executado durante a camada translúcida de uma animação.

Todos foram diferenciados entre defeito do produto e defeito do teste. A execução final, após o último ajuste de lint, passou 4/4 e removeu automaticamente o banco isolado da rodada aprovada.

## Banco real

| Propriedade | Valor |
|---|---|
| Caminho | `data/geogestor.db` |
| Tamanho | 1.990.656 bytes |
| Última alteração | 30/08/2026 14:12:58 |
| SHA-256 | `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471` |

Nenhum comando de teste apontou para esse banco.
