# Lote A — R01/R02: resultado executado

Data da validação final: 23/09/2026. Escopo: somente bancos, perfis e diretórios descartáveis. O worktree preexistente não foi limpo nem revertido.

## Resultado

- Suíte E2E integral: **90 aprovados, 0 falhas, 0 pulados, 24 specs**, data de referência `2026-09-23`, isolamento `database-per-spec-file`.
- R02 multiprocesso: **11/11** (teste pai e dez subtestes), repetido três vezes consecutivas com o mesmo resultado. Cada execução iniciou dois processos reais da API sobre um SQLite descartável e removeu apenas sua própria raiz temporária.
- Typecheck da API e da interface: aprovado. Regressões de API de CRM e dados operacionais: 2/2 aprovadas.
- O runner mantém o sumário da última execução integral aprovada em `scratch/commercial-e2e/latest-successful-summary.json`; o diretório descartável daquela execução foi removido. Execuções com falha foram preservadas para diagnóstico.

## Causas das falhas identificadas e tratamento

| Falha observada | Causa reproduzida | Tratamento |
|---|---|---|
| Comercial crítico: gráfico de despesas | Mock antigo já não correspondia ao contrato atual do resumo financeiro. | Mock e asserção atualizados para o contrato atual. |
| Links diretos: parcela | Mock devolvia formato antigo, enquanto a tela consome resposta paginada. | Mock corrigido, com preservação dos parâmetros da URL. |
| Sessão 01: painel | Expectativa de vazio dependia da massa criada anteriormente. | Banco próprio e expectativa vinculada apenas à fixture local. |
| Sessão 02: diretório de Clientes | Registro residual de outra spec impedia o estado vazio. | Banco por spec. |
| Sessão 03: CRM | Teste usava mês futuro sem navegar o seletor; caso posterior também dependia do primeiro. | Data relativa e fixture própria/idempotente por caso. |
| Sessão 04: Orçamentos | Estado vazio contaminado e casos posteriores pressupunham o caso inicial. | Banco por spec e preparação independente. |
| Sessão 05: Projetos | Estado vazio contaminado e casos posteriores pressupunham massa prévia. | Banco por spec e preparação independente. |
| Sessão 09: Tarefas | Contagem incluía tarefas de outras specs. | Banco por spec e contagem reconciliada com fixture própria. |
| Sessão 11: Relatórios | Totais incluíam registros de execução anterior. | Banco por spec e reconciliação isolada. |
| Sessão 02, segunda execução integral: recarga | A spec consultava `isVisible()` antes de a tela de autenticação terminar de aparecer após `reload`; deixou passar o bloqueio local. | Helper `reloadClients` aguarda a tela autenticada ou o desbloqueio. Caso isolado e spec inteira passaram; a suíte integral final passou. |
| Acessibilidade de Clientes/Projetos | Cores de badges ficaram abaixo do contraste WCAG no tema escuro/claro. | Ajustes pontuais de cor, confirmados nos testes axe focados e integrais. |
| Calendário | Locator amplo coincidia com mais de um controle após a navegação. | Locator limitado ao controle correto. |
| Backup/restauração | Validação do manifesto ainda limitava o schema a v16 após a migração v17. | Limite atualizado e testes de migração/regressão ajustados. |
| R02: recebimentos simultâneos | Leitura anterior à escrita permitia corrida de saldo; `SQLITE_BUSY_SNAPSHOT` também podia deixar erro 500. | Restrição no SQLite, transação em conexão nova por tentativa, retry limitado e resposta 409 para excesso. |
| R02: CRM e catálogos simultâneos | `SQLITE_BUSY` e falha de commit em conexão transacional compartilhada causavam 500 e podiam contaminar leituras seguintes. | Retry limitado de transação inteira com conexão nova a cada tentativa; testes exigem versão/permutação inteira, sem impor vencedor. |

Uma queda nativa isolada do worker Playwright (`0xC0000005`) ocorreu durante a repetição focada enquanto outro teste multiprocesso executava em paralelo. Não houve asserção de produto nesse evento. O caso passou sozinho, a spec completa passou e os 90 casos integrais também passaram sem repetição da queda.

## Arquivos tocados no Lote A

- Isolamento e fixtures: `scripts/run-commercial-e2e.mjs`, `tests/e2e/support/runtime.ts` e as 24 specs em `tests/e2e/*.spec.ts` (datas relativas, diretórios descartáveis, remoção de serialização e preparação independente onde aplicável).
- Integridade e concorrência: `apps/api/src/db.ts`, `apps/api/src/services/sqlite-concurrency.service.ts`, `apps/api/src/services/runtime-migrations/v17-multiprocess-finance-integrity.ts`, `apps/api/src/services/runtime-migrations.service.ts`, `apps/api/src/routes/operational-data.routes.ts`, `apps/api/src/routes/financeiro-recebimentos.routes.ts`, `apps/api/src/services/oportunidades.service.ts`, `apps/api/src/services/backup.service.ts` e `apps/api/src/r02-multiprocess.integration.test.ts`.
- Expectativas da migração: `apps/api/src/backup-restore.integration.test.ts`, `backup-retention.test.ts`, `drizzle-journal-bootstrap.integration.test.ts`, `operational-data.integration.test.ts`, `restore-authorization.test.ts`, `runtime-migrations-fast-path.integration.test.ts` e `runtime-migrations-safety.integration.test.ts`.
- Contraste reproduzido: `apps/web/src/pages/Clientes/ClienteDetalhes.tsx` e `apps/web/src/index.css`.
- Decisão adiada: `docs/auditorias/2026-09-19-lote-a-r01-r02/CONCORRENCIA-PENDENTE-LOTE-B.md`.

Esses são arquivos tocados para este lote; muitos outros arquivos já estavam modificados no worktree antes dele e foram preservados. As datas fixas remanescentes em testes de calendário (ano bissexto, tamanho de grade) e a data inválida de relatório são casos de borda deliberados, não fixtures que dependem do dia da execução.

## Testes adicionados ou corrigidos

- Runner E2E com API, configuração, SQLite, pasta de dados e evidências próprios por spec; build web compartilhado somente para leitura. A preparação tolera repetição apenas quando encontra exatamente a configuração descartável esperada.
- Specs da Sessão 02, CRM, Orçamentos, Projetos, Ambiental, Financeiro, Calendário, Tarefas e Cadastros verificadas também com casos posteriores executados sem o caso inicial. Nenhum `describe.serial` permanece nas specs E2E.
- R02: unicidade normalizada entre processos, contenção/recuperação de lock, leitura durante escrita, duas edições da mesma propriedade sem estado parcial, reatribuição versus exclusão, limite de recebimentos, backup concorrente, ativação exclusiva de ciclo, reordenação do CRM e substituição de catálogos.
- Regressões de CRM, dados operacionais, recebimento e migração executadas em bancos descartáveis.

## Ressalvas e bloqueios

- **R01 encerrada** para a suíte coberta: isolamento, datas relativas, independência de ordem e preparação idempotente demonstrados por execução integral e testes focados.
- **R02 técnico do Lote A encerrado** para as invariantes testadas. Não foram acessados dados reais.
- **Pendente para o Lote B:** política funcional para edições concorrentes da mesma entidade — ETag/versionamento, última gravação explícita, bloqueio ou merge. O conflito e as alternativas estão em `CONCORRENCIA-PENDENTE-LOTE-B.md`. Nenhuma dessas políticas foi escolhida ou implementada aqui.
- A evidência é para os fluxos cobertos, não uma garantia de ausência de toda corrida possível no produto.

## Evidências e comandos

- Baseline diagnosticado: 90 casos, 61 aprovados, 9 falhas, 20 pulados, com as falhas listadas acima. Os artefatos dessa execução estão em `scratch/commercial-e2e/run-1789842931063-22884-3d7e3ddf-618e-43a6-a14e-5d2af38f53d8`.
- Rodada posterior de 23/09 com 89 aprovados e uma falha de recarga em Clientes: `scratch/commercial-e2e/run-1790121564769-15992-bb1bbfe8-09bc-4794-9b20-37c9b51490c0/run-summary.json` e `specs/run-13-session02-clients/test-results`.
- Rodada final: `scratch/commercial-e2e/latest-successful-summary.json` (90/90, referência `2026-09-23`).
- Comandos principais, executados a partir da raiz do repositório: `node scripts/run-commercial-e2e.mjs`; `node scripts/run-commercial-e2e.mjs session02-clients.spec.ts`; `node scripts/run-commercial-e2e.mjs session02-clients.spec.ts --grep 'persistência, edição'`; `node node_modules/.pnpm/tsx@4.22.4/node_modules/tsx/dist/cli.mjs --test apps/api/src/r02-multiprocess.integration.test.ts` (três repetições); `node node_modules/.pnpm/tsx@4.22.4/node_modules/tsx/dist/cli.mjs --test apps/api/src/oportunidades.integration.test.ts apps/api/src/operational-data.integration.test.ts`; `pnpm --filter api typecheck`; `pnpm --filter web typecheck`; `git diff --check -- ...` (sem erro de whitespace; somente avisos de conversão LF/CRLF do worktree).
