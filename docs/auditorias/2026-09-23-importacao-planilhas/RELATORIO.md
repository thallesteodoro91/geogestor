# Auditoria especializada — importação de planilhas

> **Decisão final desta campanha:** [RETESTE-FINAL-2026-09-25.md](RETESTE-FINAL-2026-09-25.md) contém resultados e três decisões independentes. **NÃO IMPORTAR DADOS REAIS ATÉ CORRIGIR E RETESTAR.** Cadastro manual após homologar o candidato instalado e sua recuperação é o menor caminho seguro para iniciar sem depender da importação. O bloqueio da migração legada foi mantido.

> **Atualização de 25/09/2026:** [RETESTE-2026-09-25.md](RETESTE-2026-09-25.md) contém os resultados mais recentes e prevalece sobre contagens ou pendências antigas abaixo. A decisão atual é **NÃO IMPORTAR DADOS REAIS ATÉ CORRIGIR E RETESTAR**.

**Resultado: REPROVADA para importação de dados reais.** Esta rodada comprovou e corrigiu defeitos específicos, mas não executou a matriz integral do roteiro. Ausência de ensaio não foi convertida em aprovação.

## Decisões independentes

| Decisão | Estado | Evidência ou lacuna |
|---|---|---|
| CSV | PARCIAL | BOM, `;`, aspas, multiline e linhas vazias passaram nos casos executados; contato com origem física 3 e migração de duas linhas passaram pela UI real. Encoding inválido e limites em arquivo real pendentes. |
| XLSX | PARCIAL | Duas abas, tipos nativos e migração de duas linhas passaram pela UI/SQLite; arquivo corrompido foi recusado. ZIP/XML hostil e limites pendentes. |
| Clientes simples | PARCIAL | Cliente simples e dois homônimos foram importados em bancos isolados; faltam atualização, rejeição e parcial por linha. |
| Projetos simples e vínculos | PARCIAL | Associação automática e manual entre homônimos passaram pela UI real, FK e histórico; faltam cliente inativo, excluído e inexistente na UI. |
| Contatos simples | PARCIAL | CSV, XLSX, cabeçalho parcial e BOM/multiline passaram; API aceitou 499/500 e recusou 501. Faltam variantes por linha. |
| Migração completa | BLOQUEADA NO BANCO ATUAL | CSV e XLSX de duas linhas foram conciliados. O usuário confirmou que o ledger antigo é de uma importação de teste; o bloqueio 409 persiste nesse banco. Um banco limpo separado evita esse ledger, mas a matriz de liberação real segue incompleta. |
| Esquemas | PARCIAL | SQLite confirmado como fonte autoritativa; cache ausente/corrompido recuperado após recarga. Reinício da API ainda pendente. |
| Histórico, linhas e CSV de erros | PARCIAL | Linha física preservada nos casos executados e fórmula neutralizada; inspeção de todas as entidades e download pela UI pendentes. |
| Atomicidade, idempotência, concorrência e recuperação | PARCIAL | Replay e commit direto barrados; faltam reinício, concorrência multiprocesso e falhas entre entidades. |
| Segurança e privacidade | BLOQUEADA | XLSX corrompido recusado; API rejeita metadados com caminho e chaves reservadas. ZIP/XML hostil e XSS na UI pendentes. |
| UX e acessibilidade | BLOQUEADA | Cabeçalho e associação manual por teclado passaram; matriz de zoom, larguras, contraste e anúncios pendente. |
| Prontidão geral | REPROVADA | Matriz de importação real incompleta; o único ledger antigo identificado foi confirmado pelo usuário como teste. **NÃO IMPORTAR DADOS REAIS ATÉ CORRIGIR E RETESTAR.** |

## Cobertura desta rodada

- Seis fixtures adicionais foram preservadas com SHA-256 em [INVENTARIO-DE-ARQUIVOS.md](INVENTARIO-DE-ARQUIVOS.md). CSV e XLSX de duas linhas foram reconciliados contra [oráculo independente](evidencias/oraculo_multilinha.py): orçamento/faturamento **483.000**, despesa **80.500**, receita histórica **460.000** e custo histórico **276.000 centavos**, diferença **0** nas métricas confrontadas.
- 210/210 testes web e 9/9 testes API relevantes passaram; retestes E2E tiveram 4/4 e 2/2. Typecheck API/web, lint web e build E2E passaram; lint API anterior passou com 78 avisos sem erro.
- API isolada aceitou 300 colunas, 20.000 linhas, célula de 20.000 caracteres e 499/500 contatos; rejeitou os valores imediatamente acima. Corpo 25 MiB chegou ao schema; 25 MiB + 1 byte recebeu 413. Limite de 20 MiB no frontend passou em unidade, sem ensaio de arquivo real nesse tamanho.
- Banco e perfil E2E eram descartáveis. O banco padrão permaneceu com 2.449.408 bytes e mtime UTC `2026-09-23T21:03:10.8920636Z`. Nenhum registro real foi importado.

## Ambiente e limites da evidência

GeoGestor 1.0.4, commit base `a16551a`, Windows, Node 24.17.0, pnpm 11.8.0, React/Vite, Fastify, SQLite/libSQL, Papa Parse 5.5.4 e `read-excel-file` 9.2.0. A árvore de trabalho já tinha alterações extensas antes desta auditoria; foram preservadas. O banco padrão `data/geogestor.db` tinha 2.449.408 bytes e última alteração às 18:03:10 de 23/09/2026; não foi usado nos testes mutáveis. O acesso opcional do teste de integração a um workbook pessoal foi protegido por opt-in explícito; a execução desta campanha rodou somente o ramo sintético.

Os relatórios anteriores obrigatórios foram consultados como linha de base, especialmente a Sessão 14. Suas aprovações não foram herdadas. Este relatório registra somente o que foi revalidado aqui.
