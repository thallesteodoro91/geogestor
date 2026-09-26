# Matriz de cobertura desta rodada

> **Complemento final:** ver [RETESTE-FINAL-2026-09-25.md](RETESTE-FINAL-2026-09-25.md) para SHA-256 e resultado de cada fixture nova. CSV inválido, extensão/conteúdo, ZIP protegido/truncado/expansivo, XML inválido, XSS, 20 MiB/20 MiB + 1 byte, associação dos quatro estados de cliente, lotes parciais de Clientes/Contatos e larguras 360/768/1024/1440 px passaram na UI isolada. API conciliou 4 linhas por entidade, inclusive Projetos; uma duplicata de Projeto foi bloqueada na prévia UI. Arquivo semanticamente válido de 20 MiB, volumetria máxima UI, medidas separadas por fase, reinício de worker e instalação atual continuam **sem prova**. A recomendação permanece **NÃO IMPORTAR DADOS REAIS ATÉ CORRIGIR E RETESTAR**.

> **Atualização de 25/09/2026:** [RETESTE-2026-09-25.md](RETESTE-2026-09-25.md) contém os resultados mais recentes e prevalece sobre contagens ou pendências antigas abaixo. A decisão atual é **NÃO IMPORTAR DADOS REAIS ATÉ CORRIGIR E RETESTAR**.

## Complemento verificado em 25/09

| Caso | Resultado | Prova |
|---|---|---|
| Ledger completo legado sem hash de conteúdo | Bloqueado | Prévia e commit direto HTTP 409; sem novo ledger, banco descartável |
| Cabeçalho linhas 1/2/6/20, vazio/duplicado | Passou em unidade | Escolha manual obrigatória e numeração física |
| Cabeçalho linha 21 | Passou em E2E | Alerta orientado, sem confirmação |
| Troca de arquivo e seleção por teclado | Passou em E2E | Prévia anterior invalidada em CSV/XLSX |
| CSV BOM, `;`, aspas, multiline, linha vazia | Passou em unidade e E2E focal | Contato persistido com origem na linha 3 |
| XLSX corrompido | Passou em E2E | Recusa antes de gerar prévia |
| Projetos com clientes homônimos | Passou em E2E | Seleção manual, FK e `association_method=manual` |
| Migração de duas linhas CSV/XLSX | Passou em E2E | 2 clientes, 2 projetos, 2 propriedades, centavos e FKs conciliados |
| 25 MiB/25 MiB+1 byte | Passou em API isolada | Corpo no limite chegou ao schema; acima recebeu 413 |
| 300/301 colunas; 20.000/20.001 linhas; 20.000/20.001 caracteres | Passou em API isolada | Limite aceito, acima recusado |
| 499/500/501 contatos | Passou em API isolada | Dois primeiros aceitos; 501 rejeitado |
| Cache de esquemas corrompido | Passou em E2E | Área administrativa permaneceu funcional |
| Esquema com cache ausente/corrompido após recarga | Passou em E2E | Valor confirmado no SQLite e recuperado na listagem após desbloqueio |
| Nome de arquivo com caminho/extensão inválida | Passou em integração API | `../`, barra invertida, unidade Windows e `.txt` receberam 400 |
| Chaves reservadas em cabeçalho, linha e mapeamento | Passou em integração API | `__proto__`/`constructor` recusados antes da prévia; protótipo global intacto |
| `skygeo.xlsx` fornecida para testes | Passou em integração isolada com opt-in | 64 colunas, 73 linhas; 10 agregados coincidem com ledger; hash diferente do arquivo `skygeo_revisada.xlsx` |
| ZIP/XML expansivo, XSS na UI, reinício, zoom e medidas máximas UI | **Não executado** | Não inferir aprovação |

| ID | Modo | Formato/etapa | Controle | Situação | Evidência |
|---|---|---|---|---|---|
| IMP-01 | Simples | CSV/arquivo | UTF-8 sem BOM, uma linha | Aprovado | E2E real 1/1; SHA-256 no inventário |
| IMP-02 | Ambos | CSV/cabeçalho | Coluna de cabeçalho vazia seguida de dados completos | Aprovado após escolha manual | Auto detecção ainda sugere índice 1; usuário escolhe índice 0 antes da prévia; E2E Contatos e completa 2/2 |
| IMP-03 | Simples | CSV/Contatos | Mapeamento `Nome` e `Email`, confirmação e listagem | Aprovado | E2E real 1/1 |
| IMP-03X | Simples | XLSX/Contatos | Duas abas, título acima do cabeçalho, confirmação e listagem | Aprovado | E2E real 1/1 |
| IMP-03Y | Simples | XLSX/Contatos | Cabeçalho parcial, escolha manual, confirmação e listagem | Aprovado | E2E real 1/1 |
| IMP-04 | Simples | Contatos/API | 500 linhas e idempotência/concorrência | Aprovado no teste isolado | Integração 1/1 |
| IMP-05 | Simples | Clientes e Projetos | Banco e vínculo sob falha | Parcial | Integração de projetos 1/1; unidade de associação 5/5; sem UI real nesta rodada |
| IMP-05R | Simples | Resultado | Zero sucesso e importação parcial | Aprovado em unidade | Resultado simples 2/2 |
| IMP-05E | Simples | CSV/Clientes/Projetos | Cliente ativo com números no nome e projeto por nome exato | Aprovado após correção | E2E real 1/1; dois runs `completed`; FK conferida no SQLite |
| IMP-06 | Completa | Prévia/worker | Mesmo hash após nome diferente | Aprovado após correção | Integração 1/1; `already_imported` |
| IMP-07 | Completa | API/arquivo | Replay com `fileHash` adulterado | Aprovado após correção para novas execuções | Prévia `already_imported` e commit direto revertido; bytes originais ainda não chegam à API |
| IMP-08 | Ambos | Histórico/CSV | Fórmulas em células exportadas | Aprovado após correção | Asserções `=`, `+`, `-`, `@` |
| IMP-09 | Completa | Histórico/erro | Erro interno com e-mail sintético | Aprovado após correção | Asserção de ausência no histórico |
| IMP-10 | Simples | Esquemas/cache | JSON inválido e itens inválidos | Aprovado em unidade | 2 testes |
| IMP-11 | Completa | XLSX | Datas nativas, limites e conteúdo hostil | Não executado | Fixture simples não cobre esses casos |
| IMP-12 | Completa | Finanças | Oráculo por linha e centavos | Parcial | 1 linha; orçamento, nota e despesa com diferença 0; demais cenários pendentes |
| IMP-15 | Completa | CSV/worker/banco | Cliente, propriedade, projeto, orçamento, item, nota e despesa | Aprovado no caso sintético | E2E real 1/1; IDs e relações no caderno |
| IMP-13 | Ambos | UI/acessibilidade | Teclado na confirmação | Parcial | E2E real; restante da matriz não executado |
| IMP-14 | Ambos | Limites | 20 MiB, 25 MiB, 20.000 linhas, 300 colunas | Parcial | Frontend em unidade; API rejeitou 301 colunas, 20.001 linhas e célula de 20.001 caracteres com HTTP 400; limites exatos e arquivo grande não exercitados |

Uma matriz por campo e por entidade ainda é necessária para homologação. As regras de campo permanecem rastreadas no código indicado em [MAPA-DO-PIPELINE.md](MAPA-DO-PIPELINE.md), sem alegação de cobertura integral.
