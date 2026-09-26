# Comandos e resultados — Sessão 07: Financeiro

## Ambiente

| Item | Resultado |
|---|---|
| Data/fuso | 12/09/2026; `America/Sao_Paulo` |
| SO | Microsoft Windows NT 10.0.26200.0 |
| Node | v24.17.0 |
| pnpm | 11.8.0 |
| GeoGestor | 1.0.4 |
| Branch / commit inicial | `main` / `a16551a8b63e73f42d826297df893488e5ab88ca` |
| Worktree | previamente sujo; preservado |

## Campanhas dirigidas por falha

| Campanha | Resultado |
|---|---|
| API financeira inicial | RED para datas inexistentes, vínculo removido e filtro Vencida |
| API financeira final + atomicidade de auditoria | **7/7 aprovados** |
| Web financeira inicial | RED para semântica/navegação de abas |
| Web financeira final | **10/10 aprovados** |
| E2E intermediário | Axe detectou foco em região oculta e contraste de 3,76:1 |
| `pnpm test:e2e -- tests/e2e/session07-finance.spec.ts` final | **4/4 aprovados**, 52,7 s; perfil descartável removido |

## Regressão e qualidade

| Comando | Resultado final |
|---|---|
| `pnpm test:api` | **169 testes, 169 aprovados, 0 falhas**, 175.100,0149 ms |
| `pnpm test:web` | **182 testes, 182 aprovados, 0 falhas**, 2,79 s |
| `pnpm test:electron` | **18 testes, 18 aprovados, 0 falhas** |
| `pnpm lint` | aprovado, exit code 0 |
| `pnpm typecheck` | web e API aprovados, exit code 0 |
| `git diff --check` | aprovado; somente avisos de conversão LF/CRLF |
| `pnpm desktop:build` | contratos, banco, API, web e Electron aprovados; NSIS e blockmap gerados |
| `pnpm release:smoke-package` | aprovado: inicialização, ativação/bloqueio, banco criptografado e ausência de segredos |

Uma primeira regressão completa teve 168/169 porque o endurecimento inicial exigia UUID de um identificador legado válido. A compatibilidade foi corrigida, os testes focados passaram e a regressão completa final fechou 169/169.

## Instalador reconstruído

| Artefato | Valor |
|---|---|
| Caminho | `apps/desktop/dist/GeoGestor Setup 1.0.4.exe` |
| Tamanho | 89.959.799 bytes |
| Modificação | 12/09/2026 16:51:07 −03:00 |
| SHA-256 | `480E1057CD1100BEA47D7290317721835D0B179113C3F9610AF34AD210304057` |
| Blockmap | 94.873 bytes |

## Banco real protegido

| Momento | Tamanho | Modificação | SHA-256 |
|---|---:|---|---|
| Antes | 1.990.656 bytes | 30/08/2026 14:12:58 −03:00 | `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471` |
| Depois | 1.990.656 bytes | 30/08/2026 14:12:58 −03:00 | `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471` |

## Evidências preservadas

| Arquivo | Tamanho |
|---|---:|
| `01-visao-geral-reconciliada.png` | 374.817 bytes |
| `02-contas-e-recuperacao.png` | 331.026 bytes |
| `03-auxiliares-mobile-escuro.png` | 140.190 bytes |
| `fluxo-caixa.csv` | 391 bytes |
| `reconciliacao-api.json` | 8.159 bytes |

Todos os arquivos preservados usam exclusivamente entidades sintéticas. O runner removeu as execuções E2E aprovadas automaticamente. Também foram conferidos pelos manifestos e removidos quatro runs E2E falhos da S07, um banco da integração S07 e nove diretórios `finance-overview`/`financeiro-reports` criados nesta campanha: **14 diretórios descartáveis removidos**. A verificação final retornou zero diretório S07, zero run E2E da S07 e zero diretório financeiro criado em 12/09/2026. Resíduos antigos de outras datas foram preservados.
