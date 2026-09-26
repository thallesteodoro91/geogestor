# Achados — Sessão 02

Todos os achados confirmados foram corrigidos. Não há achado pendente.

## S02-F01 — Exclusão aceitava cliente com vínculos ativos

- Gravidade/camada: **P1**, API e integridade de dados.
- Rota: `DELETE /api/clientes/:id`.
- Pré-condição: cliente sintético com propriedade, projeto ou orçamento ativo.
- Passos: criar os vínculos e solicitar a exclusão do cliente.
- Esperado: 409 com explicação dos vínculos impeditivos.
- Obtido antes: o cliente podia ser excluído sem uma política completa de restrição.
- Causa raiz: endpoint verificava existência, mas não todas as dependências do domínio.
- Correção: transação consulta propriedades, projetos, orçamentos, tarefas, compromissos, documentos/mapas e oportunidades ativos e devolve conflito enumerado.
- Arquivo: `apps/api/src/routes/clientes.routes.ts`.
- Reteste: integração retorna 409; E2E exibe o bloqueio; após desativar os vínculos retorna 204.

## S02-F02 — Estado órfão após exclusão e repetição não idempotente semanticamente

- Gravidade/camada: **P1**, API, banco e auditoria.
- Rota: `GET/PATCH/DELETE /api/clientes/:id`, dashboard e histórico.
- Pré-condição: cliente sintético com histórico, sem vínculos ativos.
- Passos: excluir e tentar ler, editar, listar histórico ou excluir novamente.
- Esperado: cliente/histórico fora das consultas ativas, 404 posterior e auditoria da exclusão.
- Obtido antes: partes do ciclo ainda consultavam registros logicamente excluídos e o histórico não acompanhava a política.
- Causa raiz: filtros `deleted_at` e cascata lógica não estavam centralizados na transação.
- Correção: exclusão transacional do cliente e histórico, cancelamento de outbox pendente, filtros de ativo e AuditLog.
- Reteste: 204 inicial; GET, PATCH, histórico e DELETE repetido em 404; histórico com `deleted_at` preenchido.

## S02-F03 — Histórico aceitava data impossível/vínculo estrangeiro e não auditava

- Gravidade/camada: **P1**, validação e autorização por relacionamento.
- Rota: `POST/PATCH /api/clientes/:id/historico`.
- Pré-condição: dois clientes e projeto pertencente ao segundo.
- Passos: enviar `2026-02-30` ou o ID do projeto estrangeiro.
- Esperado: 400, nenhuma gravação parcial.
- Obtido antes: validação sintática permissiva e ausência de checagem de propriedade do vínculo.
- Causa raiz: datas e chaves relacionais eram aceitas sem validação de calendário/domínio.
- Correção: data estrita, cliente ativo, projeto/orçamento ativo e pertencente ao mesmo cliente, transação e auditoria.
- Reteste: ambos inválidos retornam 400; válido retorna 201 e cria AuditLog.

## S02-F04 — Preview autenticado falhava ou exigia credencial na URL

- Gravidade/camada: **P1**, frontend/API e segurança.
- Rota: `GET /api/arquivos/preview?path=...`.
- Pré-condição: sessão desbloqueada e PNG anexado.
- Passos: abrir a pré-visualização pelo detalhe do cliente.
- Esperado: 200 sem expor token/sessão na URL.
- Obtido antes: navegação direta do iframe não enviava os cabeçalhos e recebia 423; acrescentar token à query violaria a regressão de segurança.
- Causa raiz: iframe/imagem não consegue aplicar os cabeçalhos usados por `apiFetch`.
- Correção: baixar o Blob com `apiFetch`, gerar Object URL local e revogá-la no cleanup; nenhuma exceção adicional por query string.
- Reteste: resposta 200, conteúdo visível, download 200 e teste web confirma ausência de token efêmero na URL.

## S02-F05 — Lista de arquivos ficava obsoleta após mover a pasta

- Gravidade/camada: **P2**, cache frontend/sistema de arquivos.
- Rota: edição de `/clientes/:id`.
- Pré-condição: cliente com arquivo e nome alterado.
- Passos: renomear o cliente e consultar imediatamente seus arquivos.
- Esperado: caminhos novos e arquivo preservado.
- Obtido antes: queries de arquivo podiam manter o caminho antigo em cache.
- Causa raiz: a mutação invalidava cliente/lista, mas não todas as chaves da central e do mapa.
- Correção: invalidar queries de arquivos do cliente, central, arquivos gerais e geoespaciais depois da renomeação.
- Reteste: caminho contém o nome novo, não contém o antigo e o arquivo continua no disco.

## S02-F06 — Preview sem semântica/teclado suficiente

- Gravidade/camada: **P2**, acessibilidade.
- Rota: aba Arquivos em `/clientes/:id`.
- Passos: abrir preview e navegar por teclado.
- Esperado: diálogo nomeado, Escape, estado anunciado, erro legível e botões por ícone nomeados.
- Obtido antes: overlay visual sem contrato completo de diálogo e ações sem nome explícito.
- Causa raiz: modal montado como `div` visual e ícones usados como única identificação.
- Correção: `role=dialog`, `aria-modal`, título associado, Escape, `role=status`, `role=alert` e `aria-label` nas ações.
- Reteste: E2E fecha por Escape e Axe não aponta violação.

## S02-F07 — Contraste insuficiente em estados secundários

- Gravidade/camada: **P2**, UI/WCAG.
- Rotas: formulário e detalhe do cliente.
- Passos: observar subtítulo, notas, mapa vazio e toast de sucesso no tema claro.
- Esperado: contraste AA e leitura sem depender de cor tênue.
- Obtido antes: combinações claras demais em conteúdo pequeno.
- Causa raiz: tokens de texto decorativo reaproveitados em informação operacional.
- Correção: tons de texto mais escuros e variantes dark coerentes.
- Reteste: Axe sem violações nas telas auditadas e inspeção visual das evidências.

## S02-F08 — Estado vazio filtrado informava que não havia cadastro

- Gravidade/camada: **P2**, UX/estado.
- Rota: `/clientes` com busca/filtros.
- Passos: possuir clientes e buscar termo inexistente.
- Esperado: “Nenhum cliente encontrado” e ação para limpar filtros.
- Obtido antes: mensagem de primeiro cadastro, contradizendo o contador real.
- Causa raiz: decisão do empty state considerava apenas o array filtrado.
- Correção: distinguir filtros ativos de base realmente vazia.
- Reteste: E2E percorre zero real e zero filtrado separadamente.

## S02-F09 — Confirmação de exclusão descrevia política errada

- Gravidade/camada: **P2**, UX e segurança operacional.
- Rota: menu de ações em `/clientes`.
- Passos: iniciar exclusão de cliente.
- Esperado: explicar bloqueios, histórico removido e preservação dos arquivos físicos.
- Obtido antes: texto induzia expectativa de cascata/arquivos incompatível com a política real.
- Causa raiz: cópia desatualizada em relação ao backend e outbox.
- Correção: texto alinhado à restrição e à retenção física.
- Reteste: cancelamento mantém o registro; confirmação respeita 409/204.

## S02-F10 — Barra local transbordava no viewport de evidência

- Gravidade/camada: **P2**, responsividade.
- Rota: `/clientes`.
- Pré-condição: viewport 1120 px com sidebar.
- Passos: abrir lista vazia ou populada.
- Esperado: abas, busca e filtros integralmente visíveis, sem rolagem horizontal.
- Obtido antes: navegação e trailing compartilhavam uma linha larga; a busca era cortada à direita e abas à esquerda na captura.
- Causa raiz: `ModuleNavigation` estava no layout inline e o grupo trailing não refluía.
- Correção: layout responsivo, busca flexível, ações empilháveis e asserção de `scrollWidth <= clientWidth`.
- Reteste: E2E 3/3 em 52,2 s; capturas `01` e `02` revisadas visualmente sem corte.

## Observação de infraestrutura QA

O setup inicial gravava arquivos de teste em uma pasta de perfil fixa. Ele foi alterado para usar `GEOGESTOR_E2E_ROOT/files`, garantindo isolamento e permitindo limpeza determinística. A falha foi tratada como parte da correção de segurança dos dados, sem tocar o perfil real.
