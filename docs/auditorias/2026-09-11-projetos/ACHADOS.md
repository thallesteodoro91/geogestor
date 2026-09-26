# Achados — Sessão 05: Projetos

Data: 11/09/2026  
Escopo: `/projetos`, `/projetos/:id`, alias `/operacional` e contratos/serviços diretamente consumidos por essas telas.

## Resumo

Foram confirmados e corrigidos **10 defeitos**: **0 P0**, **6 P1** e **4 P2**. Não permaneceu defeito P0/P1 aberto atribuível ao módulo Projetos.

| ID | Severidade | Defeito confirmado | Correção aplicada | Evidência de reteste | Situação |
|---|---:|---|---|---|---|
| S05-F01 | P1 | A criação aceitava cliente inativo e propriedade pertencente a outro cliente. | O serviço de integridade passou a exigir cliente ativo e a rota valida a propriedade contra o cliente informado. | `session05-projects.integration.test.ts` — cenários de cliente inativo e vínculo cruzado. | CORRIGIDO |
| S05-F02 | P1 | O contrato de projeto aceitava enumerações arbitrárias, datas impossíveis, campos extras, coordenada isolada e combinações especializadas inválidas. | Contratos estritos de criação/edição, enums de status/tipo, datas civis reais, limites, par/range de coordenadas e refinamentos de licenciamento/perícia/memorial. | Testes de contrato/API e `projectForm.test.ts`. | CORRIGIDO |
| S05-F03 | P1 | Suspender um projeto não abria decisão financeira pendente e a API aceitava decisão em projeto ativo. | Cancelamento e suspensão agora geram evento pendente; decisão financeira exige estado interrompido. | Integração S05: `409` prematuro, suspensão pendente e decisão posterior válida. | CORRIGIDO |
| S05-F04 | P1 | A decisão de cancelamento podia cancelar parcela vencida ou com vencimento no dia e uma repetição idêntica duplicava eventos. | Somente parcelas futuras, não pagas, são canceladas; limites financeiros foram reforçados e replay idêntico tornou-se idempotente. | Integração S05 cobre futura, vencida, hoje, paga, parcial, limites e replay. | CORRIGIDO |
| S05-F05 | P1 | A exclusão lógica ignorava dependências ativas e repetia `204` para projeto já excluído. | Inspeção transacional de dependências, `409` com resumo acionável, `404` em repetição e `204` somente para exclusão limpa. | Integração S05: dependências, exclusão limpa e repetida. | CORRIGIDO |
| S05-F06 | P2 | Query strings inválidas de visualização, situação, paginação e ordenação permaneciam na URL e produziam requisições inválidas. | Fallback canônico e remoção dos parâmetros inválidos antes da consulta. | E2E abre URL adversarial e confirma `visualizacao=lista` sem os parâmetros inválidos. | CORRIGIDO |
| S05-F07 | P2 | Textos auxiliares dos indicadores/estatísticas tinham contraste insuficiente no tema claro (medição automatizada de 4,43:1). | Tokens de texto passaram de `zinc-500` para `zinc-600` nos conteúdos afetados. | Axe WCAG 2 A/AA/2.1/2.2 sem violações na estatística. | CORRIGIDO |
| S05-F08 | P2 | Rótulos de detalhes e datas financeiras atingiam apenas 2,56:1 no tema claro. | Rótulos e datas passaram a usar cor com contraste AA, preservando o tema escuro. | Axe sem violações na página de detalhe e inspeção visual de `04-detalhe-financeiro.png`. | CORRIGIDO |
| S05-F09 | P1 | O cartão “Custo total executado” somava despesa cancelada e mostrava R$ 30,00, divergindo do contexto financeiro correto de R$ 25,00. | O total local agora exclui registros cancelados ou estornados por marcadores e status. | E2E exige R$ 25,00 no cartão e ausência de R$ 30,00 nele; captura visual atualizada. | CORRIGIDO |
| S05-F10 | P2 | A legenda de distribuição em quatro colunas colidia dentro do card estreito em desktop intermediário. | A legenda usa grade 2×2 com espaçamento horizontal e vertical estável. | Inspeção visual atualizada de `02-estatisticas-calculos.png`, além do teste de overflow. | CORRIGIDO |

## Bloqueio externo observado

O smoke do pacote atualizado abriu a API empacotada, criou banco temporário criptografado e validou `/api/clientes`, `/api/projetos` e `/api/orcamentos` vazios. Depois, parou porque a configuração inicial não produziu o registro de auditoria esperado. Esse comportamento já pertence ao fluxo de Configuração Inicial/Sessão 01 e não foi alterado nesta auditoria para respeitar o escopo.

## Riscos residuais

- Leitor de tela real, zoom a 200%, matriz completa de navegadores e concorrência multiusuário precisam de ambiente/manual dedicado.
- Download, remoção, política de duplicidade, abertura de pasta e persistência de arquivos após reinício não foram promovidos a aprovados porque o E2E desta sessão cobriu somente upload PDF em runtime isolado.
- Não foi detectado erro de integridade no banco real; o SHA-256 permaneceu idêntico antes e depois.
