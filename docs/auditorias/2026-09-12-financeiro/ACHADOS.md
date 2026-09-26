# Achados — Sessão 07: Financeiro

Foram confirmados **10 defeitos: 0 P0, 5 P1, 5 P2 e 0 P3**. Todos foram corrigidos e retestados; não há achado reprovado aberto.

## S07-F01 — Datas e payloads financeiros permissivos

- **Severidade/camada:** P1, API/contratos.
- **Reprodução:** enviar `2026-02-30`, período invertido, chave desconhecida ou PATCH vazio nas rotas financeiras.
- **Esperado/obtido:** 400 sem escrita; antes datas apenas pareciam ISO e campos extras eram descartados.
- **Causa:** schemas textuais e não estritos.
- **Correção:** calendário real, limites monetários/textuais, `.strict()` e refinamentos de coerência.
- **Reteste:** integração S07, regressão API 169/169 e E2E 4/4.

## S07-F02 — Vínculos inativos ou incompatíveis podiam receber lançamentos

- **Severidade/camada:** P1, API/integridade relacional.
- **Reprodução:** criar despesa, viagem ou nota com cliente excluído, projeto excluído ou projeto de outro cliente.
- **Esperado/obtido:** 404/409 sem escrita; havia caminhos que aceitavam o ID existente sem conferir atividade e pertença.
- **Causa:** validação distribuída e incompleta.
- **Correção:** resolução explícita de cliente/projeto ativos e checagem da relação antes da mutação.
- **Reteste:** integração adversarial e regressão completa.

## S07-F03 — Filtro de despesas vencidas não correspondia ao resumo

- **Severidade/camada:** P1, API/SQL, `GET /api/financeiro/despesas`.
- **Reprodução:** manter despesa persistida como Pendente com vencimento anterior ao dia civil e filtrar Vencida.
- **Esperado/obtido:** item e resumo no mesmo universo; a linha não aparecia porque o filtro usava apenas o status armazenado.
- **Causa:** status efetivo era calculado parcialmente e depois do filtro.
- **Correção:** expressão única para status efetivo, aplicada à listagem, ao filtro e ao resumo da consulta.
- **Reteste:** integração S07 e alerta E2E “Contas vencidas” de R$ 300,00.

## S07-F04 — Nota fiscal aceitava URL e substituição inseguras

- **Severidade/camada:** P1, API/segurança e integridade.
- **Reprodução:** criar nota com `javascript:` ou indicar substituta inexistente, cancelada ou de outro cliente.
- **Esperado/obtido:** rejeição; o contrato aceitava string de URL ampla e ID sem validar a entidade alvo.
- **Causa:** schema genérico e ausência de validação relacional da substituição.
- **Correção:** somente HTTP/HTTPS, nota substituta existente, ativa e do mesmo cliente.
- **Reteste:** integração S07 e regressão API.

## S07-F05 — Comprovante de despesa era consultado sem o cliente obrigatório

- **Severidade/camada:** P1, frontend/API.
- **Reprodução:** editar despesa com comprovante e abrir o seletor.
- **Esperado/obtido:** documentos do cliente/projeto; a chamada a `/api/financeiro/comprovantes` omitia `clienteId` e falhava silenciosamente.
- **Causa:** query key e parâmetros incompletos.
- **Correção:** habilitação condicionada ao cliente e envio de `clienteId` mais `projetoId` opcional.
- **Reteste:** teste de consolidação web 10/10 e regressão web 182/182.

## S07-F06 — Dia civil podia mudar pela conversão UTC

- **Severidade/camada:** P2, API/frontend.
- **Reprodução:** comparar defaults e vencimento perto da borda do dia em `America/Sao_Paulo`.
- **Esperado/obtido:** data civil local; `toISOString().slice(0, 10)` podia avançar/recuar o dia.
- **Causa:** uso de UTC para domínio civil.
- **Correção:** helpers locais para chave e exibição de data, usados no overview, faturas e despesas.
- **Reteste:** unitários de `localDate`, integração de períodos e E2E.

## S07-F07 — Abas não implementavam navegação de teclado completa

- **Severidade/camada:** P2, acessibilidade/UX.
- **Reprodução:** focar aba principal ou auxiliar e usar setas, Home e End.
- **Esperado/obtido:** roving tabindex e painel associado; antes havia clique e atributos incompletos.
- **Causa:** abas visuais sem o padrão WAI-ARIA integral.
- **Correção:** setas horizontais/verticais, Home/End, foco programático, `aria-controls` e `tabpanel`.
- **Reteste:** fonte web e E2E de teclado.

## S07-F08 — Erro de listagem parecia ausência de dados

- **Severidade/camada:** P2, frontend/resiliência.
- **Reprodução:** responder 500 em parcelas ou despesas.
- **Esperado/obtido:** alerta e ação de repetir; a tela exibia estado vazio, induzindo interpretação financeira errada.
- **Causa:** ramo visual compartilhado entre erro e lista vazia.
- **Correção:** `role="alert"`, texto acionável e botão de nova tentativa.
- **Reteste:** interceptação E2E de ambas as APIs, seguida de recuperação.

## S07-F09 — Gráfico continha foco dentro de região oculta

- **Severidade/camada:** P2, acessibilidade.
- **Reprodução:** executar Axe na visão geral.
- **Esperado/obtido:** zero violação; elementos SVG focalizáveis eram descendentes de `aria-hidden`.
- **Causa:** camada acessível automática do Recharts incompatível com o invólucro decorativo.
- **Correção:** desativação explícita da camada acessível do gráfico decorativo, mantendo os dados textuais adjacentes.
- **Reteste:** Axe WCAG 2.2 A/AA sem violações.

## S07-F10 — Resultado positivo tinha contraste de 3,76:1

- **Severidade/camada:** P2, acessibilidade visual.
- **Reprodução:** Axe na tabela de rentabilidade em tema claro.
- **Esperado/obtido:** pelo menos 4,5:1; verde anterior media 3,76:1.
- **Causa:** token de cor muito claro sobre fundo branco.
- **Correção:** `emerald-700` no tema claro e `emerald-400` no escuro.
- **Reteste:** Axe final com zero violação; captura da visão geral.

## Regressão evitada durante a correção

Uma primeira versão do endurecimento exigiu UUID em todos os IDs. A regressão completa revelou o contrato legado `client-audit` usado na atomicidade de auditoria. O schema final mantém IDs não vazios e limitados para compatibilidade, sem reabrir as demais validações. O teste transacional e a suíte S07 fecharam 7/7 antes da regressão integral 169/169.
