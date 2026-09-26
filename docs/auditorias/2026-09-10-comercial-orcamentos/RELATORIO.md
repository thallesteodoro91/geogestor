# Auditoria — Sessão 04: Comercial — Orçamentos

**Status final: APROVADA COM RESSALVAS**  
**Data:** 10/09/2026  
**Aplicação:** GeoGestor Desktop 1.0.4  
**Commit de referência:** `a16551a8b63e73f42d826297df893488e5ab88ca` (`main`)  
**Ambiente:** Windows NT 10.0.26200.0, Node 24.17.0, pnpm 11.8.0

## Resumo executivo

A função de Orçamentos foi validada em frontend React/Vite, API Fastify, domínio financeiro, SQLite isolado, PDF e empacotamento Electron. O ciclo integrado final executou quatro cenários em 1,1 minuto e comprovou listagem vazia e erro recuperável, cálculo conhecido, persistência após edição, emissão, envio, visualização, negociação, aprovação, idempotência, vínculo com projeto, conversão da oportunidade em ganho, geração de parcelas, revisão, substituição da versão anterior, responsividade e acessibilidade automatizada.

Foram encontrados e corrigidos **10 defeitos: 1 P0, 3 P1 e 6 P2**. Não restou defeito conhecido reprovado dentro do recorte efetivamente exercitado. A ressalva decorre de itens que exigiriam campanha adicional ou recurso indisponível: leitor de tela real, zoom do sistema a 200%, concorrência multiusuário, expiração por passagem real do relógio, paginação visual com mais de 25 propostas e execução completa da interface instalada. O instalador foi produzido com sucesso; o smoke genérico do pacote chegou a consultar `/api/orcamentos`, mas parou depois em uma expectativa de auditoria da configuração inicial, fora do escopo desta sessão.

## Resultado quantitativo

A contagem canônica está na [matriz de cobertura](./MATRIZ-DE-COBERTURA.md). O resumo é gerado a partir das linhas da matriz:

| Situação | Quantidade |
|---|---:|
| APROVADO | 55 |
| APROVADO APÓS CORREÇÃO | 10 |
| REPROVADO | 0 |
| BLOQUEADO | 27 |
| NÃO APLICÁVEL | 3 |
| **Total inventariado** | **95** |

## Achados corrigidos

| ID | Gravidade | Resultado |
|---|---|---|
| S04-F01 | P0 | Ajustes globais fixos deixaram de reabrir com valor 100 vezes maior. |
| S04-F02 | P1 | PDF voltou a carregar as fontes do `pdfmake` 0.3 e a exportar. |
| S04-F03 | P1 | Parcelas passaram a exigir definição íntegra e soma exata; limite unificado em 60. |
| S04-F04 | P1 | Aprovação passou a listar projetos existentes e permitir o vínculo correto. |
| S04-F05 | P2 | Contratos passaram a rejeitar campos extras, datas impossíveis/invertidas e faixas inválidas. |
| S04-F06 | P2 | Falha da lista/KPIs deixou de ser apresentada como estado vazio. |
| S04-F07 | P2 | Deep links inválidos ou inexistentes ganharam recuperação explícita. |
| S04-F08 | P2 | Atualização de modelo inexistente passou de falso 200 para 404. |
| S04-F09 | P2 | Chaves de precificação passaram a ser normalizadas antes da unicidade. |
| S04-F10 | P2 | Contraste insuficiente nos detalhes foi corrigido e validado por Axe. |

Os passos, causas e retestes completos estão em [ACHADOS.md](./ACHADOS.md).

## Cálculos financeiros comprovados

O conjunto conhecido foi calculado fora da implementação e confrontado com resposta da API, linhas do SQLite isolado, detalhes da interface e PDF:

- faturável antes dos ajustes: **R$ 258,52**;
- desconto global: **R$ 8,52**;
- acréscimo global: **R$ 25,85**;
- impostos: **R$ 19,48**, sendo **R$ 7,50 inclusos** e **R$ 11,98 por fora**;
- total contratado: **R$ 287,83**;
- custos estimados: **R$ 125,00**;
- honorários líquidos: **R$ 149,91**;
- lucro estimado: **R$ 123,35**;
- margem: **58,50%**;
- markup: **98,68%**;
- parcelas: **R$ 95,93 + R$ 95,93 + R$ 95,97 = R$ 287,83**.

A decomposição por item, base tributável e imposto está em [CALCULOS.md](./CALCULOS.md).

## Efeitos integrados comprovados

- A emissão gerou `ORC-2026-0001`, snapshot e histórico.
- A aprovação vinculou um projeto existente do mesmo cliente, criou um único vínculo e três contas a receber pendentes, sem recebimento antecipado.
- Duas novas tentativas de aprovação, inclusive com chaves diferentes, retornaram resultado idempotente sem duplicar vínculo ou parcelas.
- A oportunidade vinculada passou de Proposta para Ganho e recebeu o projeto.
- A revisão recebeu novo ID, versão 2, mesmo grupo e IDs independentes; ao aprová-la, a versão 1 passou para Substituído.
- O teste integrado de API também comprovou criação de projeto na aprovação, recebimento parcial, bloqueio de pagamento excedente, preservação do recebido em revisão, cancelamento de parcela futura e rollback total de uma aprovação com chave conflitante.
- O relatório geral refletiu somente caixa efetivamente liquidado.

## PDFs

- PDF real do cenário conhecido: 3 páginas, versão de rascunho com marca-d’água e versão emitida sem marca-d’água; valores, itens, tributos, condições e assinaturas presentes; notas, conta financeira, custos e resultado interno ausentes.
- Documento de estresse: 34 itens e texto longo em 8 páginas A4, nas versões emitida e rascunho; rodapé `página X de Y`, cabeçalho de tabela repetido e conteúdo interno oculto.
- A inspeção estrutural automatizada e a renderização visual de páginas representativas foram aprovadas.

## Testes finais

| Validação | Resultado |
|---|---|
| Domínio + API focados | 15/15 aprovados |
| Formulário focado | 2/2 aprovados |
| E2E integrado da Sessão 04 | 4/4 aprovados |
| Web completa | 169/169 aprovados |
| API completa | 161/161 aprovados |
| Electron | 18/18 aprovados |
| Typecheck web + API | aprovado |
| ESLint web | aprovado |
| Build web/API/Electron/NSIS | aprovado |
| PDFs longos emitido + rascunho | 2/2 aprovados, 8 páginas cada |
| Smoke genérico da API empacotada | bloqueado após `/api/orcamentos`, por auditoria da configuração inicial |

Os comandos e saídas estão em [COMANDOS-E-RESULTADOS.md](./COMANDOS-E-RESULTADOS.md).

## Segurança e integridade dos dados

O banco real `data/geogestor.db` não foi aberto para escrita. Antes e depois da campanha permaneceu com **1.990.656 bytes**, modificação em **30/08/2026 14:12:58** e SHA-256 **`BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471`**.

Os testes usaram cópias descartáveis em `scratch/commercial-e2e/run-*`. A execução aprovada foi removida pelo harness. Treze execuções falhas pertencentes a esta campanha foram validadas como filhos diretos do diretório e removidas individualmente. Os PDFs e screenshots no diretório de evidências foram preservados por serem entregáveis. Diretórios `run-*` de campanhas anteriores já existentes não foram alterados.

## Arquivos alterados nesta sessão

O worktree já continha muitas modificações antes da auditoria. A lista abaixo descreve somente os trechos tocados para a Sessão 04; ela não atribui a esta campanha outras alterações preexistentes nos mesmos arquivos.

| Arquivo | Motivo |
|---|---|
| `packages/contracts/src/budgets.ts` | Integridade, soma e limite de parcelas; schemas estritos e limites seguros. |
| `apps/api/src/routes/orcamentos.routes.ts` | Validação relacional de datas/faixas e 404 uniforme. |
| `apps/api/src/services/orcamentos.service.ts` | Projetos nas opções e normalização de parâmetros de precificação. |
| `apps/api/src/orcamentos-domain.test.ts` | Regressões de parcelas inválidas e limite 60. |
| `apps/api/src/orcamentos.integration.test.ts` | Contratos inválidos, catálogo de projetos, modelo ausente e chave normalizada. |
| `apps/web/src/pages/Orcamentos/Orcamentos.tsx` | Erros recuperáveis, projetos no modal e deep link inválido. |
| `apps/web/src/pages/Orcamentos/BudgetDetails.tsx` | Recuperação de 404/UUID e contraste dos detalhes. |
| `apps/web/src/pages/Orcamentos/budgetForm.ts` | Conversão correta de ajustes fixos ao editar. |
| `apps/web/src/pages/Orcamentos/budgetForm.test.ts` | Regressão do valor fixo em centavos. |
| `apps/web/src/utils/loadPdfMake.ts` | Compatibilidade do VFS e fontes com `pdfmake` 0.3. |
| `tests/e2e/session04-budgets.spec.ts` | Jornada integrada e produção de evidências. |
| `docs/auditorias/2026-09-10-comercial-orcamentos/` | Relatório, matriz, achados, cálculos e evidências. |

## Ressalvas e riscos residuais

1. O smoke genérico do pacote falha porque a configuração inicial não produz o evento de auditoria esperado pelo script. O módulo de Orçamentos empacotado respondeu antes dessa barreira, mas a interface instalada completa não foi exercitada.
2. Leitor de tela real, zoom do sistema a 200% e impressão física não estavam disponíveis; Axe, árvore semântica automatizada, renderização PDF e viewports substituíram apenas parte dessa evidência.
3. Não houve campanha visual com mais de 25 propostas nem medição formal de memória/N+1. Os testes de lista e filtros usaram volume pequeno.
4. Expiração foi verificada por contrato/código e estados existentes, não por espera real na virada da data.
5. A UI não percorreu todas as combinações de rejeição, cancelamento, exclusão e projeto novo; esses efeitos foram exercitados na integração de API/SQLite.
6. Não houve dois processos de usuário reais concorrendo; a idempotência foi testada com requisições simultâneas.

## Melhorias não implementadas

| Prioridade | Melhoria | Benefício | Esforço | Risco |
|---|---|---|---|---|
| 1 | Tornar o smoke do pacote independente da auditoria de configuração inicial ou ajustar o evento esperado. | Recupera o gate de release completo. | Médio | Médio, fora de Orçamentos. |
| 2 | Criar fixture paginada com 30–100 propostas para regressão visual. | Cobre última página, mutação e estabilidade dos KPIs. | Médio | Baixo. |
| 3 | Adicionar teste E2E dedicado a todos os modais de transição e descarte. | Amplia confiança de teclado e foco. | Médio | Baixo. |
| 4 | Incluir NVDA e zoom 200% em checklist assistido de release. | Cobre tecnologia assistiva real. | Alto | Baixo. |
| 5 | Medir consulta e geração de PDF com orçamento de 100 itens. | Define orçamento de desempenho e memória. | Médio | Baixo. |

## Recomendação

**Pode iniciar a Sessão 05**, mantendo duas condições: abrir um débito separado para o smoke empacotado da configuração inicial e incluir os 27 bloqueios desta matriz na campanha de regressão/release. Não há bloqueio financeiro conhecido remanescente em Orçamentos após as correções.
