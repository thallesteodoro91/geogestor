# Governança preventiva do GeoGestor — 2026-08-11

> **REGISTRO HISTÓRICO SUPERADO EM 2026-08-13:** este documento preserva o estado observado em 11/08. A fonte técnica canônica atual é o `package.json` da raiz, hoje em `1.0.0` e apresentada comercialmente como GeoGestor 1.0; evidências históricas abaixo não autorizam build ou publicação.

## Resumo executivo

Esta etapa acrescentou barreiras para impedir novos links internos literais, divergência de versão, retorno de nomenclatura obsoleta, aliases sem registro e artefatos temporários rastreados. Também passou a remover somente a pasta criada por uma nova execução E2E aprovada, após o encerramento gracioso dos processos.

Não houve limpeza histórica, exclusão de recurso inconclusivo, consolidação automática de código, alteração de dados reais, empacotamento ou publicação. A versão continua `1.0.0`; `Financeiro`, `Visão geral`, os menus financeiros e as alterações anteriores — inclusive o logotipo da aplicação — foram preservados.

## Diagnóstico anterior às mudanças

| Classificação | Evidência | Decisão |
| --- | --- | --- |
| problema comprovado | catálogo cobria apenas parte das rotas e aliases estavam literais em `App.tsx` | centralizar declarações e testar consumo pelo roteador |
| problema comprovado | E2E criava `run-*`, encerrava processos à força no Windows e não removia sucessos | marcar propriedade, encerrar graciosamente e limpar somente o sucesso atual |
| melhoria preventiva | não havia comando único para versão, nomes, links novos, compatibilidade e resíduos rastreados | criar barreiras estáticas e comando de verificação |
| item inconclusivo | 26 recursos continuavam sem consumidor comprovado | manter e apenas diagnosticar |
| risco de compatibilidade | 71 links literais preexistentes e aliases ainda suportados | bloquear novas ocorrências e migrar o histórico gradualmente |

O worktree já continha uma auditoria ampla e alterações paralelas. Nenhuma mudança preexistente foi revertida ou atribuída indevidamente a esta etapa.

## Fonte canônica de navegação

`packages/contracts/src/app-navigation.ts` agora concentra:

- `APP_ROUTES`: 29 rotas com identificador estável, caminho, rótulo e disponibilidade;
- `APP_ROUTE_PATTERNS`: padrões derivados do catálogo, sem segunda lista manual;
- `APP_PATHS`: compatibilidade para consumidores existentes;
- `APP_LEGACY_REDIRECTS`: nove aliases com origem, destino, estado, risco, versão mínima e condição de retirada;
- `APP_QUERY_KEYS`, `appLinks` e `withAppQuery`: parâmetros e construtores tipados;
- `isInternalAppLink` e `isExternalNavigation`: distinção explícita entre navegação interna e externa;
- `resolveLegacyRedirect`: preservação segura de parâmetros antigos sem substituir o destino canônico.

O roteador declara todas as páginas com `APP_ROUTES` e materializa aliases a partir de `APP_LEGACY_REDIRECTS`. A barra lateral usa os mesmos caminhos; a apresentação `Comercial` foi preservada onde é uma decisão de produto, embora a rota canônica represente clientes.

Testes verificam unicidade, registro no roteador, destino real, parâmetros consumíveis e preservação de busca persistente.

## Aliases de navegação preservados

| Origem compatível | Destino canônico | Risco |
| --- | --- | --- |
| `/contatos` | `/crm?view=leads` | médio |
| `/dashboard-financeiro` | `/financeiro` | médio |
| `/gestao-financeira` | `/financeiro?tab=auxiliares` | médio |
| `/despesas` | `/financeiro?tab=pagar` | alto |
| `/operacional` | `/projetos?visualizacao=estatisticas` | médio |
| `/calculadora-ambiental` | `/ambiental?tab=car` | médio |
| `/licenciamento` | `/ambiental?tab=licenciamento` | alto |
| `/faturas` | `/financeiro?tab=faturas` | alto |
| `/relatorio-executivo` | `/relatorios?tipo=executivo` | alto |

Endpoints e campos antigos permanecem em `governance/compatibility-registry.json`. O registro possui seis itens de API/contrato e exige consumidor, teste, risco, versão mínima e condição de retirada. Nenhum alias, endpoint ou campo foi removido.

## Links internos literais

A barreira examina todo o código de produção e compara cada uso com `governance/hardcoded-navigation-baseline.json`. A comparação usa arquivo, assinatura normalizada e quantidade, sem depender do número da linha ou da existência de diferenças no Git. Novos usos literais em `navigate`, `to`, `href` ou `path`, assim como o aumento de uma ocorrência histórica, bloqueiam a verificação. Rotas devem usar o catálogo ou os construtores canônicos.

O diagnóstico encontrou 71 ocorrências preexistentes. Elas são dívida gradual, não autorização genérica e não foram migradas em massa para evitar regressões. A regra considera legítimos:

- URLs externas `http(s)`, `mailto` e `tel`;
- endpoints `/api`, que não são navegação de interface;
- fixtures e testes de compatibilidade;
- os valores declarados na própria fonte canônica.

Não existe exceção automática para novos links internos. A baseline registra 71 ocorrências agrupadas em 51 assinaturas e aceita apenas redução. Quando uma literal for indispensável, ela deve ser documentada, acompanhada por teste e registrada em uma revisão com data, novo total e justificativa explícita.

## Nomenclaturas e versão

- `Gestão financeira 360` é proibido em código de produção; arquivo e linha são informados em caso de retorno.
- Testes e documentação histórica podem mencionar termos antigos quando a compatibilidade exigir.
- A versão da raiz é a fonte canônica.
- API, desktop e versão mínima da Ajuda devem coincidir com a raiz.
- O pacote web permanece privado com versão técnica `0.0.0`; o Vite injeta a versão real a partir da raiz.
- A verificação atual confirma `1.0.0` em todos os pontos de produto.

## Política de resíduos E2E

Novas execuções comerciais:

1. recebem pasta exclusiva `scratch/commercial-e2e/run-*`;
2. recebem o marcador `.geogestor-e2e-run.json` criado com escrita exclusiva;
3. usam banco, build, resultados e logs somente nessa raiz;
4. desativam tarefas automáticas do scheduler somente no ambiente E2E;
5. solicitam encerramento da API por IPC e aguardam `server.close()`;
6. usam encerramento forçado apenas como fallback após timeout;
7. removem a própria pasta marcada quando todos os testes passam;
8. preservam marcador, evidências e `failure-summary.json` quando há falha.

A política recusa raiz vazia, o próprio diretório permitido, caminho externo, nome fora de `run-*`, link simbólico e pasta sem marcador. O teste confirmou que uma pasta irmã preexistente não é tocada.

A execução final criou `run-11336`, passou e removeu somente essa pasta. `run-14376`, `run-29440`, `run-1860` e todas as demais execuções anteriores permaneceram intactas. O aviso antigo do scheduler não voltou a ocorrer.

Nenhuma política de retenção histórica foi executada. Uma futura retenção das falhas mais antigas ainda exigirá prévia visualização e autorização explícita.

## Arquivos temporários e controle de versão

As regras existentes para `scratch`, `work`, `temp-lovable`, `data`, bancos, logs e builds foram preservadas. Foram acrescentadas regras explícitas para:

- `playwright-report`;
- `test-results`;
- `*.trace.zip`;
- `*.dmp`.

A barreira também consulta os arquivos efetivamente rastreados e falha se encontrar bancos, logs, executáveis ou raízes temporárias/sensíveis. Nenhum arquivo existente foi removido por causa do `.gitignore`.

## Recursos e duplicações

O diagnóstico não destrutivo encontrou:

| Item | Resultado | Interpretação |
| --- | ---: | --- |
| recursos visuais | 71 | inventário atual |
| com consumidor comprovado por nome/import | 45 | utilizados |
| sem consumidor comprovado | 26 | inconclusivos; preservar |
| grupos de hash visual idêntico | 0 | nenhuma duplicação binária comprovada |
| arquivos-fonte exatamente iguais | 0 | nenhuma duplicação exata comprovada |
| arquivos grandes com similaridade ≥ 90% | 0 | nenhuma consolidação automática indicada |
| literais de endpoint repetidos | 84 padrões | candidatos informativos; repetição pode ser teste, contrato ou uso legítimo |

A similaridade usa conjuntos de linhas normalizadas, exige ao menos 60 linhas significativas e serve apenas como triagem. Ela não substitui comparação de comportamento, consumidores, acesso e erros.

## Barreiras automáticas

### Bloqueantes

- divergência de versão;
- termo obsoleto em produção;
- novo link interno literal ou aumento da baseline, inclusive com o Git limpo;
- registro de compatibilidade incompleto ou duplicado;
- artefato temporário/sensível rastreado;
- falha de tipagem, teste, E2E ou `git diff --check`.

### Informativas

- links literais históricos dentro do limite registrado na baseline;
- recursos inconclusivos;
- hashes ou arquivos similares;
- endpoints repetidos.

Itens informativos nunca provocam exclusão ou refatoração automática.

## Comandos e checklist

- `pnpm governance:check`: verificações estáticas rápidas.
- `pnpm governance:test`: testes das políticas preventivas, incluindo baseline e prévia E2E.
- `pnpm governance:verify`: tipagem, testes, E2E completo e integridade do diff, sem empacotar.
- `pnpm e2e:cleanup:preview`: prévia não destrutiva das execuções com propriedade comprovada.

O checklist para novas alterações está em `docs/CHECKLIST-GOVERNANCA.md`.

## Arquivos desta etapa

- `.gitignore`;
- `package.json`;
- `packages/contracts/src/app-navigation.ts` e `packages/contracts/src/index.ts`;
- `apps/web/src/App.tsx`;
- `apps/web/src/components/Sidebar.tsx`;
- `apps/web/src/utils/appNavigation.test.ts`;
- `apps/web/src/pages/Financeiro/financeConsolidation.test.ts`;
- `apps/api/src/server.ts`;
- `scripts/run-commercial-e2e.mjs`;
- `scripts/e2e-artifacts.mjs` e respectivo teste;
- `scripts/governance-checks.mjs` e respectivo teste;
- `scripts/run-governance.mjs`;
- `governance/compatibility-registry.json`;
- `docs/CHECKLIST-GOVERNANCA.md`;
- este relatório.

## Validação

| Verificação | Resultado |
| --- | --- |
| barreiras estáticas | aprovadas; apenas alertas informativos esperados |
| testes das políticas | 9/9 após a etapa de baseline permanente |
| tipagem frontend | aprovada |
| tipagem API | aprovada |
| frontend | 90/90 |
| API | 107/107 |
| Electron | 15/15 |
| E2E completo | 45/45 em 3,8 min |
| build frontend usado pelo E2E | aprovado; 5.966 módulos |
| encerramento da API E2E | gracioso |
| aviso de manutenção do scheduler | não ocorreu |
| remoção da execução aprovada | `run-11336` removida; execuções anteriores preservadas |
| orquestrador sem repetição do E2E | aprovado em 173 s; políticas, tipagem, frontend, API, Electron e diff |
| `git diff --check` | aprovado; somente avisos informativos de conversão LF/CRLF |

## Limitações e próximos passos

1. Os 71 links literais históricos estão protegidos por baseline e devem ser migrados somente quando seus fluxos forem tocados e testados.
2. O diagnóstico de endpoints agora separa produção, testes, camadas, compatibilidade e padrões dinâmicos; os resultados continuam sendo sinais de revisão, não prova de código duplicado.
3. A detecção de similaridade é conservadora e pode não encontrar duplicações semânticas.
4. A retenção automática de falhas antigas não foi implementada nem executada.
5. Os 26 recursos inconclusivos continuam dependendo de decisão visual humana.
6. Antes de um candidato final, executar `pnpm governance:verify` em worktree controlado e repetir a rodada manual planejada.

## Garantias

- versão mantida em `1.0.0`;
- correções anteriores e logotipo preservados;
- `Financeiro`, `Visão geral` e menus financeiros preservados;
- nenhum dado, banco, WAL/SHM, backup real ou migração oficial alterado;
- nenhuma limpeza histórica executada;
- nenhum recurso inconclusivo excluído;
- nenhum alias, endpoint ou campo compatível removido;
- nenhum instalador gerado, instalado ou publicado;
- nenhum commit, branch, tag, push ou pull request criado.
