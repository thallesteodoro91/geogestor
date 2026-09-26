# Achados — Sessão 04

## S04-F01 — Ajuste fixo reaberto com escala 100 vezes maior

- **Gravidade:** P0
- **Camada/rota:** frontend, `/orcamentos/:id/editar`
- **Pré-condição:** rascunho persistido com desconto ou acréscimo global fixo em centavos.
- **Passos:** salvar desconto fixo `852`; reabrir o editor; alterar somente a descrição; salvar.
- **Esperado:** campo exibe `8,52` e o total permanece R$ 287,83.
- **Obtido:** o editor recebia `852` como reais e podia reenviar 85.200 centavos, corrompendo silenciosamente o total.
- **Causa raiz:** `detailToForm` não convertia valores fixos da API, em centavos, para entrada monetária.
- **Arquivos:** `apps/web/src/pages/Orcamentos/budgetForm.ts`, `budgetForm.test.ts`.
- **Correção:** conversão por `centsToCurrencyInput` apenas para ajustes do tipo fixo.
- **Reteste:** teste unitário vermelho/verde e E2E reabriu `8,52`, editou a descrição e confirmou total 28.783 centavos na API.
- **Evidência:** `04-detalhes-rascunho.png`; E2E cenário 3.

## S04-F02 — Geração de PDF quebrada pelo formato do VFS

- **Gravidade:** P1
- **Camada/rota:** frontend, ações “Gerar PDF”.
- **Pré-condição:** `pdfmake` 0.3.11 carregado dinamicamente.
- **Passos:** abrir orçamento; gerar PDF.
- **Esperado:** download de PDF válido.
- **Obtido:** `File 'Roboto-Medium.ttf' not found in virtual file system`.
- **Causa raiz:** o módulo novo de `vfs_fonts` exporta o mapa diretamente e suporta `addVirtualFileSystem`; o carregador só procurava `pdfMake.vfs`/`vfs`.
- **Arquivos:** `apps/web/src/utils/loadPdfMake.ts`.
- **Correção:** aceitar exportação direta, validar Roboto e usar a API nova com fallback legado.
- **Reteste:** dois downloads E2E e dois PDFs de 8 páginas inspecionados/renderizados sem erro.
- **Evidência:** `evidencias/pdfs/`, `evidencias/pdf-longo*/render/report.json`.

## S04-F03 — Condição de pagamento aceitava definição e soma inválidas

- **Gravidade:** P1
- **Camada/rota:** domínio/contrato, criação e aprovação.
- **Pré-condição:** parcelas explícitas ou mistas.
- **Passos:** omitir valor da última parcela, informar valor e percentual juntos, somar valores diferentes do total ou solicitar 61–120 parcelas.
- **Esperado:** rejeição uniforme; resíduo somente no último percentual de uma grade que soma 100%.
- **Obtido:** a última parcela absorvia qualquer diferença; o domínio aceitava até 120 enquanto a UI declarava 60.
- **Causa raiz:** atalho `isLast` substituía a validação e limites divergiam.
- **Arquivos:** `packages/contracts/src/budgets.ts`, `apps/api/src/orcamentos-domain.test.ts`.
- **Correção:** exatamente um modo por parcela, 100% exatos para percentuais, soma exata para valores/misto e limite 60.
- **Reteste:** testes de ausência, soma, limite e residual; E2E confirmou 9.593 + 9.593 + 9.597 = 28.783.

## S04-F04 — Aprovação não oferecia projetos existentes

- **Gravidade:** P1
- **Camada/rota:** API/UI, `GET /api/orcamentos/options`, modal de aprovação.
- **Pré-condição:** cliente com projeto ativo existente.
- **Passos:** abrir aprovação e selecionar vínculo existente.
- **Esperado:** projetos compatíveis disponíveis.
- **Obtido:** a resposta não trazia projetos, bloqueando o fluxo principal na interface.
- **Causa raiz:** agregação de opções omitia a tabela `projetos` e o frontend não consumia esse catálogo.
- **Arquivos:** `apps/api/src/services/orcamentos.service.ts`, `apps/web/src/pages/Orcamentos/Orcamentos.tsx`, testes de integração/E2E.
- **Correção:** retorno tipado de projetos e alimentação do seletor.
- **Reteste:** projeto do cliente apareceu, foi vinculado e houve um único registro em `orcamento_projetos`.

## S04-F05 — Contratos aceitavam campos extras e intervalos incoerentes

- **Gravidade:** P2
- **Camada/rota:** contratos e rotas `/api/orcamentos*`.
- **Pré-condição:** payload com mass assignment, datas impossíveis/invertidas, valores invertidos ou percentuais excessivos.
- **Passos:** enviar campo extra, `2026-02-30`, validade anterior, `issueFrom > issueTo` ou `min > max`.
- **Esperado:** HTTP 400 com mensagem útil e nenhuma escrita.
- **Obtido:** parsing permissivo ou ausência de validação relacional.
- **Causa raiz:** objetos Zod não estritos e refinamentos incompletos.
- **Arquivos:** `packages/contracts/src/budgets.ts`, `apps/api/src/routes/orcamentos.routes.ts`.
- **Correção:** `.strict()`, datas ISO reais, faixas e taxas 0–100%, trims e limites inteiros seguros.
- **Reteste:** integração focada rejeitou todos os payloads e filtros inválidos.

## S04-F06 — Falha de API apresentada como lista vazia

- **Gravidade:** P2
- **Camada/rota:** frontend `/orcamentos`.
- **Pré-condição:** `GET /api/orcamentos?mode=page` retorna 500.
- **Passos:** abrir/recarregar a listagem durante falha controlada.
- **Esperado:** mensagem de erro, causa e ação de recuperação.
- **Obtido:** estado “nenhum orçamento”, que ocultava indisponibilidade.
- **Causa raiz:** ausência de ramo visual para `isError` da lista e KPIs.
- **Arquivos:** `apps/web/src/pages/Orcamentos/Orcamentos.tsx`.
- **Correção:** painéis de erro distintos, `aria-live` e “Tentar novamente”.
- **Reteste:** E2E simulou HTTP 500, exibiu a causa, removeu a falha e recuperou sem reload indevido.
- **Evidência:** `02-lista-erro-recuperavel.png`.

## S04-F07 — Deep link inválido sem recuperação adequada

- **Gravidade:** P2
- **Camada/rota:** frontend `/orcamentos?budgetId=`.
- **Pré-condição:** UUID malformado ou inexistente.
- **Passos:** abrir os dois links diretamente.
- **Esperado:** distinguir formato inválido de 404 e permitir remover a referência.
- **Obtido:** tentativa inútil ou modal sem caminho claro de recuperação.
- **Causa raiz:** validação adiada ao servidor e estado de erro não tratado como fluxo navegável.
- **Arquivos:** `apps/web/src/pages/Orcamentos/BudgetDetails.tsx`, `Orcamentos.tsx`.
- **Correção:** validação local de UUID, mensagem específica e remoção segura de `budgetId`.
- **Reteste:** dois deep links E2E recuperaram a listagem e limparam a URL.

## S04-F08 — PATCH de modelo inexistente retornava sucesso

- **Gravidade:** P2
- **Camada/rota:** API, `PATCH /api/orcamentos/templates/:id`.
- **Pré-condição:** UUID válido sem registro.
- **Passos:** enviar atualização.
- **Esperado:** HTTP 404.
- **Obtido:** HTTP 200 com resultado indefinido.
- **Causa raiz:** retorno do `update` não era verificado.
- **Arquivos:** `apps/api/src/routes/orcamentos.routes.ts`, `orcamentos.integration.test.ts`.
- **Correção:** checagem do registro retornado e `notFound` uniforme.
- **Reteste:** integração confirmou 404 sem escrita.

## S04-F09 — Chave de precificação não era normalizada

- **Gravidade:** P2
- **Camada/rota:** API, `POST /api/orcamentos/pricing-parameters`.
- **Pré-condição:** chave já existente com caixa/espaços diferentes.
- **Passos:** cadastrar `Deslocamento-Integracao` e depois `  deslocamento-integracao  `.
- **Esperado:** mesma chave lógica e atualização idempotente.
- **Obtido:** risco de duplicidade semântica.
- **Causa raiz:** unicidade aplicada antes de trim/lowercase.
- **Arquivos:** `apps/api/src/services/orcamentos.service.ts`, `orcamentos.integration.test.ts`.
- **Correção:** trim/lower da chave e trim de nome/categoria antes da consulta/gravação.
- **Reteste:** o segundo POST retornou o mesmo ID e valor atualizado.

## S04-F10 — Contraste insuficiente nos detalhes

- **Gravidade:** P2
- **Camada/rota:** UI, modal de detalhes.
- **Pré-condição:** texto secundário sobre superfície sutil.
- **Passos:** analisar com Axe WCAG 2.2 AA.
- **Esperado:** nenhum contraste abaixo do mínimo.
- **Obtido:** violações `color-contrast` sérias em textos financeiros e auxiliares.
- **Causa raiz:** token de texto atenuado sobre fundo de baixo contraste.
- **Arquivos:** `apps/web/src/pages/Orcamentos/BudgetDetails.tsx`.
- **Correção:** uso de `text-text-secondary` nas quatro ocorrências afetadas.
- **Reteste:** Axe sem violações na lista, detalhes em claro e revisão aprovada em tema escuro.

