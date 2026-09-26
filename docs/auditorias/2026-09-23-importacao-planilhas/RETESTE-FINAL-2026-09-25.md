# Reteste final complementar — 25/09/2026

**Decisão geral: NÃO IMPORTAR DADOS REAIS ATÉ CORRIGIR E RETESTAR.** Esta campanha usou exclusivamente bancos, perfis, pastas e entradas sintéticas. O banco padrão identificado pelo código é `data/geogestor.db` quando `GEOGESTOR_DB_PATH` não está definido. O executor E2E definiu explicitamente `GEOGESTOR_DB_PATH=<scratch/commercial-e2e/run-.../specs/.../geogestor.db>` e pasta de documentos própria para cada spec. O banco padrão tinha 2.449.408 bytes e mtime UTC `2026-09-23 21:03:10` antes e após os ensaios. Nenhuma planilha pessoal foi aberta nesta campanha.

## Mudanças verificadas

- CSV é decodificado com UTF-8 estrito. Extensão CSV com assinatura ZIP é recusada; XLSX sem estrutura ZIP/OOXML é recusado.
- Antes de descompactar XLSX, o frontend lê o diretório central e recusa arquivo criptografado, ZIP64, mais de 2.048 entradas, entrada acima de 32 MiB e soma expandida acima de 64 MiB. XML inválido recebe mensagem orientada sem erro interno do parser.
- A barreira de arquivo é 20 MiB no frontend; a prévia completa da API tem corpo máximo de 25 MiB. A razão de expansão ZIP é limitada a 1.000:1 por entrada. Esses são limites de tamanho e expansão, não uma medição de pico de memória ou um cancelamento temporal do parser; por isso desempenho e resistência a entradas hostis maiores não foram homologados.
- Células acima de 20.000 caracteres são barradas antes de montar a prévia. O primeiro E2E de 20 MiB exatos revelou que uma célula gigante chegava ao mapeamento e dificultava continuar; após a correção, os dois lados do limite passaram.
- A descrição da etapa futura recebeu contraste maior. A tabela de prévia rolável recebeu nome e foco por teclado. A regra de escolha manual de cabeçalho ambíguo foi preservada.
- A fixture de homônimos foi isolada de outra fixture com CPF idêntico e normalizada para LF. O teste com API simulada foi corrigido para ler o corpo `{rows, sourceRowNumbers}` efetivamente enviado; isso não é uma correção do produto.

## Entradas sintéticas e resultado observado

As entradas hostis foram geradas em memória pelo E2E; seus bytes não são dados do usuário. `—` em API/ID significa que o frontend recusou antes de enviar a prévia. As entradas rejeitadas não alteraram contagens ou valores financeiros. Os casos de clientes/projetos criados não continham valores financeiros; diferença financeira = 0 centavos.

| Entrada | SHA-256 | Bytes | Esperado e observado | API/ID/estado final |
|---|---|---:|---|---|
| UTF-8 inválido `.csv` | `489015f4eeed36825264ca19d0cc419a7ec45b0b4d91b29b596c72fe2ee21065` | 6 | Recusa UTF-8; recusado | —; 0 linhas |
| XLSX usado como `.csv` | `b2633de1dd65bb5ba4bc87379fdbcfadc851a32a71876f4b9194911e35de1340` | 5.458 | Recusa por extensão/conteúdo; recusado | —; 0 linhas |
| Texto usado como `.xlsx` | `2c2804d4fd43f75f1ab7b09f5b2744769e7da4668e9fe3676505992ed29f6438` | 10 | Recusa por extensão/conteúdo; recusado | —; 0 linhas |
| XLSX com flag de criptografia | `17161e6080a0d7398cec538082d605440838615c6c897285556b63196b3d58be` | 5.458 | Recusa de arquivo protegido; recusado | —; 0 linhas |
| ZIP truncado | `f8dbc61cf272bd78e5d8094944ca0690c413e3c7a942b85d3081505dc50bae92` | 5.453 | Recusa de estrutura; recusado | —; 0 linhas |
| Entrada ZIP declarada com 65 MiB expandidos | `aaddd185d466c5a2a21b30c24cbb91ba7044686f1fe029a517fa24937838adf8` | 5.458 | Recusa antes de descompactar; recusado | —; 0 linhas |
| `xl/workbook.xml` malformado | `8cb8e8af8e9ae95642984be843b964667e273cebf3469bc2b4a045f9c1113779` | 5.185 | Mensagem de XLSX ilegível; recusado | —; 0 linhas |
| CSV de exatamente 20 MiB, uma célula acima de 20.000 caracteres | `d2c9e0e3bfb34db1d3ca7a1b74b413de3eaf4773b71ca8b15ab1ab75eb1fd852` | 20.971.520 | Passa limite de arquivo, falha limite de célula; observado | —; 0 linhas |
| Mesmo CSV acrescido de um byte | `3bae04e596c56484897b34c383aea35ab5afb28a650ec2f9907c238feb3f738f` | 20.971.521 | Recusa no limite de arquivo; observado | —; 0 linhas |
| Quatro referências de projeto, HTML e fórmula hostis | `470f3050294685b5c2cbef344f7007015e60fc69a2f3b05e4c4d39a791c1d2ee` | 190 | Inexistente, inativo, excluído e homônimo exigem ação; 4 pendentes, 0 projetos gravados; HTML e `=1+1` mostrados como texto, script não executado | Prévia HTTP 200, `total=4`, `missing=3`, `ambiguous=1`; confirmação desabilitada; sem importId |
| Dois clientes homônimos | `fa3bdf82c21c06dad191e6f52af2d19e34662b4e26f4ec8224ff5eec66903d15` | 167 | Dois clientes criados e escolha manual do vínculo no E2E isolado | IDs descartáveis validados no SQLite e histórico; 1 projeto vinculado |
| Cliente parcial: válido, duplicado e CPF inválido | `1635f2df8cde2d812e3c1d4803aaec5260840c7636f59e550d68fb8cce1fbf28` | 160 | 3 linhas: 1 criada, 2 rejeitadas; diferença de contagem 0 | POST HTTP 201, run `124cd7cd-f657-4654-9887-68b082898569`; linhas 2/3/4 sucesso/falha/falha; ID `7d52930b-4aa4-4b96-ae0e-7a2921a2dd74` igual em resposta/SQLite |
| Contato parcial: válido, e-mail duplicado e inválido | `72192e69d6fd9a7565e52a1a7a7455d3177b5d3872e4f25eabb91696b7be2b1c` | 99 | 3 linhas: 1 criada, 2 rejeitadas; diferença de contagem 0 | POST HTTP 201, run `cc39e9fe-0082-4660-a36c-413e32f4081c`; linhas 2/3/4 sucesso/falha/falha; ID `de4265f0-2b2c-4959-b421-d3750bf6093b` igual em resposta/SQLite |
| Projeto duplicado no mesmo lote | `a438fa746d7e3615dce52fb77a51710373199435ba111f4decda885f1005078e` | 83 | Prévia barra confirmação; 0 projetos persistidos | Prévia HTTP 200, sem run de confirmação nem ID |
| API Clientes, 4 linhas, JSON UTF-8 enviado | `a31a22977544f9549cb652896d9601769ff8c5108907f9e24b5a9270fea1509c` | 412 | 2 criados, 2 falhas; observado | HTTP 201, run `34ddaf02-0f5a-4b9d-873b-92ceb636a433`; linhas 2/3/4/5 sucesso/falha/falha/sucesso |
| API Cliente existente, tentativa de alteração | `789832af4f3fd9b350e9ebf84cea5b292739a8b2a70262d6a2dc628771af3b97` | 146 | 0 atualizados, 1 rejeitado; observado | HTTP 201, `status=failed`; original preservado |
| API Contatos, 4 linhas, JSON UTF-8 enviado | `dd70e5682521818f0285a69e79569605c5d194bfc7fb554cd510002cc078d6e7` | 256 | 2 criados, 2 falhas; observado | HTTP 201, run `725a0db5-71ed-43a0-99de-5ed4be21e11b`; linhas 2/3/4/5 sucesso/falha/falha/sucesso |
| API Contato existente, tentativa de alteração | `853a09a3b99f97d5c68b52166562a221d28b8a13999d28b47d67b6e41605b4cf` | 112 | 0 atualizados, 1 rejeitado; observado | HTTP 201, `status=failed`; original preservado |
| API Projetos, 4 linhas, JSON UTF-8 enviado | `376152855bc5d5c0736a99cedc0e31624d00ed56516ac1cbed194f9d5b90d0d5` | 309 | 1 criado, 3 falhas; observado | HTTP 201, run `b03dd7d7-cf9a-4207-9162-b18c71678ec4`; linhas 2/3/4/5 sucesso/falha/falha/falha; FK do cliente verificada |
| API Projeto existente, tentativa de alteração | `5efd2e166c3e91a0b8fa74a662c021508ba102f21940df2bfffb76bd3fe53ed2` | 104 | 0 atualizados, 1 rejeitado; observado | HTTP 201, `status=failed`; original preservado |

O teste de 20 MiB prova os dois lados da barreira de **tamanho do arquivo**, sem provar aceitação ou desempenho de um arquivo de 20 MiB semanticamente válido. Na API, o reteste anterior já aceitara corpo de 25 MiB até a validação e recusara 25 MiB + 1 byte com HTTP 413; 300/301 colunas, 20.000/20.001 linhas, 20.000/20.001 caracteres e 499/500/501 contatos também foram verificados apenas no escopo descrito em `RETESTE-2026-09-25.md`.

## Integridade e uso cotidiano

- Associação pela UI/API/SQLite: as quatro referências problemáticas mantiveram a confirmação bloqueada; a busca ofereceu dois homônimos ativos e nenhum cliente inativo ou excluído. Nenhum projeto da fixture foi encontrado no SQLite. A seleção manual anterior de homônimos foi repetida com dois IDs de cliente e FK/histórico conferidos.
- Lotes parciais pela UI: Clientes e Contatos retornaram HTTP 201 e `status=partial`, 3 linhas lidas, 1 criada, 0 atualizadas e 2 rejeitadas cada. Os resultados por linha 2/3/4 coincidiram com `import_rows` no SQLite; os IDs criados aparecem na tabela acima. O lote de Projetos com duplicata foi recusado na prévia HTTP 200, sem confirmação, histórico ou projeto gravado.
- Reconciliação direta na API real com banco descartável: Clientes 4 linhas, 2 criadas/2 falhas; Contatos 4, 2/2; Projetos 4, 1/3, com FK correta. Os três retornaram `partial`, HTTP 201, `updated=0`; tentativas de atualizar registro existente por chave duplicada foram rejeitadas, não atualizadas. `import_rows`, histórico GET, 3 operações de filesystem (2 clientes, 1 projeto) e logs de INSERT foram conferidos. Os runs e hashes da última execução constam da tabela. Diferença de contagem e financeira: 0 nos casos exercitados. Essa prova de API não substitui os percursos UI faltantes.
- O reteste de integração da API passou **3/3**: prévia, replay, concorrência simples, histórico, limites, rollback por falha de auditoria, vínculo de projeto e migração sintética. A migração CSV/XLSX de duas linhas manteve diferença financeira de **0 centavos** nos totais já documentados. Esses testes não simulam reinício do processo em fila nem concorrência multiprocesso.
- Configuração inicial/desbloqueio e ciclo de cadastro de Cliente pela UI passaram **2/2** em bancos separados. Backup completo, restauração do banco e arquivos sintéticos passaram **1/1** na integração, duração 42,5 s; métricas do teste: backup 3.758,04 ms, teste isolado 4.877,71 ms, restaurações A/B 3.910,85/10.596,49 ms e RPO observado 9.371 ms. Isso não prova instalação atual ou restauração física do aplicativo empacotado.
- Quatro larguras na tela de mapeamento: `360/360`, `768/768`, `1024/1024`, `1440/1440` pixels de viewport/scroll horizontal. Zoom CSS de 200% em 1440 px resultou em `1440/1440`; é aproximação, não zoom nativo. Após as correções, axe reportou **0 violações** nesse percurso; leitor de tela, foco/anúncios de todos os estados, contraste de todas as telas e zoom nativo não foram comprovados.
- A regressão final completa da spec de importação passou **25/25 em 2,4 minutos**. Typecheck API/web e lint web terminaram com código 0; lint API teve código 0 e 78 avisos sem erro. `git diff --check` da mudança teve código 0. Na última execução, a migração de uma linha gerou run descartável `a5d1f850-4858-41f1-b0a2-832a7642f4b5`, cliente `3d54d42f-5cf3-4921-b5f1-78f359a3ea89`, projeto `c46ce946-5b23-4d3f-94dc-306389937e0c`, orçamento `bc3763ca-7238-433d-999e-7cef8d21f754`, nota `3f5a33fa-015f-4233-bf2e-36d4c84565f3` e despesa `4b7340bd-04d8-497e-86ff-6fab8ea107c8`; orçamento/nota 210.000 centavos e despesa 35.000, diferença 0.

## Comandos desta campanha

Executados na raiz do repositório com Node 24.17.0 e pnpm 11.8.0:

| Comando | Resultado |
|---|---|
| `apps/api/node_modules/.bin/tsx.cmd --test apps/web/src/pages/Importacao/fullMigration.test.ts` | 13/13 após a correção de célula; saída 0 |
| `node scripts/run-commercial-e2e.mjs importacao-associacao-manual.spec.ts` | 25/25, 2,4 min, saída 0; executor isolou e removeu o banco/perfil do run aprovado |
| `node scripts/run-commercial-e2e.mjs importacao-associacao-manual.spec.ts --grep 'matriz hostil\|interface bloqueia associação'` | 2/2 após fixar o timestamp do ZIP malformado e conferir HTTP 200/contagens da prévia; saída 0 |
| `apps/api/node_modules/.bin/tsx.cmd --test --test-force-exit apps/api/src/import-backend-reliability.integration.test.ts apps/api/src/full-spreadsheet-import.integration.test.ts apps/api/src/project-import-association.integration.test.ts` | 3/3; saída 0 |
| `apps/api/node_modules/.bin/tsx.cmd --test --test-force-exit apps/api/src/simple-import-reconciliation.integration.test.ts` | 1/1, 11,3 s; 4/4/4 linhas e IDs reconciliados por entidade; saída 0 |
| `node scripts/run-commercial-e2e.mjs importacao-associacao-manual.spec.ts --grep 'lotes parciais de Clientes e Contatos'` | 1/1; 20,4 s totais, 11,6 s Playwright; UI/API/SQLite e IDs; saída 0 |
| `node scripts/run-commercial-e2e.mjs setup-initial.spec.ts session02-clients.spec.ts --grep 'configuração inicial\|persistência, edição'` | 2/2, saída 0; bancos distintos por spec |
| `apps/api/node_modules/.bin/tsx.cmd --test --test-force-exit apps/api/src/backup-restore.integration.test.ts` | 1/1; 42,5 s; saída 0 |
| `pnpm --filter api typecheck`; `pnpm --filter web typecheck`; `pnpm --filter web lint`; `pnpm --filter api lint`; `git diff --check -- <arquivos da mudança>` | código 0; API lint com 78 avisos sem erro; sem erro de tipo ou whitespace |

## Decisões independentes

| Área | Decisão para dados reais | Justificativa |
|---|---|---|
| Uso cotidiano sem importação | **Ainda não liberado neste reteste como instalação final** | Abertura web, autenticação, cadastro/consulta e backup/restauração sintéticos passaram, mas não existe teste deste código como candidato instalado atual, com restauração física de perfil descartável. Cadastro manual é o menor caminho após essa verificação; não depende do importador. |
| Importação simples — Clientes | **Não liberada** | Parcial/duplicata/inválido passaram pela UI, e a API confirmou 4 linhas, histórico, auditoria e outbox. Atualização foi rejeitada pelo contrato (`updated=0`), mas faltam volume máximo UI, consumidores e operação no candidato instalado. |
| Importação simples — Projetos | **Não liberada** | Bloqueios de inexistente/inativo/excluído e escolha manual de homônimo passaram; API conciliou 4 linhas e FK. A UI bloqueou um lote com duplicata na prévia; matriz de rejeições e parcelas, consumidores e outbox pela UI ainda incompleta. |
| Importação simples — Contatos | **Não liberada** | Parcial/duplicata/inválido passaram pela UI e API confirmou 4 linhas, histórico e auditoria; atualização foi rejeitada (`updated=0`). Máximo de 500 pela UI, consumidores, reinício e instalação permanecem sem prova. |
| Migração completa | **Bloqueada** | O ledger completo legado do banco padrão não tem impressão digital de conteúdo verificável. O arquivo original confiável não está disponível nesta campanha; nenhum hash foi inventado, nenhum ledger retropreenchido e nenhuma dispensa automática criada. Além disso, reinício de worker, falhas entre entidades, volumes máximos UI e medições por fase continuam pendentes. |

## Cenários não concluídos

Ainda faltam: reconciliação exaustiva das seis classes por linha e em todas as camadas de cada cadastro; confirmação concorrente da migração completa em processos separados; prévia completa alterada, expirada e reutilizada pela interface; falha injetada entre cada entidade; reinício real da API em fila/processamento e persistência dos esquemas após esse reinício; arquivo semanticamente válido de 20 MiB e 20.000 linhas/300 colunas/500 contatos pela UI; leitura, parsing, hashing, prévia, processamento, memória e disco medidos separadamente; instalação atual e restauração física; zoom nativo e leitor de tela. Os testes aprovados anteriores não foram convertidos em aprovação desses itens.

**Recomendação geral: NÃO IMPORTAR DADOS REAIS ATÉ CORRIGIR E RETESTAR.**
