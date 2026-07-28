# GeoGestor — relatório de preparação comercial

Data da conclusão: 28/07/2026
Versão de fonte avaliada: 1.1.2
Branch: `codex/release-1.1.1`
Commit-base: `0159b4877d84d4db3ce58ef0f81a0f65d85c8ff0`

## Resumo executivo

Os bloqueadores funcionais e de segurança identificados na auditoria foram corrigidos no código-fonte. A API não converte mais falhas em dados vazios, o aplicativo ganhou desbloqueio local real, os formulários financeiros deixaram de selecionar clientes implicitamente, rascunhos financeiros passaram a ser protegidos e os mapas comunicam indisponibilidade da camada de fundo sem ocultar dados próprios.

A suíte completa da API passou cinco vezes consecutivas, totalizando 335 testes aprovados. Lint, TypeScript, builds, testes web e testes Electron também passaram. A regressão comercial automatizada percorreu oito jornadas de ponta a ponta, incluindo autenticação, CRUD, finanças, indisponibilidade e reconexão da API, mapas, acessibilidade WCAG A/AA e viewport de 800×520.

Foi gerado e validado um instalador técnico da versão 1.1.2 para homologação. A API empacotada iniciou com banco novo, exigiu configuração e desbloqueio, manteve tabelas operacionais vazias e registrou a auditoria sem expor segredos. O gate de conteúdo e integridade aprovou 155 arquivos e 346.510.619 bytes. As alterações acumuladas foram inventariadas e consolidadas para permitir a geração reproduzível a partir de checkout limpo. O instalador ainda não possui assinatura Authenticode.

Parecer: **APTO PARA HOMOLOGAÇÃO CONTROLADA, mas NÃO APTO PARA LANÇAMENTO COMERCIAL** até assinar o instalador e concluir a homologação humana em Windows limpo.

## Correções por identificador

### GG-C01 — indisponibilidade da API

- Estado global distingue inicialização, indisponibilidade, sessão bloqueada e reconexão.
- Falhas de rede deixaram de retornar arrays, objetos ou KPIs falsamente zerados.
- A interface apresenta mensagem persistente, tentativa de reconexão, detalhes técnicos e acesso aos logs.
- Consultas são invalidadas e atualizadas após a recuperação.
- Dashboard e Financeiro recusam exibir zeros como dados válidos quando as consultas principais falham.
- O Electron registra a saída da API e executa recuperação controlada, limitada a três tentativas numa janela móvel de cinco minutos.

### GG-C02 — senha, sessão e identidade

- Desbloqueio validado exclusivamente pela API com `scrypt` e comparação resistente a timing.
- Token de sessão aleatório, mantido apenas em memória, com inatividade configurável e limite absoluto.
- Bloqueio manual, expiração e proteção básica contra tentativas repetidas.
- Rotas operacionais protegidas; saúde, estado de autenticação, configuração inicial e desbloqueio permanecem públicos.
- O hash de senha não é devolvido ao frontend.
- Nome e e-mail reais da configuração substituem a identidade demonstrativa.
- A interface esclarece que a senha bloqueia o aplicativo, mas não criptografa integralmente o SQLite.

### GG-A01 — cliente financeiro

- Removida a seleção automática de `clientes[0]`.
- Uma nova receita global começa sem cliente.
- Cliente é obrigatório, com erro inline em português e foco no campo.
- Preenchimento contextual permanece permitido somente quando há cliente ou projeto explícito.

### GG-A02 — proteção de rascunhos

- Receitas, contas a pagar e despesas detectam alterações.
- Cancelar, fechar, backdrop e Esc usam o mesmo pedido de descarte.
- Fechamento da janela é protegido por `beforeunload`.
- O diálogo apresenta “Descartar alterações” e “Continuar editando”.
- Formulários intactos fecham sem confirmação.

### GG-A03 — mapas offline

- Configuração do provedor de tiles centralizada.
- Ausência de rede e `tileerror` geram estado de “mapa-base indisponível”.
- Marcadores, geometrias e arquivos vetoriais próprios permanecem separados do mapa-base.
- Há ação de nova tentativa e limitação de ruído repetido.
- Ícones do visualizador deixaram de depender de um CDN externo.

### GG-B02 — determinismo da API

- Bancos, pastas e arquivos temporários dos testes receberam escopo exclusivo por processo.
- O executor oficial resolve a ferramenta TypeScript de forma determinística.
- Clientes e oportunidades passam na suíte completa e isoladamente.
- A suíte completa passou cinco vezes consecutivas.

### GG-B01 — integridade do pacote

- O build recusa versões divergentes entre raiz e Electron.
- O gate de candidato recusa worktree sujo antes de iniciar o empacotamento.
- A verificação compara tamanho e SHA-256 do artefato com o manifesto.
- O smoke da API empacotada foi atualizado para configuração inicial, bloqueio, desbloqueio e tabelas realmente vazias.
- O pacote antigo foi recusado por `dirty=true` e divergência de tamanho e SHA-256.
- Um novo instalador técnico 1.1.2 foi gerado, teve o manifesto recriado e passou no gate de conteúdo e integridade.
- A consolidação permite executar o gate comercial estrito a partir de checkout limpo.
- A verificação Authenticode continua retornando `NotSigned`.

### GG-A04 — E2E

- Playwright e axe foram adicionados ao projeto.
- O executor cria API, banco e build web isolados, usa portas livres e encerra somente os processos que iniciou.
- Oito jornadas comerciais passaram em série: configuração/identidade, senha e bloqueio, cliente, projeto, financeiro/rascunho, API indisponível/reconexão, mapa-base indisponível e WCAG/reflow.
- Evidências de falha usam trace e screenshot; o teste final passou sem gerar artefato de falha.

### GG-M01 — mensagens financeiras

- Valores são validados como texto antes da conversão.
- Mensagens específicas em português cobrem vazio, formato, zero, negativo, limite, data e cliente.
- Erros são exibidos junto aos campos e o primeiro campo inválido recebe foco.

### GG-M02 — contraste

- Reforçado o contraste das seções do menu, atalho Ctrl K, contador do título e badge de versão.
- Corrigidos também textos dependentes de dados em Dashboard, atividades recentes, clientes e projetos.
- O gate axe terminou sem violações sérias ou críticas nas quatro páginas comerciais avaliadas.

### GG-M03 — versão única

- A versão do `package.json` da raiz é injetada no frontend.
- Sidebar, Ajuda, Configurações e título usam a mesma fonte.
- Raiz e Electron estão sincronizados em 1.1.2.

### GG-M04 — feedback

- Adicionado serviço tipado de notificações.
- Fluxos financeiros alterados deixaram de criar ou usar `alert()`.
- Alertas legados fora dos fluxos alterados continuam como dívida técnica.

### GG-M05 — configuração inicial

- Adicionados H1, `name`, `autocomplete`, labels, erros inline e foco no primeiro erro.

### GG-M06 — hierarquia financeira

- Seções principais passaram de H3 para H2 sob o H1.

## Decisões arquiteturais

1. A sessão local é efêmera e permanece apenas em memória. Reabrir o aplicativo exige novo desbloqueio.
2. O bloqueio do aplicativo foi mantido separado de criptografia de disco para não criar uma promessa de segurança falsa.
3. A indisponibilidade da API é um estado de domínio da interface, não um valor padrão de consulta.
4. A recuperação do processo local usa orçamento limitado de reinicializações para evitar ciclos infinitos.
5. O mapa-base é tratado como dependência externa; dados geográficos próprios continuam sendo uma camada independente.
6. O release final só pode ser produzido numa única execução, a partir de checkout limpo e versão sincronizada.

## Arquivos centrais alterados

- API e autenticação: `apps/api/src/server.ts`, `apps/api/src/services/local-session.service.ts`, `apps/api/src/local-auth.integration.test.ts`.
- Disponibilidade e sessão web: `apps/web/src/App.tsx`, `apps/web/src/services/apiClient.ts`, `apps/web/src/components/ApiAvailability.tsx`, `apps/web/src/contexts/AppSessionContext.tsx`, `apps/web/src/pages/DesbloqueioLocal.tsx`.
- Electron: `apps/desktop/main.js`, `apps/desktop/preload.js`, `apps/desktop/main.test.cjs`, `apps/desktop/preload.test.cjs`.
- Finanças: `apps/web/src/pages/Financeiro/Financeiro.tsx`, `apps/web/src/pages/Despesas/Despesas.tsx`, `apps/web/src/pages/Financeiro/financeForm.ts` e testes relacionados.
- Mapas: `apps/web/src/components/maps/MapBaseNotice.tsx`, `apps/web/src/utils/mapTileConfig.ts`, `apps/web/src/utils/mapTiles.ts` e componentes de mapas.
- Configuração e identidade: `apps/web/src/pages/ConfiguracaoInicial.tsx`, `apps/web/src/components/Sidebar.tsx`.
- Release e testes: `scripts/build.mjs`, `scripts/release-candidate.mjs`, `scripts/release-integrity.mjs`, `scripts/release-verify.mjs`, `scripts/smoke-packaged-api.mjs`, `scripts/run-api-tests.mjs`, `scripts/run-web-tests.mjs` e scripts dos `package.json`.
- Diversos testes de integração da API foram isolados em diretórios temporários exclusivos.

Antes da consolidação, o worktree possuía 151 entradas modificadas ou não rastreadas. O inventário confirmou código, testes, migrações, configuração e documentação; bancos, logs, instaladores, builds, credenciais e diretórios temporários permanecem excluídos pelo `.gitignore`. As alterações foram preservadas e revisadas antes do commit.

## Resultados exatos

| Verificação | Resultado |
|---|---:|
| Lint web | aprovado |
| TypeScript web | aprovado como parte do build |
| TypeScript API | aprovado |
| Build web de produção | aprovado, 5.898 módulos |
| Build API de produção | aprovado |
| Testes web | 24/24 |
| Testes Electron | 7/7 |
| Testes de integridade do manifesto | 1/1 |
| API completa 1/5 | 67/67 em 16,303 s |
| API completa 2/5 | 67/67 em 24,655 s |
| API completa 3/5 | 67/67 em 23,072 s |
| API completa 4/5 | 67/67 em 37,857 s |
| API completa 5/5 | 67/67 em 39,986 s |
| Total das cinco execuções | 335/335 |
| E2E Playwright | 8/8 em 1,3 min |
| Acessibilidade automatizada | aprovada: zero violações sérias/críticas nas páginas avaliadas |
| Validação em 800×520 | aprovada sem rolagem horizontal global |
| Gate de fonte | aprovado após a consolidação em commit limpo |
| Smoke da API empacotada | aprovado com banco novo, autenticação e auditoria |
| Gate técnico do pacote | aprovado: 155 arquivos e 346.510.619 bytes |
| Gate comercial estrito | aprovado após regeneração a partir do commit limpo |
| Assinatura Authenticode | bloqueada: `NotSigned` |
| Instalação/atualização/backup pela interface instalada | pendente de homologação humana em Windows limpo |

Os testes da API incluem backup/restauração, reset com rollback, indisponibilidade e banco vazio, autenticação local, migrações, auditoria transacional e falhas financeiras sintéticas.

## Integridade do instalador técnico

- Arquivo: `GeoGestor Setup 1.1.2.exe`.
- O tamanho e o SHA-256 finais são gerados em `apps/desktop/dist/artifact-hashes.json` na mesma execução que produz o candidato.
- Situação: manifesto e conteúdo conferidos; uso restrito à homologação enquanto a assinatura for `NotSigned`.

## Riscos e pendências

1. Assinar o instalador com certificado Authenticode confiável e validar a cadeia no Windows.
2. Executar homologação humana de instalação limpa, atualização preservando banco, desinstalação, backup e restauração.
3. Completar a inspeção manual em tema escuro, escalas do Windows e leitor de tela.
4. Publicar somente se `release:verify-package` e `release:verify-signature` terminarem com código zero.

## Nota revisada

- Antes: **6,6/10**.
- Código-fonte após as correções e automação: **9,0/10**.
- Candidato técnico para homologação: **8,8/10**.
- Release comercial final: **ainda sem nota final**, pois checkout limpo e assinatura são gates obrigatórios.

A evolução é substancial nos riscos de segurança, perda de rascunho, falsa representação de dados, acessibilidade e determinismo. Os testes e o artefato reproduzível permitem beta/homologação controlada; a ausência de assinatura e de homologação humana do instalador ainda impede o lançamento comercial.
