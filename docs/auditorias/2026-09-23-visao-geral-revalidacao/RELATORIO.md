# Revalidação da Sessão 01 — Visão Geral e tarefas

**Resultado: APROVADA COM RESSALVAS.** Em 23/09/2026, 44 dos 62 itens do inventário foram aprovados na versão atual, 14 ficaram bloqueados por falta de comprovação completa e 4 não se aplicam. Um defeito P3 foi reproduzido, corrigido e retestado; nenhum defeito conhecido ficou pendente. Este resultado vale para as rotas `/` e `/tarefas` nos fluxos iniciados pela Visão Geral; não substitui a homologação do aplicativo instalado.

## Escopo e linha de base

- Aplicação GeoGestor 1.0.4: React/Vite, API Fastify, Electron e SQLite/libSQL; Windows, Node v24.17.0, pnpm 11.8.0.
- Git `main` em `a16551a`, com alterações extensas preexistentes. Nenhuma delas foi revertida. Esta rodada alterou somente o cartão de área, duas specs focadas e os arquivos deste dossiê.
- Banco local `data/geogestor.db`: 2.449.408 bytes, modificado pela última vez em 23/09/2026 18:03:10 antes e depois dos testes. O arquivo estava bloqueado por outro processo ao tentar calcular SHA-256; não houve leitura, backup ou mutação nele.
- A enumeração global de processos e portas pelo PowerShell retornou `Acesso negado`. O executor de testes criou sua própria API, frontend e banco em portas aleatórias e diretórios exclusivos; comprovou `GEOGESTOR_DB_PATH` próprio para a spec. O frontend E2E recebeu a origem exata dessa API por `VITE_API_URL`.
- O executor configurou perfil e pasta de arquivos exclusivos antes da jornada; usou dados com prefixo `QA-AUDIT-S01-`. O banco de cada spec foi descartável e removido após a execução.
- Viewports observados: 1120 × 680, 360 × 800, 768 × 800, 1024 × 800 e 1440 × 800; temas claro e escuro. O teste usa Edge/Playwright, localidade pt-BR e preferência de movimento reduzido.

## Inventário e verificação funcional

A [matriz de cobertura](MATRIZ-DE-COBERTURA.md) registra os 62 itens e a evidência desta rodada. Ela foi confrontada com o [inventário original](../2026-09-07-visao-geral/MATRIZ-DE-COBERTURA.md) e com `Dashboard.tsx`, `Tarefas.tsx`, as rotas de dashboard/tarefas e a spec integrada.

O E2E passou com API e banco reais, isolados. Partiu do painel vazio; criou cliente, dois projetos, receita paga de 10.000 centavos, despesa paga de 4.000 centavos e tarefas pendente, atrasada, concluída e no limite do mês. Confirmou na interface Clientes `01`, Projetos `02`, Área `123,5`, Eficiência `25%`, Fluxo de Caixa `R$ 60,00` e Taxa de Conclusão `1 de 4`. Depois de concluir uma tarefa pela interface, confirmou `2 de 5` e `40%`; após reabrir, `1 de 5` e `20%`; após excluir, `1 de 4` e `25%`.

A mesma jornada verificou filtros e URL, período personalizado inválido e válido sem requisição invertida, recarga, gráficos, tooltip e alternativa textual, alertas, tema, larguras 360/768/1024/1440 sem overflow, navegação para Tarefas, quatro tarefas visíveis, foco inicial e de retorno do modal, rascunho com confirmação, criação com todos os campos conferidos no SQLite, edição, persistência após recarga, rollback após resposta 500 injetada, conclusão, reabertura, cancelamento e confirmação de exclusão por nome e UUID. Após excluir, consultou `tarefas.deleted_at` no SQLite, confirmou ausência na listagem da API e após recarga, e conferiu a atividade recente na interface. O Axe não apontou violações nas telas vazia, populada clara/escura e de tarefas. A resposta 500 injetada no `PATCH` era esperada; não restaram erros de console ou respostas 500 inesperadas segundo a spec.

As duas integrações de API passaram em SQLite isolado. Elas verificaram filtros e cálculos do dashboard, entradas inválidas com HTTP 400, normalização de título, rejeição de projeto excluído, exclusão lógica, HTTP 404 para ID inexistente e tarefa excluída, e vencimentos que aparecem mesmo depois de mais de 100 tarefas sem prazo. Quatro testes unitários passaram para períodos, URL e datas civis de São Paulo.

## Achado corrigido

| ID | Gravidade / camada | Rota e pré-condição | Reprodução, esperado e obtido | Causa, alteração e reteste |
|---|---|---|---|---|
| S01R-01 | P3 / frontend | `/`; projeto ativo com `area_ha=123.45` | E2E encontrou `123.5` no cartão “Área sob Gestão”, em vez de `123,5`. [Antes](evidencias/02-dashboard-populado-claro.png); a asserção pt-BR falhou antes da correção. | `Dashboard.tsx` usava `toFixed(1)`, que ignora a localidade. Troquei por `Intl.NumberFormat('pt-BR')` com uma casa decimal. O E2E final passou 1/1 e a [captura corrigida](evidencias/06-dashboard-area-corrigida.png) mostra `123,5`. |

## Limites da comprovação

| ID | Gravidade | Resultado | Próximo ensaio |
|---|---|---|---|
| B-01 | P2 de cobertura | `DASH-19`: não houve interrupção da API, operação lenta e reconexão controlada. | Repetir com rede controlada em perfil descartável. |
| B-02 | P2 de cobertura | `TASK-02`, `TASK-14`: faltaram dupla submissão na UI e arraste por teclado/ponteiro. | Ampliar a jornada de Tarefas. |
| B-03 | P2 de cobertura | `BE-08`, `BE-10`: faltaram atualização dos alertas após mutação e duas escritas simultâneas sobre a mesma tarefa. | Testar invalidação e política de conflito com dois clientes. |
| B-04 | P2 de cobertura | `A11Y-05`, `A11Y-08`, `A11Y-09`: faltaram contenção de foco, leitor de tela real e zoom nativo de 200%. | Homologação assistiva e de reflow. |
| B-05 | P2 de cobertura | `NAV-03`, `DASH-02`, `DASH-07`, `DASH-14`: faltaram comprovação de novo desbloqueio obrigatório, ausência de piscada, eixos/arredondamento completos e ordem da lista. | Acrescentar asserções específicas. |
| B-06 | P2 de cobertura | `BE-09`, `A11Y-04`: faltaram inspeção de CORS em HTTP 423 e anúncios acessíveis em atualizações dinâmicas. | Ampliar integração e inspeção de acessibilidade. |

Esses IDs são **bloqueios de evidência**, não defeitos reproduzidos. A Sessão 01 anterior registrou 14 defeitos corrigidos em 07/09/2026; eles não são contados como achados ou correções desta revalidação.

## Comandos e resultados

| Comando | Resultado observado |
|---|---|
| `pnpm run test:e2e -- session01-dashboard-tasks.spec.ts` | reteste final: 1/1 teste Playwright aprovado; 41.240 ms; 0 falhas, 0 ignorados |
| `node (node -p "require.resolve('tsx/cli',{paths:['./apps/api']})") --test --test-force-exit apps/api/src/session01-dashboard-tasks.integration.test.ts apps/api/src/dashboard-filters.integration.test.ts` | 2/2 testes aprovados, 0 falhas |
| Mesmo executor para `apps/web/src/utils/dashboardFilters.test.ts` e `apps/web/src/utils/localDate.test.ts` | 4/4 testes aprovados, 0 falhas |
| `pnpm run typecheck` | saída 0, web e API sem erros |
| `pnpm run lint` | saída 0, ESLint web sem erros |
| `git diff --check --` nos três arquivos alterados desta rodada | saída 0; somente aviso de conversão LF/CRLF |

A primeira tentativa de invocar `pnpm --filter api exec tsx` falhou porque `tsx` não estava no `PATH` do filtro; o comando corrigido acima passou. Durante a ampliação, quatro execuções E2E falharam por matcher incompatível, expectativa matemática incorreta e dois seletores de texto; esses problemas eram da spec, foram corrigidos e não representam falha de produto. A execução com `123,5` falhou antes da correção pelo defeito S01R-01. O [resumo final gerado pelo executor](evidencias/e2e-summary.json) tem SHA-256 `B2329ADA1B738FF09397FE9E02A66F853494D4FB9664BE305CA5C120B4E43CA9`. Há [capturas atuais](evidencias/) do painel vazio, claro, escuro, em 360 px, da atividade após exclusão e da área corrigida.

## Limpeza e revisão do diff

O executor informou `Execução aprovada e resíduos próprios removidos` e o diretório final `run-1790205624455-33656-3d1f4562-e8f1-4dcf-8c11-93e3cfdf3b68` não existe mais. As cinco tentativas falhas desta ampliação também tiveram seus diretórios exatos removidos após preservar as capturas úteis. A verificação final dos oito IDs de execução desta rodada retornou `RUNS_RESTANTES=0`. O teste de integração `dashboard-filters` deixou arquivos SQLite e log em `scratch/dashboard-filters-43316`; após confirmar o PID, a criação durante esta rodada e o caminho resolvido dentro da raiz do repositório, a pasta foi removida e `Test-Path` retornou `False`. As demais pastas antigas de `scratch` foram preservadas. O banco local manteve tamanho e data de modificação. Não houve upload nem anexos funcionais. A revisão do diff não encontrou whitespace inválido.

Arquivos de código alterados nesta rodada: `apps/web/src/pages/Dashboard.tsx` (formatação pt-BR), `tests/e2e/session01-dashboard-tasks.spec.ts` (asserções ampliadas e regressão da área) e `apps/api/src/session01-dashboard-tasks.integration.test.ts` (ID inexistente). Os três já tinham alterações preexistentes, preservadas.

## Riscos residuais e recomendação

Há 14 itens sem comprovação completa. Recomendo executar os ensaios B-01 a B-06 antes de usar esta revalidação como homologação integral. A próxima sessão funcional pode começar, desde que mantenha esses bloqueios na regressão transversal e repita o smoke do painel após mudanças em tarefas, projetos ou financeiro.

### Melhorias não implementadas

| Prioridade | Proposta | Benefício | Esforço | Risco |
|---|---|---|---|---|
| 1 | Acrescentar asserções E2E para envio duplo, alertas após mutação e contenção de foco | Fecha lacunas do fluxo principal | Médio | Baixo |
| 2 | Criar ensaio controlado de concorrência com política explícita de conflito | Detecta perda de atualização | Médio | Médio; exige decisão de produto |
| 3 | Executar roteiro NVDA e zoom nativo de 200% em Windows | Comprova experiência assistiva real | Médio | Baixo |
