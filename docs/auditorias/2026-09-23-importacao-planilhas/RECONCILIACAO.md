# Reconciliação

> **Complemento final:** [RETESTE-FINAL-2026-09-25.md](RETESTE-FINAL-2026-09-25.md). Quatro projetos problemáticos: 4 pendências, 0 confirmações e 0 projetos persistidos. Clientes/Contatos parciais passaram pela UI, 3 linhas cada (1 criada, 2 rejeitadas), com `import_rows` e IDs conciliados; Projeto duplicado foi bloqueado na prévia. Na API, lotes de 4 linhas deram Clientes 2/2, Contatos 2/2 e Projetos 1/3 (criados/falhos), com `updated=0`, histórico, auditoria e outbox conferidos. Diferenças de contagem e financeiras = 0 nos casos executados. A matriz completa das seis classes em todas as camadas ainda não foi fechada.

> **Atualização de 25/09/2026:** [RETESTE-2026-09-25.md](RETESTE-2026-09-25.md) contém os resultados mais recentes e prevalece sobre contagens ou pendências antigas abaixo. A decisão atual é **NÃO IMPORTAR DADOS REAIS ATÉ CORRIGIR E RETESTAR**.

## Complemento de reconciliação — 25/09

### Lotes parciais da API real em banco descartável

Cada célula abaixo foi confrontada com `import_rows` e com o histórico GET do respectivo run. Os hashes dos seis corpos JSON enviados, as respostas HTTP e os runs estão em [RETESTE-FINAL-2026-09-25.md](RETESTE-FINAL-2026-09-25.md). `Atualizado=0` nas três entidades: repetir uma chave existente causou rejeição e preservou o registro anterior.

| Entidade | Linha física | Entrada sintética | Esperado e observado | Efeito SQLite |
|---|---:|---|---|---|
| Clientes | 2 | Cliente 1 válido | sucesso | criado; ID usado na FK do Projeto 1 |
| Clientes | 3 | CPF repetido | falha | nenhum cliente novo |
| Clientes | 4 | CPF inválido | falha | nenhum cliente novo |
| Clientes | 5 | Cliente 2 válido | sucesso | criado |
| Contatos | 2 | Contato 1 válido | sucesso | criado |
| Contatos | 3 | e-mail repetido | falha | nenhum contato novo |
| Contatos | 4 | nome/e-mail inválidos | falha | nenhum contato novo |
| Contatos | 5 | Contato 2 válido | sucesso | criado |
| Projetos | 2 | Projeto 1 com Cliente 1 | sucesso | criado com `cliente_id` correto |
| Projetos | 3 | nome de projeto repetido | falha | nenhum projeto novo |
| Projetos | 4 | referência de cliente inexistente | falha | nenhum projeto novo |
| Projetos | 5 | nome vazio | falha | nenhum projeto novo |

Contagens: Clientes 2/2, Contatos 2/2, Projetos 1/3 (criados/falhas), diferença 0; outbox com 2 operações de cliente e 1 de projeto, e auditoria INSERT para as três entidades. Não houve valores financeiros nas entradas, diferença 0 centavos. Pela interface, Clientes e Contatos tiveram uma linha criada e duas falhas cada, também confrontadas com `import_rows`; a duplicata de Projeto bloqueou a confirmação. Outras combinações por linha e telas consumidoras não foram homologadas.

| Caso | Entrada e linha de origem | Persistência e relação | Diferença |
|---|---|---|---:|
| Contato CSV BOM/multiline | 1 registro, linha física 3 | Contato com observação multilinha; `import_rows.row_number=3` | 0 na contagem |
| Associação manual | 2 clientes homônimos e 1 projeto | Projeto vinculado a um dos dois IDs; `import_rows.association_method=manual` | 0 na contagem |
| Migração completa CSV | 2 linhas de dados, origem [2,4] | 2 clientes, 2 propriedades, 2 projetos, FKs verificadas | 0 |
| Migração completa XLSX | 2 linhas de dados, origem [2,3] | 2 clientes, 2 propriedades, 2 projetos, FKs verificadas | 0 |

Oráculo independente das duas linhas em ambos os formatos: orçamento/faturamento **483.000 centavos** cada, despesa **80.500**, receita histórica **460.000** e custo histórico **276.000**. As métricas financeiras confrontadas tiveram diferença **0 centavos**. Receita e custo históricos são snapshot e não foram materializados como recebimentos ou despesas. IDs das execuções descartáveis foram consultados no teste e o banco foi removido pelo executor; não são IDs do banco padrão.

| Entidade | Arquivo | Prévia/UI | API | Banco | Consumidor | Diferença |
|---|---:|---:|---:|---:|---:|---:|
| Contato sintético | 1 | Resultado 1 | Importação concluída | Persistência inferida pela API real; ID não capturado | 1 lead visível em CRM | 0 na contagem observada |
| Contato XLSX sintético | 1 | Resultado 1 | Importação concluída | Persistência inferida pela API real; ID não capturado | 1 lead visível em CRM | 0 na contagem observada |
| Contato com cabeçalho parcial | 1 | Escolha manual e resultado 1 | Importação concluída | Persistência inferida pela API real; ID não capturado | 1 lead visível em CRM | 0 na contagem observada |
| Contato XLSX com cabeçalho parcial | 1 | Escolha manual e resultado 1 | Importação concluída | Persistência inferida pela API real; ID não capturado | 1 lead visível em CRM | 0 na contagem observada |
| Cliente simples | 1 | Resultado 1 | Run `completed` | 1 (`4e5968b2…`), CPF e telefone sintéticos verificados | Vínculo com projeto conferido | 0 |
| Projeto simples | 1 | Associação automática | Run `completed` | 1 (`b78637b6…`), `cliente_id=4e5968b2…` | Visível em Projetos | 0 |
| Cliente de migração | 1 | 1 novo | Run concluído com avisos | 1 (`3bd15363…`) | Cadastro visível em Clientes | 0 |
| Propriedade | 1 | 1 | Run concluído | 1 (`f46481bf…`), ligada ao cliente | Relação verificada no SQLite | 0 |
| Projeto de migração | 1 | 1 | Run concluído | 1 (`ccbf9126…`), ligado ao cliente e propriedade | Relação verificada no SQLite | 0 |
| Orçamento e item | 1 cada | 1 orçamento | Run concluído | 1 orçamento (`b8dbc9de…`) e 1 item; total 210.000 centavos; item 2 × 100.000 = 200.000 | Relação verificada no SQLite | 0 centavos no total |
| Faturamento/nota | 1 | 1 | Run concluído | 1 (`63e4b426…`), valor 210.000 centavos e orçamento correto | Relação verificada no SQLite | 0 centavos |
| Despesa | 1 | 1 | Run concluído | 1 (`6c3dee00…`), valor 35.000 centavos | Relação verificada no SQLite | 0 centavos |
| Recebível e recebimento | 0 transacional na fixture | 0 | Nenhum criado | 0 em `parcelas` e `recebimentos` para o orçamento | Não conferido em tela | 0 |

Run final `891f47f4-3bb9-4b7a-8262-578668f2fdde`, hash de origem `9ebbcf8b1d8c13038f2fddab80eb1563a6347ac50044a269ea4745f55307f3ca`, estado `completed_with_warnings`, `imported_count=7`. O ledger preservou receita histórica de 200.000, custo de 120.000, despesas de 35.000 e receita realizada de 0 centavos como snapshot. IDs completos constam da saída sanitizada registrada em [COMANDOS-E-RESULTADOS.md](COMANDOS-E-RESULTADOS.md). O banco E2E foi removido pelo executor após aprovação. Outros cenários financeiros permanecem indeterminados.
