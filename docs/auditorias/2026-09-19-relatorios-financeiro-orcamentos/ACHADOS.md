# Achados

## A-01 — Conclusão prematura do download de proposta

- ID: A-01
- Título: Conclusão prematura do download de proposta
- Gravidade: **P2 — média**
- Documento: Orçamento
- Camada: Interface/PDF
- Rota/fluxo: `/orcamentos` → detalhes → gerar/exportar PDF
- Pré-condições: runtime pdfmake carregado e `download()` assíncrono ou rejeitado
- Dados sintéticos/IDs: proposta isolada `QA-AUDIT-S04-20260910-`
- Passos para reproduzir: injetar `download()` pendente, chamar o gerador e observar a resolução; em seguida injetar rejeição.
- Resultado esperado: a promessa permanece pendente até a gravação e rejeita com o erro do download.
- Resultado obtido: o chamador podia concluir antes da operação e perder a rejeição assíncrona.
- Impacto: carregamento/sucesso enganoso e tratamento de erro incompleto.
- Evidência antes: teste vermelho criado para espera e propagação.
- Causa raiz: retorno de `download()` não aguardado pelo gerador.
- Arquivos, endpoints e tabelas: `apps/web/src/pages/Orcamentos/budgetPdfGenerator.ts`; sem mutação de endpoint/banco.
- Correção aplicada: `downloadProfessionalBudgetPdf()` centraliza e aguarda o resultado; chamador usa `await`.
- Testes automatizados: teste focado 13/13, web 203/203, E2E orçamentos 4/4.
- Reteste manual: PDFs emitido e rascunho baixados e preservados.
- Evidência depois: arquivo real, protocolo estrutural e teste de rejeição aprovados.
- Situação final: **corrigido e retestado**.

## A-02 — PDFs sem estrutura semântica, idioma e título

- ID: A-02
- Título: PDFs sem estrutura semântica, idioma e título
- Gravidade: **P2 — média**
- Documento: Ambos
- Camada: Acessibilidade/PDF
- Rota/fluxo: downloads em `/relatorios` e `/orcamentos`
- Pré-condições: qualquer documento gerado pelo pipeline atual
- Dados sintéticos/IDs: DOC-01 a DOC-07
- Passos para reproduzir: abrir o catálogo e os metadados com parser independente.
- Resultado esperado: estrutura marcada, `/Lang=pt-BR` e título descritivo.
- Resultado obtido: `tagged=false`, `language=null` e `title=null` em 7/7 arquivos.
- Impacto: ordem, headings e tabelas não são garantidos para tecnologia assistiva; PDF/UA não comprovado.
- Evidência antes: `evidencias/protocolo-pdfs.json`.
- Causa raiz: pipeline pdfmake atual não emite a estrutura/metadata exigida.
- Arquivos, endpoints e tabelas: geradores de relatório e orçamento; sem relação com banco.
- Correção aplicada: nenhuma, pois exige decisão de pipeline/biblioteca além da correção mínima autorizada.
- Testes automatizados: inspeção registra tags, idioma e título de cada PDF.
- Reteste manual: bloqueado sem leitor de tela/PAC instalado.
- Evidência depois: não aplicável enquanto aberto.
- Situação final: **aberto**.

## A-03 — Homologação nativa de impressão não executada

- ID: A-03
- Título: Homologação nativa de impressão não executada
- Gravidade: **P3 — baixa/cobertura**
- Documento: Financeiro
- Camada: Impressão
- Rota/fluxo: `/relatorios` → pré-visualização/impressão
- Pré-condições: diálogo e driver nativos disponíveis para interação segura
- Dados sintéticos/IDs: relatório de 19/09/2026
- Passos para reproduzir: abrir o diálogo nativo e imprimir em destino virtual isolado.
- Resultado esperado: A4, escala correta, sem corte e com paginação estável.
- Resultado obtido: apenas mídia `print` do Chromium e PDF A4 puderam ser exercitados.
- Impacto: compatibilidade de driver/margem física permanece desconhecida.
- Evidência antes: screenshots da prévia e E2E com `emulateMedia('print')`.
- Causa raiz: limitação física/automação do ambiente.
- Arquivos, endpoints e tabelas: sem alteração de produto.
- Correção aplicada: nenhuma.
- Testes automatizados: CSS de impressão e renderização externa.
- Reteste manual: pendente com Microsoft Print to PDF e impressora física.
- Evidência depois: não aplicável.
- Situação final: **bloqueado pelo ambiente**.

## A-04 — Estresse de 100 itens não percorreu toda a interface

- ID: A-04
- Título: Estresse de 100 itens não percorreu toda a interface
- Gravidade: **P3 — baixa/cobertura**
- Documento: Orçamento
- Camada: Interface/PDF
- Rota/fluxo: construtor real de proposta; não o editor completo
- Pré-condições: fixture de 100 itens
- Dados sintéticos/IDs: `ORC-2026-TESTE-100-ITENS`, v3 emitida e rascunho
- Passos para reproduzir: executar `generate_long_budget_pdf.ts` com 100 itens.
- Resultado esperado: documento multipágina íntegro; idealmente baixado pelos controles reais.
- Resultado obtido: 2 × 16 páginas íntegras pelo gerador real, mas sem todos os cliques da interface.
- Impacto: paginação está comprovada; integração completa em volume máximo permanece parcial.
- Evidência antes: PDFs, texto e 8 folhas de contato dos documentos extensos.
- Causa raiz: custo/tempo de popular o editor completo com 100 itens na campanha atual.
- Arquivos, endpoints e tabelas: `tests/e2e/generate_long_budget_pdf.ts`.
- Correção aplicada: parametrização do gerador para 1–100 itens e status.
- Testes automatizados: protocolo estrutural 32/32 páginas.
- Reteste manual: inspeção visual de todas as 32 páginas.
- Evidência depois: documentos íntegros, cobertura ainda parcial.
- Situação final: **aberto como lacuna de cobertura**.

## Ausência de bloqueadores

Nenhum P0 ou P1 foi encontrado. Não houve divergência entre oráculo, banco, API, tela e PDF nos cenários determinísticos, nem vazamento dos marcadores internos semeados.
