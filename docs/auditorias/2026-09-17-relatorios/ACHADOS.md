# Achados e correções

Todos os achados abaixo foram retestados. Não houve P0.

| ID | Pri. | Defeito e impacto | Causa raiz | Correção | Evidência de aceite |
| --- | --- | --- | --- | --- | --- |
| F01 | P1 | Categorias de despesa podiam divergir de “Despesas pagas” e do caixa. | A agregação aceitava despesas não pagas e outra referência temporal. | A consulta usa somente despesas pagas e a data efetiva de caixa. | Integração reconcilia KPI, categorias e exclusões; E2E exibe R$ 54,00 no cenário volumétrico. |
| F02 | P2 | Parâmetros repetidos, extras ou malformados podiam produzir comportamento permissivo ou erro 500. | Esquema de query não era estrito nem limitava cardinalidade. | Validação Zod estrita, strings simples e limite de 10 caracteres; erro seguro 400. | Casos de query inválida no teste de integração. |
| F03 | P1 | “Hoje”, atrasos e próximos vencimentos mudavam na virada UTC, antes da virada em São Paulo. | Comparações usavam o dia UTC do servidor. | Chave diária calculada em `America/Sao_Paulo`. | Teste unitário próximo da meia-noite e fronteiras ontem/hoje/+30/+31. |
| F04 | P2 | Período com apenas recebíveis pendentes podia aparecer como vazio. | Contagem filtrada ignorava registros financeiros pendentes. | `filteredRecordCount` inclui composição financeira completa. | Cenário pendente sem recebimento permanece visível. |
| F05 | P1 | Status `CONCLUÍDO` com acento e caixa diferentes era contado como ativo, inflando área e agenda. | Comparação literal não normalizava diacríticos/caixa. | Normalização Unicode e status canônicos de concluído/cancelado. | Integração cobre acentos, caixa, vazio e status desconhecido. |
| F06 | P2 | A interface podia anunciar PDF salvo antes do fim e ocultar falha assíncrona. | `download()` não era aguardado. | Loader e gerador propagam `Promise`; feedback ocorre após conclusão. | Teste unitário aguarda sucesso e rejeição; E2E baixa três PDFs. |
| F07 | P1 | Relatórios podiam permanecer desatualizados após criar/editar/excluir dados. | Não havia ponte global entre mutações da API e cache dos relatórios. | Mutações bem-sucedidas emitem evento; React Query invalida e refaz a consulta ativa. | Testes do cliente distinguem GET, mutação bem-sucedida e falha; E2E cria projeto e observa atualização. |
| F08 | P2 | Datas impossíveis/invertidas não ficavam associadas ao filtro e URL podia reter estado não canônico. | Validação parcial no cliente e ausência de canonicalização. | Validação real de datas, alerta associado e `replace` da URL canônica. | Testes unitários e E2E de URL/filtro inválido. |
| F09 | P2 | Contagens exibidas nos KPIs podiam sugerir um número de registros diferente da composição real. | Um contador agregado era reutilizado sem semântica específica. | Contrato ganhou `financial.composition` e a UI mostra as contagens próprias. | Integração e tela reconciliam parcelas, recebimentos e despesas. |
| F10 | P2 | Categorias/prazos ocultos pelo limite visual não eram declarados; empates podiam variar. | Ausência de ordenação total e de aviso de truncamento. | Ordenação com desempate estável e texto explícito sobre itens adicionais. | Cenário com 25 categorias/18 projetos e inspeção das telas. |
| F11 | P2 | Documentos e tabelas omitiam critérios/alertas, repetiam IDs e tinham data/identidade inconsistentes. | Modelos genéricos e metadados dispersos. | Seções específicas por relatório, IDs únicos, escopos, identidade e data no fuso de negócio. | Testes de modelo/PDF e inspeção de texto dos três documentos. |
| F12 | P2 | Logomarca sobrepunha o título e linhas longas podiam ser divididas entre páginas. | Cabeçalho sem reserva de altura e tabelas permitiam quebra interna. | Logo e empresa lado a lado, margem superior ampliada e `dontBreakRows`. | Renderização final das 7 páginas sem sobreposição ou linha órfã. |

## Riscos fora do escopo corrigido

| ID | Estado | Risco | Encaminhamento |
| --- | --- | --- | --- |
| R01 | REPROVADO | A suíte completa da API falha em `financial-removal-scenarios.integration.test.ts:318`: esperado recebível 0, obtido 3.333 centavos. A falha reproduz isoladamente. | Investigar a regra de remoção financeira em tarefa própria antes do próximo release. |
| R02 | REPROVADO | O manifesto de release não lista instaladores 1.0.2/1.0.3 e diverge do tamanho/hash do 1.0.4 reconstruído. | Regenerar e assinar o manifesto junto do processo oficial de release. |
| R03 | BLOQUEADO | Leitor de tela real, impressão nativa/cancelamento, zoom/alto contraste nativos, contenção SQLite e UI empacotada completa não foram exercitados. | Executar checklist de homologação em máquina de release. |

