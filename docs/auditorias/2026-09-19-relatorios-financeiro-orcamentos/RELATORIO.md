# Auditoria especializada — relatórios financeiro e de projetos e propostas em PDF

Data de execução: 19/09/2026  
Base auditada: `main` em `a16551a8b63e73f42d826297df893488e5ab88ca`  
Versão declarada: 1.0.4  
Ambiente: Windows, Node.js 24.17.0, pnpm 11.8.0, Electron 35.7.5, Chromium/Playwright pelo executor comercial do projeto e pdfmake.

## Parecer executivo

**Resultado geral: APROVADA COM RESSALVAS.**

Os cálculos financeiros, os agregados gerenciais, a geração e o download de documentos e a consistência visual ficaram comprovados em banco SQLite isolado, API real, interface real e arquivos PDF reais. Foram gerados sete PDFs, totalizando 45 páginas; cinco deles vieram do fluxo completo da interface e dois do gerador real com 100 itens para estresse de paginação. Todos abriram em parser estrito, renderizaram integralmente, tinham tamanho A4, texto extraível, ausência dos marcadores internos semeados e ausência de conteúdo ativo.

Foi encontrado e corrigido um defeito P2: o fluxo de proposta anunciava sucesso antes de o `download()` assíncrono terminar e não propagava sua falha. O teste de regressão reproduziu a falha antes da correção e passou depois dela.

As ressalvas não invalidam os cálculos ou a legibilidade visual, mas impedem declarar conformidade plena: os PDFs não são marcados/estruturados, não possuem idioma nem título no catálogo/metadados; o diálogo nativo de impressão e a leitura física com tecnologia assistiva não puderam ser automatizados neste ambiente; e os dois documentos de 100 itens foram exercitados diretamente pelo gerador real, enquanto os documentos de tamanho normal foram obtidos pela interface.

## Resultados por componente

| Componente | Resultado | Fundamentação |
|---|---|---|
| Relatório financeiro | Aprovado com ressalvas | API, tela, impressão CSS e PDF reconciliados; R$ 100,00 contratado, R$ 40,00 recebido, R$ 60,00 pendente/vencido, R$ 54,00 pago, caixa de −R$ 14,00 e R$ 10,00 de impostos. PDF sem tags estruturais. |
| Relatório de projetos | Aprovado com ressalvas | 18 projetos, 16 ativos, 13 vencidos, 2 próximos do prazo, 27,5 ha e 15 áreas conhecidas reconciliados. PDF sem tags estruturais. |
| Relatório executivo | Aprovado com ressalvas | Alertas, KPIs financeiros e operacionais e conteúdo multipágina verificados. PDF sem tags estruturais. |
| Proposta emitida | Aprovada com ressalvas | Total, tributos, custos, lucro, margem, markup e parcelas conciliados; documento real de 3 páginas e estresse de 16 páginas. PDF sem tags estruturais. |
| Proposta em rascunho | Aprovada com ressalvas | Marca “RASCUNHO — NÃO ENVIAR” presente em todas as páginas e sem esconder conteúdo; documento sem tags estruturais. |
| Download assíncrono | Aprovado após correção | A operação agora só resolve depois da gravação e propaga a rejeição do gerador. |
| Impressão | Parcialmente comprovada | Layout de impressão foi exercitado com mídia `print`; o diálogo nativo/driver físico permaneceu fora do alcance automatizado. |

## Dez frentes independentes

| Frente exigida | Situação | Síntese |
|---|---|---|
| 1. Integridade dos dados e cálculos financeiros | APROVADA COM RESSALVAS | Cenário determinístico e testes de domínio/API fecharam em centavos; a campanha atual não materializou em PDF todas as combinações de legado, estorno e borda temporal pedidas no protocolo. |
| 2. Visualização e filtros financeiros | APROVADA COM RESSALVAS | Período personalizado, abas, detalhes e alertas aprovados; matriz completa de viewports/zoom não foi repetida nesta campanha. |
| 3. PDF financeiro baixado | APROVADA COM RESSALVAS | Arquivo real, 2 páginas, estrutura/texto/renderização aprovados; sem tags, idioma e título. |
| 4. Impressão/pré-visualização | BLOQUEADA | Mídia CSS `print` aprovada; diálogo nativo, impressora virtual e driver físico não exercitados. |
| 5. Integridade dos cálculos do orçamento | APROVADA COM RESSALVAS | Diferença de R$ 0,00 no cenário completo e regressões de domínio verdes; não houve PDF desta campanha para todas as situações/status aceitos. |
| 6. Conteúdo público e confidencialidade | APROVADA COM RESSALVAS | Oito classes de marcador ausentes em texto, bytes e metadados; cobertura limitada aos fixtures criados. |
| 7. Versão, status, validade e marca d’água | APROVADA COM RESSALVAS | v1 emitida/rascunho e v3 extensa verificadas; estados enviado, expirado, cancelado e substituído não foram materializados em PDF nesta rodada. |
| 8. Identidade, legibilidade e paginação | APROVADA COM RESSALVAS | 45 páginas inspecionadas; cenário extenso foi executado no gerador real, não por todos os cliques da interface. |
| 9. Acessibilidade | BLOQUEADA | Axe/teclado dos fluxos E2E sem violações automatizadas; PDFs sem estrutura semântica e sem teste físico com leitor de tela. |
| 10. Prontidão geral | APROVADA COM RESSALVAS | Núcleo integrado comprovado, sem P0/P1; pendências estão delimitadas e não foram ocultadas. |

Contagem final das dez frentes: **0 aprovadas sem ressalvas; 8 aprovadas com ressalvas; 0 reprovadas; 2 bloqueadas; 0 não aplicáveis**. Uma correção P2 foi implementada e aprovada após reteste.

## Reconciliação financeira

| Métrica | Banco bruto | Oráculo | API | Interface | PDF | Diferença | Resultado |
|---|---:|---:|---:|---:|---:|---:|---|
| Receita contratada | R$ 100,00 | R$ 100,00 | R$ 100,00 | R$ 100,00 | R$ 100,00 | R$ 0,00 | Aprovado |
| Receita recebida | R$ 40,00 | R$ 40,00 | R$ 40,00 | R$ 40,00 | R$ 40,00 | R$ 0,00 | Aprovado |
| Receita pendente | R$ 60,00 | R$ 60,00 | R$ 60,00 | R$ 60,00 | R$ 60,00 | R$ 0,00 | Aprovado |
| Receita vencida | R$ 60,00 | R$ 60,00 | R$ 60,00 | R$ 60,00 | R$ 60,00 | R$ 0,00 | Aprovado |
| Despesas pagas | R$ 54,00 | R$ 54,00 | R$ 54,00 | R$ 54,00 | R$ 54,00 | R$ 0,00 | Aprovado |
| Resultado de caixa | −R$ 14,00 | −R$ 14,00 | −R$ 14,00 | −R$ 14,00 | −R$ 14,00 | R$ 0,00 | Aprovado |
| Impostos previstos | R$ 10,00 | R$ 10,00 | R$ 10,00 | R$ 10,00 | R$ 10,00 | R$ 0,00 | Aprovado |
| Taxa de conversão | 20% | 20% | 20% | 20% | 20% | 0 p.p. | Aprovado |

## Reconciliação do orçamento

| Componente | Banco | Oráculo | Produto | Interface | PDF | Diferença | Resultado |
|---|---:|---:|---:|---:|---:|---:|---|
| Subtotal faturável | R$ 258,52 | R$ 258,52 | R$ 258,52 | R$ 258,52 | R$ 258,52 | R$ 0,00 | Aprovado |
| Ajustes por item | R$ 6,50 líquido | R$ 6,50 líquido | R$ 6,50 líquido | Conferido | Discriminado | R$ 0,00 | Aprovado |
| Reembolsáveis | R$ 30,00 | R$ 30,00 | R$ 30,00 | R$ 30,00 | R$ 30,00 | R$ 0,00 | Aprovado |
| Taxas de repasse | R$ 35,00 | R$ 35,00 | R$ 35,00 | R$ 35,00 | R$ 35,00 | R$ 0,00 | Aprovado |
| Desconto global | R$ 8,52 | R$ 8,52 | R$ 8,52 | R$ 8,52 | R$ 8,52 | R$ 0,00 | Aprovado |
| Acréscimo global | R$ 25,85 | R$ 25,85 | R$ 25,85 | R$ 25,85 | R$ 25,85 | R$ 0,00 | Aprovado |
| Impostos incluídos | R$ 7,50 | R$ 7,50 | R$ 7,50 | R$ 7,50 | R$ 7,50 | R$ 0,00 | Aprovado |
| Impostos por fora | R$ 11,98 | R$ 11,98 | R$ 11,98 | R$ 11,98 | R$ 11,98 | R$ 0,00 | Aprovado |
| Total final | R$ 287,83 | R$ 287,83 | R$ 287,83 | R$ 287,83 | R$ 287,83 | R$ 0,00 | Aprovado |
| Soma das parcelas | R$ 287,83 | R$ 287,83 | R$ 287,83 | R$ 287,83 | R$ 287,83 | R$ 0,00 | Aprovado |

## Confidencialidade

| Marcador/campo proibido | UI pública | Texto extraído | Bytes/objetos | Metadados | Resultado |
|---|---|---|---|---|---|
| Nota interna | Ausente | Ausente | Ausente | Ausente | Aprovado |
| Custo interno | Ausente | Ausente | Ausente | Ausente | Aprovado |
| Conta financeira | Ausente | Ausente | Ausente | Ausente | Aprovado |
| Lucro/margem/markup internos | Ausente no documento público | Ausente | Ausente | Ausente | Aprovado |
| IDs/caminhos/segredos | Ausente | Ausente | Ausente | Ausente | Aprovado |
| Dados de outro cliente | Ausente | Ausente | Ausente | Ausente | Aprovado no fixture isolado |

## Inventário resumido dos documentos

| ID | Tipo | Período/versão/status | Páginas | Tamanho | Estrutura | Texto | Render | Visual | Resultado |
|---|---|---|---:|---:|---|---|---|---|---|
| DOC-01 | Proposta | v1 emitida | 3 | 36.254 B | Válida | OK | OK | OK | Aprovada com ressalvas |
| DOC-02 | Proposta | v1 rascunho | 3 | 36.629 B | Válida | OK | OK | OK | Aprovada com ressalvas |
| DOC-03 | Executivo/regressão | 19/09/2026 | 3 | 94.260 B | Válida | OK | OK | OK | Aprovada com ressalvas |
| DOC-04 | Financeiro | 19/09/2026 | 2 | 68.571 B | Válida | OK | OK | OK | Aprovada com ressalvas |
| DOC-05 | Projetos/regressão | 19/09/2026 | 2 | 66.525 B | Válida | OK | OK | OK | Aprovada com ressalvas |
| DOC-06 | Proposta extensa | v3 emitida/100 itens | 16 | 97.608 B | Válida | OK | OK | OK | Aprovada com ressalvas |
| DOC-07 | Proposta extensa | v3 rascunho/100 itens | 16 | 100.004 B | Válida | OK | OK | OK | Aprovada com ressalvas |

Hashes completos constam em `PROTOCOLO-DE-DOCUMENTOS.md`.

## Evidência quantitativa

- Interface de relatórios: 2/2 cenários Playwright aprovados, três PDFs reais salvos.
- Interface de orçamentos: 4/4 cenários Playwright aprovados, proposta em rascunho e emitida salvas.
- Oráculos independentes: orçamento e relatórios 100% coincidentes.
- Protocolo de PDF: 7/7 documentos e 45/45 páginas aprovados nos controles estruturais e de renderização.
- Inspeção visual: 13 folhas de contato cobrindo 45/45 páginas, sem corte, sobreposição, quebra de linha inválida ou rodapé incoerente.
- Regressão: 203/203 testes web, 192/192 testes API e 18/18 testes desktop.
- Qualidade estática: lint, typecheck, `git diff --check` e build/instalador Windows aprovados.

## Limites da conclusão

Não foi realizada homologação física em impressora, validação em múltiplos drivers, leitura manual com NVDA/JAWS nem certificação PDF/UA. Também não foi executado o documento de 100 itens por todos os cliques da interface; esse cenário usa o mesmo construtor e a mesma biblioteca de PDF, diretamente, como ensaio estrutural suplementar. Essas lacunas estão registradas como bloqueadas ou parciais na matriz e não foram convertidas em aprovação implícita.

O protocolo solicitava uma campanha ainda mais ampla de dados (fluxos legados, múltiplos estornos/exclusões, todos os status, identidade ausente/corrompida, logos inválidos, dupla geração, offline e várias bordas temporais). Parte dessas regras possui cobertura automatizada unitária/integrada, mas nem todas foram novamente materializadas em PDFs nesta rodada. Por isso o parecer não é “APROVADA” sem ressalvas.

## Encaminhamento

**Recomendação: liberar apenas os fluxos efetivamente auditados, com ciência formal das ressalvas; não declarar homologação documental plena.** Para uma aprovação sem ressalvas, a prioridade é adotar PDFs marcados com idioma e título, executar leitor de tela/impressão nativa e repetir a matriz extensa pelos controles reais da interface.

## Limpeza e resíduos

As duas raízes efêmeras criadas para esta campanha foram removidas pelo executor após os E2E; não há processo GeoGestor/API iniciado pela auditoria. Os processos Node remanescentes pertencem ao runtime do Codex. A pasta `scratch/commercial-e2e` contém muitas execuções anteriores, com a mais recente datada de 19/09/2026 00:02:36, antes desta campanha; por segurança, nenhuma delas foi apagada nem atribuída a este trabalho.

Foram preservados somente os PDFs, screenshots, textos, renderizações, folhas de contato e JSONs enumerados no protocolo. Como o banco utilizado era descartável e foi removido junto à raiz da execução, não restaram fixtures desta campanha na base real. Os fixtures E2E existentes usam os prefixos históricos `QA-AUDIT-S04-20260910-` e `QA-AUDIT-S11-`, em vez do prefixo recomendado pelo protocolo; o isolamento por raiz exclusiva impediu colisão e tornou a remoção integral verificável.
