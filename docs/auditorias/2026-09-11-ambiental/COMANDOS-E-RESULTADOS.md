# Comandos e resultados — Sessão 06: Ambiental

## Ambiente

| Item | Resultado |
|---|---|
| Data/fuso | 11/09/2026; `(UTC-03:00) Brasília` / `America/Sao_Paulo` |
| SO | Microsoft Windows NT 10.0.26200.0 |
| Node | v24.17.0 |
| pnpm | 11.8.0 |
| GeoGestor | 1.0.4 no pacote raiz e desktop |
| Branch / commit inicial | `main` / `a16551a8b63e73f42d826297df893488e5ab88ca` |
| Worktree | já estava sujo por sessões anteriores; preservado |

## Testes dirigidos por falha

| Comando / campanha | Resultado |
|---|---|
| API focada S06, primeira execução | **RED:** 1 falha; tarefa sem prazo ocultou a ação atrasada |
| API focada S06 após correção | **1/1 aprovado**, aproximadamente 9,2 s |
| Unitários CAR + PDF | **8/8 aprovados**, 274,6 ms |
| E2E S06, iterações intermediárias | reproduziu seletor responsivo, deep link antes do render, contraste 2,56:1, click target do checkbox e alimentou o ajuste da expectativa de auditoria |
| `pnpm test:e2e -- tests/e2e/session06-environmental.spec.ts` final | **5/5 aprovados**, 1,2 min |

O E2E final executou configuração inicial isolada, vazio/erro/recuperação, seed, demandas, fases, andamento, quatro downloads PDF, licenças, filtros de prazo, status legado, deep link, cumprimento de condicionante, CAR, persistência e auditoria. O runner removeu automaticamente o diretório da execução aprovada.

## Regressão e qualidade

| Comando | Resultado exato |
|---|---|
| `pnpm --filter api test` | **163 testes, 163 aprovados, 0 falhas**, 172.793,2833 ms |
| `pnpm --filter web test` | **179 testes, 179 aprovados, 0 falhas**, 3.074,719 ms |
| `pnpm test:electron` | **18 testes, 18 aprovados, 0 falhas**, 221,7589 ms |
| `pnpm lint` | aprovado, exit code 0 |
| `pnpm typecheck` | web e API aprovados, exit code 0 |
| `git diff --check` | aprovado; somente avisos preexistentes de conversão LF/CRLF |
| `pnpm build` | aprovado; web, API e Electron empacotados; NSIS e blockmap gerados |
| `pnpm release:smoke-package`, primeira execução | falhou porque o consumidor esperava array bruto em `/api/audit-logs`, hoje paginado |
| `pnpm release:smoke-package`, após correção | **aprovado**: início sem senha, ativação/remoção do bloqueio, banco criptografado e nenhum segredo exposto |

## Instalador reconstruído

| Artefato | Valor |
|---|---|
| Caminho | `apps/desktop/dist/GeoGestor Setup 1.0.4.exe` |
| Tamanho | 89.958.435 bytes |
| Modificação | 11/09/2026 22:21:05 −03:00 |
| SHA-256 | `BC91B86E37F1D989831CD9AD6A0B9CF40B46982A491CC9D06A00AAC5DE57C56B` |

## Banco real protegido

| Momento | Tamanho | Modificação | SHA-256 |
|---|---:|---|---|
| Antes | 1.990.656 bytes | 30/08/2026 14:12:58 −03:00 | `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471` |
| Depois | 1.990.656 bytes | 30/08/2026 14:12:58 −03:00 | `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471` |

## Evidências preservadas

| Arquivo | Tamanho |
|---|---:|
| `01-estado-vazio-recuperado.png` | 102.305 bytes |
| `02-demanda-historico-e-prazos.png` | 195.460 bytes |
| `03-licencas-fronteira-30-dias.png` | 164.589 bytes |
| `04-condicionante-link-profundo.png` | 169.824 bytes |
| `05-car-mobile-validacao.png` | 148.802 bytes |
| `laudo-vistoria.pdf` | 22.659 bytes |
| `laudo-fauna.pdf` | 22.857 bytes |
| `laudo-flora.pdf` | 22.706 bytes |
| `laudo-outros.pdf` | 22.627 bytes |

## Limpeza

Foram removidos somente os artefatos temporários identificados desta campanha: quatro diretórios `scratch/session06-environmental-*` e onze execuções falhas `scratch/commercial-e2e/run-*`, totalizando 15 diretórios. A verificação final retornou `RemainingSession06=0` e `RemainingRunsToday=0`. Diretórios antigos e alterações de terceiros foram preservados.
