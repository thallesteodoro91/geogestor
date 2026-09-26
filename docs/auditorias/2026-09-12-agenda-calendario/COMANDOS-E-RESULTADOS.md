# Comandos e resultados

Todos os comandos foram executados em `C:\Users\Thalles\Documents\Codex\2026-06-22\a\work\Geogestor` em 12/09/2026.

## Baseline e inspeção

| Comando/ação | Resultado |
|---|---|
| `git branch --show-current` | `main`. |
| `git rev-parse HEAD` | `a16551a8b63e73f42d826297df893488e5ab88ca`. |
| `git status --short` | Árvore amplamente modificada antes da sessão; alterações foram preservadas. |
| Leitura dos sete `RELATORIO.md` anteriores | Concluída integralmente. |
| Inventário por `rg` de rotas/componentes/schema/serviços | Três fontes, CRUD, alertas, OAuth, scheduler e detalhes mapeados. |

## Testes dedicados

| Comando | Resultado final |
|---|---|
| `node apps/api/node_modules/tsx/dist/cli.mjs --test apps/api/src/google-calendar-mapping.test.ts apps/api/src/session08-calendar.integration.test.ts apps/api/src/relationship-integrity.integration.test.ts` | **10/10** aprovados, 0 falhas. |
| `pnpm test:e2e -- tests/e2e/session08-calendar.spec.ts` | **4/4** aprovados em build de produção; runner removeu o banco/perfil final isolado. |

O E2E incluiu a configuração inicial isolada e três cenários do calendário: reconciliação/ordem/Google URL; CRUD/detalhes/exclusão/Desfazer; falha parcial/URL/teclado/mobile/tema escuro.

## Regressão e empacotamento

| Comando | Resultado final |
|---|---|
| `pnpm test:web` | **182/182**, 0 falhas, 3.179,7 ms. |
| `pnpm test:api` | **178/178**, 0 falhas, 141.092,6 ms. |
| `pnpm test:electron` | **18/18**, 0 falhas, 247,1 ms. |
| `pnpm lint` | Aprovado, 0 erros. |
| `pnpm typecheck` | Aprovado em web e API. |
| `git diff --check` | Aprovado; somente avisos de normalização LF→CRLF da árvore preexistente. |
| `pnpm run build` | Aprovado; API, web, Electron, NSIS e blockmap gerados. |
| `pnpm release:smoke-package` | Aprovado: pacote abriu, política de senha funcionou, banco permaneceu cifrado e segredos não foram expostos. |

Artefatos finais:

- `apps/desktop/dist/win-unpacked/GeoGestor.exe`: 201.237.504 bytes.
- `apps/desktop/dist/GeoGestor Setup 1.0.4.exe`: 89.961.164 bytes.
- `apps/desktop/dist/GeoGestor Setup 1.0.4.exe.blockmap`: 95.069 bytes.

## Integridade dos dados

| Verificação | Resultado |
|---|---|
| `Get-FileHash -Algorithm SHA256 data/geogestor.db` | `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471`. |
| Tamanho de `data/geogestor.db` | 1.990.656 bytes, igual ao baseline. |
| Prefixo de dados sintéticos | `QA-AUDIT-S08-20260912-`, somente em bancos E2E descartáveis. |
| Limpeza | 17 diretórios de execuções falhas/interrompidas desta sessão removidos após validação do caminho; execução final já foi autolimpada pelo runner. |

## Iterações e falhas intermediárias

As falhas abaixo foram tratadas como evidência de depuração, não como resultado final:

1. Seletores E2E ambíguos entre card, campo e link Google foram estreitados por semântica/ID.
2. Um lock SQLite intermitente ocorreu ao semear o banco enquanto a API também o consultava. O runner dedicado ganhou `busy_timeout` e retry; a limitação multiprocesso de produção permaneceu bloqueada.
3. O E2E revelou compressão/sobreposição em 1120 px; breakpoint corrigido de `lg` para `xl`.
4. O E2E revelou perda do contexto ao voltar do detalhe; a origem passou a ser preservada.
5. O E2E revelou que `replace` impedia histórico e que efeitos concorrentes podiam sobrescrever `popstate`; a escrita de mês/dia foi isolada nos comandos temporais e a escrita de filtros ficou restrita a `replace`.
6. A primeira regressão da API falhou 1/178 porque o POST novo devolvia 201, mas o contrato histórico exigia 200. O status foi restaurado e o reteste integral terminou 178/178.
7. Uma tentativa preparatória com `pnpm --filter api exec tsx` não resolveu o binário; o comando determinístico passou a chamar o CLI local por caminho explícito.

## Evidências preservadas

- `evidencias/01-grade-fontes-ordenacao.png`
- `evidencias/02-detalhe-e-recuperacao.png`
- `evidencias/03-falha-parcial-mobile-escuro.png`

Nenhum log com credencial OAuth, token ou segredo foi produzido ou incluído nos relatórios.

