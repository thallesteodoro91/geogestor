# Comandos e resultados — Reauditoria da Sessão 06

## Ambiente

| Item | Resultado |
|---|---|
| Data/fuso | 14/09/2026; UTC−03:00 / `America/Sao_Paulo` |
| SO | Windows NT 10.0.26200.0 |
| Node / pnpm | v24.17.0 / 11.8.0 |
| GeoGestor | 1.0.4 |
| Branch / commit-base | `main` / `a16551a8b63e73f42d826297df893488e5ab88ca` |
| Banco real | 1.990.656 bytes; SHA-256 `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471` antes/depois |

## Testes e verificações

| Comando/campanha | Resultado |
|---|---|
| `pnpm --filter api exec node --import tsx --test src/session06-environmental.integration.test.ts` | 1/1 aprovado; ~21,2 s |
| `node apps/api/node_modules/tsx/dist/cli.mjs --test ...environmentalCalculation.test.ts ...laudoPdfGenerator.test.ts` | 8/8 aprovados; 157,5757 ms |
| E2E com `GEOGESTOR_S06_PREFIX=QA-AUDIT-S06-20260914-` | primeira rodada 4/5 por falso positivo Axe durante saída do modal; rodada final 5/5 em ~1,1 min |
| `pnpm --filter api test` | 185/185 aprovados; 0 falhas; 120.458,393 ms |
| `pnpm --filter web test` | 192/192 aprovados; 0 falhas; 2.429,2381 ms |
| `pnpm test:electron` | 18/18 aprovados; 0 falhas; 207,4819 ms |
| `pnpm typecheck` | web/API aprovados; exit 0 |
| `pnpm lint` | aprovado; exit 0 |
| `git diff --check` | exit 0; somente avisos de normalização LF/CRLF existentes |
| `pnpm build` no sandbox | bloqueado por `Access is denied` do esbuild; não contou como falha do produto |
| `pnpm build` fora do sandbox | aprovado; contratos, banco, API, web, Electron, NSIS e blockmap |
| `pnpm release:smoke-package` | aprovado |

Duas tentativas de invocação do teste focado web também foram descartadas como erro do auditor: `node --import tsx` não encontrou `tsx` no filtro web, e `pnpm --filter api exec tsx` não encontrou o binário. A invocação direta do CLI instalado executou os oito testes com sucesso.

## Pacote

| Artefato | Valor |
|---|---|
| Caminho | `apps/desktop/dist/GeoGestor Setup 1.0.4.exe` |
| Tamanho | 89.964.915 bytes |
| Modificação | 14/09/2026 19:46:27 −03:00 |
| SHA-256 | `68B56170E47923D1ABA28C6492793F4EDC4B510E0BE96FA98744881E83BD455E` |

## PDFs

`pdfinfo` confirmou quatro documentos A4, PDF 1.3, uma página, não criptografados e sem tags. `pypdf` extraiu entre 639 e 657 caracteres por arquivo, incluindo títulos, empreendimento, cliente e data; a ausência de tags foi registrada como melhoria, não como reprovação funcional.

## Limpeza

Foram validados como descendentes de `scratch` e removidos com caminho literal:

- `scratch/QA-AUDIT-S06-20260914-1938-baseline` — 1 arquivo, 1.990.656 bytes;
- `scratch/session06-environmental-35292` — 5 arquivos, 1.636.829 bytes;
- `scratch/commercial-e2e/run-1789425456125-33540-37ce54b3-fa4a-404a-ab88-e54097c22057` — 120 arquivos, 13.753.440 bytes.
- `scratch/QA-AUDIT-S06-20260914-pdf-render` — quatro PNGs temporários usados na inspeção visual dos laudos.

Resultado final: `RemainingCurrentSession=0`. Diretórios antigos de outras campanhas foram preservados.
