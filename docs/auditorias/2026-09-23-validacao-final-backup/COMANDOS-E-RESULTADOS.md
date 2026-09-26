# Comandos e resultados

Todos os comandos abaixo foram executados na fonte GeoGestor; saídas não incluem segredos.

| Comando/verificação | Resultado |
|---|---|
| `git rev-parse HEAD` | `a16551a8b63e73f42d826297df893488e5ab88ca`; worktree extensamente modificado |
| `git diff` no pipeline | Mudanças em backup, autorização, migrações e schema até v17; roteiro reduzido invalidado |
| Inventário Windows somente leitura | 0 processos GeoGestor, 0 registros de desinstalação; `Get-VM` indisponível; nenhum A/B comprovado |
| Hash de instalador histórico 1.0.4 | `FB883A54ABD3C2A713F56BD12478CC0335276E98A0456A68770571649C502AD4` |
| `pnpm test:electron` | exit 0; 18/18 |
| Testes focados API via `tsx --test` | exit 0; 7/7 (1 integração, 4 retenção, 2 autorização) |
| `pnpm typecheck` inicial | exit 0 |
| `pnpm --filter api lint` inicial | exit 1; 1 erro em `backup.service.ts:616`, 78 avisos |
| `pnpm --filter api lint` após correção | exit 0; 0 erros, 78 avisos |
| `pnpm typecheck` após correção | exit 0 |
| Integração de backup após correção | exit 0; 1/1, duração da suíte 41,178 s |
| `git diff --check` no arquivo corrigido | exit 0 |

Não foi executado E2E no candidato instalado nem teste humano. A primeira tentativa `pnpm exec tsx` falhou porque o binário não estava no `PATH` do pacote raiz; a chamada direta ao CLI local de `apps/api` executou os sete testes.

As duas fixtures criadas por estas execuções em `scratch/backup-restore-34056` e `scratch/backup-restore-43212` foram identificadas por data de criação, tiveram o caminho absoluto conferido dentro de `scratch` e foram removidas. Diretórios anteriores permaneceram intactos.
