# Matriz de cobertura

Legenda: **Aprovado**, **Parcial**, **Bloqueado** ou **Não aplicável**.

| Fase | Escopo | Resultado | Evidência/observação |
|---:|---|---|---|
| 1 | Inventário técnico | Aprovado | Rotas, serviços, modelos de documento, pdfmake, download e testes mapeados. |
| 2 | Leitura de auditorias anteriores | Aprovado | Relatórios de 10, 12, 16, 17, 18 e 19/09/2026 considerados. |
| 3 | Modelo e banco isolado | Aprovado | SQLite efêmero criado pelo executor comercial; base real não alterada. |
| 4 | Matriz de origem dos dados | Aprovado | Ver `MAPA-DE-DADOS-E-ORIGENS.md`. |
| 5 | Oráculos independentes | Aprovado | Python Decimal/inteiros, sem imports do produto; JSON preservado em `evidencias/banco`. |
| 6 | Relatório financeiro | Aprovado | API, UI, agregados, categorias, alertas, período e PDF conciliados. |
| 7 | Relatório de projetos | Aprovado | Status, prazos, área conhecida/desconhecida, total e agenda conciliados. |
| 8 | Relatório executivo | Aprovado | KPIs e cinco alertas esperados presentes e ordenados. |
| 9 | Períodos e filtros | Parcial | Datas civis válidas, intervalo inclusivo e personalizado cobertos; nem todas as bordas temporais pedidas foram materializadas em PDF. |
| 10 | Propostas/orçamentos | Parcial | Subtotais, ajustes, impostos, custos, total e parcelas validados; nem todos os status aceitos foram convertidos em evidência PDF. |
| 11 | Conteúdo do PDF | Aprovado | Texto extraído e marcadores esperados comparados; dados internos semeados ausentes. |
| 12 | Paginação e layout | Aprovado | 45 páginas renderizadas; 100 itens, textos longos, opcionais, rodapés e cabeçalhos inspecionados. |
| 13 | Impressão | Bloqueado | CSS `print` exercitado; diálogo nativo, driver e papel físico não automatizáveis aqui. |
| 14 | Segurança/confidencialidade | Aprovado | Busca em texto, bytes e metadados; nenhum marcador interno ou ação ativa encontrado. |
| 15 | Acessibilidade documental | Bloqueado | Texto extraível e contraste visual adequados; todos os PDFs sem tags, `/Lang` e título; leitor físico indisponível. |
| 16 | Robustez/concorrência | Aprovado | Download assíncrono corrigido; teste garante espera e propagação de erro. |
| 17 | Desempenho/volume | Parcial | API com 1.500 registros em 14,1 ms no teste focado; PDFs de 100 itens válidos. Sem repetições/mediana de geração e sem SLA formal. |
| 18 | Correção e reteste | Aprovado | P2 corrigido, teste vermelho/verde e regressão completa verde. |
| 19 | Artefatos auditáveis | Aprovado | PDFs, hashes, textos, imagens, JSONs e documentação preservados. |
| 20 | Parecer final | Aprovado com ressalvas | Sem P0/P1 aberto; ressalvas de PDF/UA e homologação física. |

## Casos críticos cobertos

| Caso | Cobertura |
|---|---|
| Receita contratada, recebida, pendente e vencida | API + UI + PDF + oráculo |
| Despesas pagas e caixa negativo | API + UI + PDF + oráculo |
| Conversão 1/5 = 20% | API + UI + PDF + oráculo |
| 18 projetos, 16 ativos, 13 vencidos | API + UI + PDF + oráculo |
| Orçamento com ajustes por item e globais | API + banco + UI + PDF + oráculo |
| Tributo incluso, externo, cumulativo e ajuste manual | API + banco + PDF + oráculo |
| Três parcelas com residual na última | API + banco + PDF + oráculo |
| Campos internos e conta financeira | Marcadores semeados + varredura texto/bytes/metadados |
| Rascunho versus emitido | UI + PDF + marca d’água página a página |
| Conteúdo extenso | 2 PDFs de 16 páginas/100 itens + inspeção visual integral |
| HTML malicioso como texto | UI/PDF sem execução; ausência de conteúdo ativo no PDF |
| Falha do download | Teste automatizado de rejeição e espera assíncrona |
