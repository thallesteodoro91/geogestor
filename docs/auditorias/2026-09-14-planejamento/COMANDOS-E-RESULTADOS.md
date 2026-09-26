# Comandos e resultados

## Ambiente

| Item | Valor |
|---|---|
| Aplicativo/web/API | 1.0.4 |
| Desktop | 1.0.4 |
| Electron | `^35.7.5` |
| Node.js | 24.17.0 |
| pnpm | 11.8.0 |
| SO | Windows 10.0.26200 |
| Fuso | America/Sao_Paulo |
| Git | `main` @ `a16551a8b63e73f42d826297df893488e5ab88ca` |
| Worktree | já estava sujo; 244 entradas no inventário inicial; nenhuma alteração alheia foi revertida |

## Resultados executados

| Comando/ação | Resultado e tempo observado |
|---|---|
| Teste focado `strategic-planning.integration.test.ts` final, após endurecer o teardown | 1/1; teste 10.787,670 ms; total 11.130,269 ms; exit 0; diretório do run ausente ao final |
| Mesmo teste focado anterior | 1/1; total 3.927,990 ms; snapshot de volume ~71,2 ms |
| Testes web | 194/194; ~3,20 s; exit 0 |
| Typecheck API final | aprovado; 12,656 s |
| Typecheck web | aprovado; ~32,6 s |
| Lint web | exit 0, sem saída |
| Lint API | exit 0; 78 avisos históricos, nenhum erro e nenhum nos arquivos estratégicos alterados |
| Testes Electron | 18/18; 157,6 ms |
| E2E final | 2/2; cenário de Planejamento 27,1 s; total 40,8 s |
| `pnpm run build` | exit 0; contratos, database, API, web (Vite 2,91 s) e desktop/NSIS assinado |
| `pnpm run release:smoke-package` | aprovado: pacote abriu sem senha, ativou/removeu bloqueio, manteve DB criptografado e não expôs segredos |
| Suíte API completa | 185 testes; 184 aprovados, 1 falhou; 114.091,8 ms |
| Teste financeiro falho isolado | reproduzido; ~3,47 s; fora do Planejamento |
| `pnpm run release:verify-candidate` | falhou: instaladores 1.0.2/1.0.3 ausentes e tamanho/SHA-256 1.0.4 divergentes |
| `pnpm run governance:check` | falhou por dívida global: Ajuda 1.0.1, links literais em módulos não alterados, `chart-colors.ts` e avisos de recursos |
| Scan de antipadrões no recorte | nenhum `transition-all`, `outline-none` sem substituto, bloqueio de paste, viewport proibido, `div/span` clicável, TODO/FIXME ou console nos arquivos de Planejamento |

## E2E e evidências

O E2E usa frontend construído, API real e SQLite isolado. Exercitou criação das oito entidades, edição de objetivo, descarte de formulário alterado, filtro/URL, teclado em tabs, recarga, persistência, tema escuro, viewport móvel, URL inválida, erro simulado apenas para estado de falha e recuperação com API real. O run final foi removido pelo harness.

Durante a construção do teste ocorreram três falhas do próprio roteiro, corrigidas antes da execução final: confirmação de descarte não tratada, interceptor de erro instável e seletor que alcançava `<option>` oculto; o Axe também foi movido para depois da saída de toasts animados. Elas não são contadas como defeitos do produto, salvo os estados de produto já registrados em `ACHADOS.md`.

## Falha externa reproduzida

`apps/api/src/financial-removal-scenarios.integration.test.ts:318` espera `accountsReceivableCents=0`, mas recebe `3333`; `receivedCents=6668`. A falha persiste isolada. Nenhum arquivo do Financeiro foi modificado pela Sessão 12.

## Observações de reprodutibilidade

- O teste focado pode ser executado com `node apps/api/node_modules/tsx/dist/cli.mjs --test --test-force-exit apps/api/src/strategic-planning.integration.test.ts`.
- O atalho `pnpm --filter api exec tsx ...` falhou antes do teste porque o executável não estava exposto no PATH desse shell; a execução direta do CLI local acima foi concluída com exit 0. Isso foi uma falha de invocação, não do produto.
- Após validar caminho absoluto e filiação direta a `scratch`, foram removidos 145 diretórios residuais numerados `strategic-planning-<PID>`; contagem posterior: zero. Artefatos históricos `strategic-visual.*`, logs e scripts datados de 30–31/07/2026 foram preservados.
- Os tempos são de uma estação Windows local e servem como evidência desta execução, não como SLA universal.
- Saídas completas volumosas não foram copiadas para os documentos; foram resumidas sem tokens, senhas ou dados reais.
