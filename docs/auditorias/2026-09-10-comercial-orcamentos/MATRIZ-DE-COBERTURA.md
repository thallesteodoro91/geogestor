# Matriz de cobertura — Sessão 04

Legenda de evidência: **E2E** = `tests/e2e/session04-budgets.spec.ts`; **INT** = `apps/api/src/orcamentos.integration.test.ts`; **DOM** = `apps/api/src/orcamentos-domain.test.ts`; **WEB** = testes web; **PDF** = relatórios em `evidencias/pdf-longo*/render`; **VIS** = screenshots numerados.

| ID | Rota/superfície e controle | Frontend | Endpoint, tabelas ou arquivo | Cenário/resultado e evidência | Situação |
|---|---|---|---|---|---|
| P01 | Arquitetura e processos | React/Vite/Electron | Fastify, Drizzle/SQLite | Instância isolada iniciada pelo harness; E2E | APROVADO |
| P02 | Banco efetivo | — | `GEOGESTOR_DB_PATH` descartável | Caminho da execução confirmado; real somente leitura | APROVADO |
| P03 | Banco real | — | `data/geogestor.db` | Hash, tamanho e mtime iguais antes/depois | APROVADO |
| P04 | Dados mínimos | — | clientes, propriedades, projetos, oportunidade | Dois clientes, rural/urbano e dois projetos isolados; E2E | APROVADO |
| P05 | Evidências | — | `docs/auditorias/.../evidencias` | Screenshots e PDFs sanitizados | APROVADO |
| P06 | Higiene do Git | — | worktree | Estado sujo preexistente registrado; diff próprio revisado | APROVADO |
| N01 | `/orcamentos` por URL/menu | `Orcamentos.tsx` | GET lista/KPIs/opções | Cabeçalho e módulo carregados; E2E/VIS-01 | APROVADO |
| N02 | `/orcamentos/novo` | `BudgetEditorPage` | POST orçamento | Contrato e editor carregam; criação completa pela rota não foi refeita nesta campanha | BLOQUEADO |
| N03 | `/orcamentos/:id/editar` rascunho | `budgetForm.ts` | GET/PATCH orçamento | Conversão monetária corrigida; WEB/E2E | APROVADO APÓS CORREÇÃO |
| N04 | Editar UUID inválido, não rascunho e removido | `BudgetEditorPage` | GET/PATCH | Não houve travessia visual de todas as três variantes | BLOQUEADO |
| N05 | Detalhes por `budgetId` | `BudgetDetails` | GET detalhe/histórico/versões | Deep link, recarga e revisão abertos; E2E | APROVADO |
| N06 | `budgetId` malformado ou ausente | `BudgetDetails` | GET detalhe | Mensagem e remoção do parâmetro corrigidas; E2E | APROVADO APÓS CORREÇÃO |
| N07 | `highlightId` e retorno do editor | `Orcamentos` | URL/consulta | Editar retornou com filtro, página e destaque | APROVADO |
| N08 | Voltar/avançar e retorno de foco em toda navegação | roteador/modal | histórico do navegador | Parte coberta por modal; sequência exaustiva não executada | BLOQUEADO |
| N09 | Falha de lista e recuperação | `Orcamentos` | GET lista 500 | Estado de erro real, causa e retry; E2E/VIS-02 | APROVADO APÓS CORREÇÃO |
| N10 | Resposta lenta | React Query | GET lista | Não houve injeção cronometrada de latência | BLOQUEADO |
| L01 | Busca por número/cliente/imóvel/descrição | `PageFilterBar` | GET lista `query` | Busca normalizada e termo inexistente; E2E/INT | APROVADO |
| L02 | Filtro de cliente | `Orcamentos` | `clientId` | Cliente sintético filtrado e URL preservada; E2E | APROVADO |
| L03 | Município, tipo, vínculo e faixa monetária | `Orcamentos` | `municipality`, `propertyType`, `linkedProject`, min/max | Sete filtros combinados retornaram o registro exato; E2E/VIS-03 | APROVADO |
| L04 | Serviço, imóvel, responsável e datas na UI | `Orcamentos` | demais parâmetros de filtro | Contratos existem; todas as combinações visuais não foram percorridas | BLOQUEADO |
| L05 | Filtros na URL e recarga | `Orcamentos` | query string | Persistência e leitura após navegação; E2E/WEB | APROVADO |
| L06 | Remoção individual de todos os chips e limpar | `Orcamentos` | query string | Chips renderizados; sequência completa não automatizada | BLOQUEADO |
| L07 | Nove abas e contadores | `Orcamentos` | status/KPIs | Estados de domínio cobertos; todos os contadores não foram vistos na UI | BLOQUEADO |
| L08 | Paginação com mais de 25 propostas | `Orcamentos` | `page`, `pageSize` | Volume visual não foi criado | BLOQUEADO |
| L09 | Colunas e ações da tabela | `Orcamentos` | resposta paginada | Número, cliente, imóvel, serviço, validade, valor e ações vistos | APROVADO |
| L10 | Texto longo e overflow | `Orcamentos` | CSS/layout | Sem overflow de página em 4 viewports; E2E | APROVADO |
| L11 | Carregando, vazio, filtrado, parcial e erro | `Orcamentos` | lista/KPIs | Vazio e erro comprovados; dados parciais tolerados por WEB | APROVADO |
| L12 | Aprovado, recebido e a receber | análise comercial | GET KPIs/parcelas/recebimentos | 105.000 → 42.000 recebido e 63.000 aberto; INT | APROVADO |
| L13 | Conversão e versão substituída | análise comercial | GET KPIs | Somente estados elegíveis; revisão não duplicou aprovado; INT | APROVADO |
| L14 | Lista e KPIs no mesmo escopo | React Query | GET lista/KPIs | Chaves de filtro compartilhadas; WEB/E2E | APROVADO |
| L15 | Invalidação após mutação | React Query | lista/KPIs/detalhe | Status e parcelas atualizaram sem recarga manual; E2E | APROVADO |
| E01 | Seção Cabeçalho | `BudgetEditor` | POST/PATCH orçamento | título, datas, responsável, origem e prazo persistidos | APROVADO |
| E02 | Cliente, imóvel e projeto | `BudgetEditor` | opções/relações | cliente, propriedade rural e projeto conhecidos | APROVADO |
| E03 | Caracterização técnica | `BudgetEditor` | JSON de caracterização | apoio físico e estação base eletrônica distintos na UI/PDF | APROVADO |
| E04 | Cadastro rápido PF/PJ | modal de cliente | endpoints de clientes | Não exercitado nesta sessão para evitar ampliar o fluxo | BLOQUEADO |
| E05 | Todos os campos em mínimo/máximo/paste/autofill | `BudgetEditor` | schemas | Casos críticos cobertos; matriz combinatória completa não executada | BLOQUEADO |
| E06 | Itens: editar, duplicar, ordenar e remover | editor de itens | `orcamento_itens` | IDs/ordem foram validados por WEB/INT; todas as ações visuais não foram percorridas | BLOQUEADO |
| E07 | Item opcional | editor/PDF | `orcamento_itens.opcional` | Exibido, mas fora de total, custo, imposto e margem; DOM/PDF | APROVADO |
| E08 | Custos internos e três classificações | editor de custos | `orcamento_despesas` | próprio, reembolsável e repassado conciliados | APROVADO |
| E09 | Impostos e quatro bases | editor fiscal | `orcamento_impostos` | incluso, fora, cumulativo e ajuste justificado; DOM/E2E | APROVADO |
| E10 | Pagamento e definição das parcelas | editor de pagamento | condição/parcelas | Invariantes e limite 60 corrigidos; DOM/E2E | APROVADO APÓS CORREÇÃO |
| E11 | Juros, multa e antecipação | editor de pagamento | pontos-base | 1%, 2% e 0,5% persistidos e impressos | APROVADO |
| E12 | Resumo financeiro | resumo compacto | cálculo do domínio | subtotais, base, impostos e total conciliados | APROVADO |
| E13 | Notas internas versus cliente | observações | campos separados | interna não apareceu no PDF; cliente apareceu | APROVADO |
| E14 | Documento final e termos | documento | snapshot/PDF | texto persistido e presente no PDF | APROVADO |
| E15 | Doze seções e resumo lateral | `BudgetEditor` | estado do formulário | Seções-chave localizadas; travessia visual das doze não foi concluída | BLOQUEADO |
| E16 | Descarte, Escape, dupla submissão e falha ao salvar | editor/modal | POST/PATCH | Não houve campanha visual completa desses quatro estados | BLOQUEADO |
| E17 | Persistência após reiniciar serviço | editor/API | SQLite | Persistiu após reload; reinício deliberado não executado | BLOQUEADO |
| E18 | Campos extras, datas, faixas, trims e limites | contratos/rotas | POST/PATCH/GET filtros | Schemas estritos e 400 uniformes após correção; INT | APROVADO APÓS CORREÇÃO |
| C01 | Quantidade decimal e centavos | domínio | item | 1,5 × 10.001 arredondado deterministicamente | APROVADO |
| C02 | Descontos/acréscimos fixos e percentuais | domínio | itens/ajustes | Combinações conhecidas conciliadas | APROVADO |
| C03 | Serviços, despesas e taxas | domínio | agregados | 14.752, 7.600 e 3.500 | APROVADO |
| C04 | Rateio global | domínio | base/serviço | −651/+1.975 na base tributável | APROVADO |
| C05 | Custos por classificação | domínio | custos | Sem dupla contagem; custo total 12.500 | APROVADO |
| C06 | Base tributável | domínio | impostos | 19.752 bruto; 21.076 ajustado | APROVADO |
| C07 | Imposto incluso e por fora | domínio/PDF | impostos | 750 incluso; 1.198 por fora | APROVADO |
| C08 | Cumulatividade e ajuste manual | domínio | impostos | PIS altera base subsequente; ajuste +3 justificado | APROVADO |
| C09 | Total contratado | domínio/API/DB/UI/PDF | orçamento | 28.783 centavos em todas as camadas | APROVADO |
| C10 | Honorários, custo, lucro, margem e markup | domínio/detalhes | orçamento | 14.991; 12.500; 12.335; 58,50%; 98,68% | APROVADO |
| C11 | Alertas de margem/total/custo/base | editor | estado derivado | Casos de domínio existem; todos os alertas não foram vistos na UI | BLOQUEADO |
| C12 | 0%, 100% e acima de 100% permitido/proibido | domínio/formulário | ajustes | Fronteiras cobertas por DOM/WEB | APROVADO |
| C13 | Opcional fora dos agregados | domínio/PDF | item | Cotado separadamente e excluído | APROVADO |
| C14 | Inteiros seguros e overflow moderado | contratos | schemas | `MAX_SAFE_INTEGER` e parsing seguro aplicados/testados | APROVADO |
| C15 | Todas as unidades e unidade personalizada | editor | item.unit | Conjunto completo não foi percorrido na aplicação | BLOQUEADO |
| S01 | Matriz de transições | contrato/ações | transitions | Válidas e terminais definidas; DOM/INT | APROVADO |
| S02 | Emissão, código e snapshot | detalhes | `/emit` e versões | `ORC-2026-0001`, cliente e versão persistidos | APROVADO |
| S03 | Enviado, negociação e visualizado | detalhes | `/transitions`, `/viewed` | Timestamps/estado atualizados; E2E | APROVADO |
| S04 | Expiração automática na borda/fuso | serviço | leitura dispara expiração | Não houve passagem real do relógio | BLOQUEADO |
| S05 | Rejeição e cancelamento com motivo | modais/API | transitions/histórico | Motivos e estados persistidos por INT | APROVADO |
| S06 | Aprovação atômica e idempotência | modal/serviço | `/approve`, projeto, parcelas | Requisições simultâneas sem duplicação; E2E/INT | APROVADO |
| S07 | Projeto existente na aprovação | modal de aprovação | GET opções + `/approve` | Catálogo corrigido e vínculo único; E2E | APROVADO APÓS CORREÇÃO |
| S08 | Projeto novo na aprovação | API | projetos/auditoria | Criado uma vez e associado; INT | APROVADO |
| S09 | Projeto inexistente/de outro cliente pela UI/API | aprovação | `/approve` | Regra existe; cenário cruzado completo não foi automatizado nesta campanha | BLOQUEADO |
| S10 | Parcelas sem recebimento e recebimento parcial | detalhes/financeiro | parcelas/recebimentos | zero inicial; parcial e overpayment por INT | APROVADO |
| S11 | Revisão, IDs e substituição | detalhes/API | versões/itens/parcelas | versão 2 independente, versão 1 substituída | APROVADO |
| S12 | Revisão inferior ao já recebido | serviço | `/approve` revisão | Guarda existe; fixture específico não executado | BLOQUEADO |
| S13 | Excluir emitido/aprovado e duplicar terminal | ações/API | DELETE/duplicate | Rascunho coberto; combinações terminais não executadas | BLOQUEADO |
| S14 | Modelo ausente | API | PATCH template | 404 corrigido e testado | APROVADO APÓS CORREÇÃO |
| S15 | Chave de precificação equivalente | API | pricing parameters | trim/lower e mesma identidade; INT | APROVADO APÓS CORREÇÃO |
| PDF01 | Gerar pela linha/detalhes | carregador PDF | `loadPdfMake.ts` | Fontes/VFS corrigidos; quatro PDFs gerados | APROVADO APÓS CORREÇÃO |
| PDF02 | Confirmação e cancelamento do rascunho | confirmação | download | Confirmação coberta; cancelamento não exercitado | BLOQUEADO |
| PDF03 | Conteúdo do cenário conhecido | gerador | PDF de 3 páginas | itens, tributos, termos, pagamento e total conferidos | APROVADO |
| PDF04 | Segredos e métricas internas | gerador | PDF | notas, conta, custo, lucro e margem ausentes | APROVADO |
| PDF05 | A4, texto longo, tabela e rodapé | gerador/inspetor | PDF de 8 páginas | Todas as páginas renderizadas e aprovadas | APROVADO |
| PDF06 | Nome, extensão, clique duplo e leitor real | download | arquivo `.pdf` | Nome/extensão aprovados; clique duplo/leitor externo não executados | BLOQUEADO |
| PDF07 | Snapshot após alterar cliente/imóvel | gerador | snapshot de versão | Snapshot verificado na emissão; mutação posterior completa não executada | BLOQUEADO |
| PDF08 | Impressão física | sistema operacional | spooler/impressora | Recurso não disponível no ambiente | BLOQUEADO |
| UX01 | 360/768/1024/1440 e claro/escuro | layout | DOM/CSS | Sem overflow; Axe em claro/escuro; E2E/VIS | APROVADO |
| UX02 | Zoom 200% e reflow do sistema | layout | navegador/OS | Viewports cobertos, zoom 200% não executado | BLOQUEADO |
| UX03 | Contraste WCAG AA | `BudgetDetails` | estilos | Violações sérias corrigidas; Axe zerado | APROVADO APÓS CORREÇÃO |
| UX04 | Teclado exaustivo nas 12 seções | editor/modais | foco/ARIA | Controles semânticos cobertos parcialmente; travessia total não feita | BLOQUEADO |
| UX05 | Leitor de tela real | aplicação | árvore de acessibilidade | Axe executado; NVDA/Narrador não disponível | BLOQUEADO |
| NA01 | Importação de orçamento por CSV | módulo | — | Função não existe em Orçamentos | NÃO APLICÁVEL |
| NA02 | Exportação tabular de orçamentos | módulo | — | Função não existe em Orçamentos | NÃO APLICÁVEL |
| NA03 | Formula injection em CSV | módulo | — | Não há entrada/saída CSV neste módulo | NÃO APLICÁVEL |

## Observação sobre “BLOQUEADO”

“BLOQUEADO” não significa defeito observado. Significa que a evidência exigida não foi produzida com fidelidade suficiente nesta execução. Nenhum item bloqueado foi promovido a aprovado por inspeção de código isolada.
