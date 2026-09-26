# Comandos, ferramentas e resultados

## Ambiente

| Item | Resultado |
|---|---|
| Commit/branch | `a16551a8b63e73f42d826297df893488e5ab88ca`, `main`, 2 commits à frente do upstream na linha de base |
| Worktree | Já estava suja; 234 entradas no `git status --porcelain` ao fechamento. Alterações alheias foram preservadas |
| SO | Microsoft Windows NT 10.0.26200.0 |
| Locale/fuso | `pt-BR`; `(UTC-03:00) Brasília` / America/Sao_Paulo |
| E2E visual | Microsoft Edge, viewport 1120×680, tema claro, zoom 100%, `reducedMotion: reduce`; rede local ativa e tiles externos abortados no caso offline |
| SRC inicial | SIRGAS 2000 / UTM 22S, EPSG:31982 |
| Node/pnpm | Node 24.17.0; pnpm 11.8.0 |
| Produto | GeoGestor 1.0.4; React 19.2.6; Vite resolvido 8.0.16; Electron 35.7.5 |
| Geo/PDF produção | Leaflet 1.9.4; proj4 2.21.0; geographiclib-geodesic 2.2.0; pdfmake 0.3.11 |
| API/dados | Fastify 5.8.5; Drizzle 0.45.2; libSQL client 0.6.2 |
| Oráculos | Python 3.12.14; pyproj 3.7.2/PROJ 9.5.1; GeographicLib 2.1; Shapely 2.1.2; pypdf 6.0.0; pypdfium2 4.30.0 |

## Execuções finais

| Comando | Resultado exato |
|---|---|
| `pnpm test:web` | **192 testes, 192 passaram, 0 falharam**, 1.917,8326 ms |
| `pnpm test:api` | **185 testes, 185 passaram, 0 falharam**, 116.504,1099 ms |
| `pnpm test:electron` | **18 testes, 18 passaram, 0 falharam**, 344,5707 ms |
| `pnpm typecheck` | exit 0; web `tsc -b` e API `tsc --noEmit` |
| `pnpm lint` | exit 0; ESLint web sem achados |
| `pnpm test:e2e -- tests/e2e/session10-topography.spec.ts` | **4/4 passaram** (setup + 3 cenários da sessão), 56,9 s; Axe 0 violações nos estados auditados |
| `pnpm run build` | exit 0; contracts, database, API, web e desktop/NSIS; Vite 6.069 módulos, 2,83 s; instalador GeoGestor 1.0.4 gerado |
| `pnpm release:smoke-package` | exit 0; pacote abriu, bloqueio local funcionou, banco permaneceu criptografado e segredos não vazaram |
| `pnpm benchmark:geospatial` | 1.000 features, 500.000 vértices, 88,94 ms, delta aproximado de heap 37.589.016 bytes; exibição limitada a 2.000 vértices |
| `py -3.12 scripts/session10-oracles.py` | Oráculos independentes gerados; versões e CRS registrados |
| `pnpm --filter web exec tsx scripts/session10-compare.ts` | **37/37 valores dentro das tolerâncias**; quatro amostras estruturais geradas |
| `py -3.12 scripts/session10-validate-artifacts.py` | **10/10 arquivos/verificações aprovados**; PDF 2/2 páginas renderizadas |

## Ciclo vermelho–verde

- Primeira execução focada: 188 testes web, **180 passaram e 8 falharam**, comprovando contratos quebrados em GMS, geometria/exportação, metadados, importação e borda UTM.
- Após as primeiras correções: 30/30 testes focados de topografia passaram.
- Os E2E seguintes reproduziram e conduziram correções adicionais: semântica de lista Axe, metadados perdidos na transformação de exportação, duplicação por duplo clique e alvos WCAG 2.2 em polígonos pequenos.
- Execução final fresca: web 192/192, API 185/185, Electron 18/18, E2E 4/4, typecheck/lint/build/smoke todos exit 0.

## Verificação de release que não passou

`pnpm release:verify-candidate` terminou com exit 1 porque o manifesto de hashes ainda referencia instaladores 1.0.2/1.0.3 ausentes e o instalador 1.0.4 recém-gerado tem tamanho/SHA-256 diferentes. O build e o smoke do pacote passaram, mas **este candidato não deve ser publicado** sem regenerar/revisar o manifesto no fluxo oficial de release. A atualização do manifesto não foi feita porque é governança global, não correção funcional da Topografia.

## Observações

- O primeiro comando focado da API foi digitado com `pnpm --filter api exec tsx` e falhou por resolução do binário; a suíte oficial `pnpm test:api` foi então executada integralmente e passou 185/185.
- O novo teste API apresentou inicialmente erros de TypeScript no helper de injeção; o tipo do payload foi corrigido, e o `pnpm typecheck` final passou.
- Respostas HTTP 400/409/500 sintéticas vistas nos logs são expectativas dos casos negativos e de rollback, não falhas de suíte.
