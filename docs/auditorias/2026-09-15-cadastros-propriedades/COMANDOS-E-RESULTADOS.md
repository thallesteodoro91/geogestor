# Comandos e resultados

Ambiente: Windows 10.0.26200, locale pt-BR, fuso `America/Sao_Paulo`, Node 24.17.0, pnpm 11.8.0, Electron empacotado 35.7.5, GeoGestor 1.0.4, branch `main`, HEAD `a16551a8b63e73f42d826297df893488e5ab88ca`.

## Linha de base e diagnóstico

| Comando/ação | Resultado |
|---|---|
| `git status --short`, `git diff --stat`, `git rev-parse HEAD` | worktree já extensamente sujo; HEAD e alterações preexistentes preservados |
| `Get-FileHash -Algorithm SHA256` nas duas bases reais | hashes registrados antes de mutações; repetidos idênticos ao final |
| inspeção de portas/processos | nenhuma instância relevante escutando; consulta WMI de processo foi negada pelo ambiente |
| busca por `docs/auditorias/*-relatorios/RELATORIO.md` | relatório final da Sessão 11 não localizado |

## Red/green e testes focados

| Execução | Resultado |
|---|---|
| integração inicial de catálogos/propriedades | 3/5; UF ausente retornou 201 em vez de 400 e subcategoria normalizada duplicada foi aceita |
| testes focados após correções | 8/8 em 28,2 s, incluindo contratos, deadline/importação e migrações |
| `node .../tsx/dist/cli.mjs --test --test-force-exit apps/api/src/session13-catalog-properties.integration.test.ts` | 1/1; 10.924,558 ms |
| `runtime-migrations-v16.integration.test.ts` | aprovado; conflito legado, idempotência, índices e `quick_check` |

## Regressão final

| Comando | Resultado exato |
|---|---|
| `pnpm test:web` | 195 testes, 195 aprovados, ~1,64 s |
| `pnpm test:electron` | 18/18 aprovados |
| `pnpm test:e2e -- tests/e2e/cadastros-properties.spec.ts` | 9/9 aprovados, 1,8 min |
| `pnpm lint` | aprovado; ESLint sem erro, 25,33 s |
| `pnpm --filter api lint` | aprovado com 0 erros e 78 avisos preexistentes fora dos arquivos da sessão, 8,36 s |
| `pnpm typecheck` | web e API aprovados, ~30,5 s |
| `pnpm run build` | aprovado; contracts/database/API/web/desktop; Vite 2,82 s; NSIS 1.0.4 gerado e assinado |
| `pnpm test:api` / runner completo final | 187 testes; 186 aprovados; 1 falhou; 116.989,189 ms |
| `pnpm release:verify-candidate` | código 1 em 1,45 s; 1.0.2/1.0.3 ausentes, tamanho e SHA divergentes de 1.0.4 |

## Evolução da suíte API

A primeira execução completa depois das alterações teve 181/187: uma falha financeira herdada, quatro expectativas antigas de versão da migração e uma falha transitória de deadline por interferência. As expectativas foram atualizadas para schema 16; o deadline passou isoladamente e no conjunto seguinte. A execução final ficou 186/187, somente com:

```text
financial-removal-scenarios.integration.test.ts:318
expected: { accountsReceivableCents: 0, receivedCents: 6668 }
actual:   { accountsReceivableCents: 3333, receivedCents: 6668 }
```

## Evolução E2E

- Uma execução detectou corrida de espera após reload; o teste passou a aguardar desbloqueio ou a tela restaurada.
- Outra revelou que UF vazia impedia a exibição conjunta do erro de identificador; a preparação do formulário deixou a validação tratar UF vazia explicitamente.
- A repetição completa detectou Axe durante a transição claro→escuro, com cores intermediárias; o teste passou a esperar a cor final computada.
- O focado de acessibilidade terminou 2/2 e a suíte final 9/9. O harness removeu automaticamente o run aprovado.

## Hashes finais

```text
data/geogestor.db
size=1990656
lastWrite=2026-08-30 14:12:58
sha256=BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471

%APPDATA%/geogestor-desktop/geogestor.db
size=1163264
lastWrite=2026-09-10 18:39:37
sha256=D4B4169A496501DD3A28746AD49792DB5CFA00CF7D096AB8744B4EE0229CF4DA
```

## Observações de execução

O runner `scripts/run-api-tests.mjs` ignora argumentos de arquivo e sempre coleta todos os `*.test.ts`; uma tentativa de filtrá-lo produziu, de forma útil, a execução completa final. O teste S13 isolado foi então executado diretamente com o CLI do `tsx` resolvido no workspace.
