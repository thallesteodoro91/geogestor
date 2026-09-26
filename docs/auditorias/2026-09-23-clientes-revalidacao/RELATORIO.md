# Revalidação da Sessão 02 — Comercial > Clientes

**Status: APROVADA COM RESSALVAS.** Em 23/09/2026, **35 dos 45 itens** da matriz tiveram comprovação suficiente nesta rodada (**34 diretos e 1 após correção**); **9 ficaram bloqueados por cobertura parcial**, **1 não se aplica** e **0 têm defeito pendente**. Um defeito P3 de semântica de navegação foi reproduzido, corrigido e retestado. A jornada final da interface passou **2/2**, três integrações de API passaram **3/3**, e typecheck/lint passaram. Esta conclusão vale para `/clientes` e `/clientes/:id` nos fluxos comprovados; não é homologação do instalador Electron nem de toda a matriz hostil.

## Escopo, linha de base e isolamento

- GeoGestor `v1.0.4` no Windows NT `10.0.26200.0`; frontend React/Vite, API Fastify local, Electron e SQLite/libSQL. Git `main` em `a16551a`; a árvore já continha diversas alterações e specs não rastreadas antes da rodada. Todas foram preservadas.
- Foram lidos o prompt mestre anexado, o inventário e os [achados históricos da Sessão 02](../2026-09-07-comercial-clientes/RELATORIO.md), além do [relatório revalidado da Sessão 01](../2026-09-23-visao-geral-revalidacao/RELATORIO.md). Os dez defeitos corrigidos em setembro anterior não são achados desta rodada.
- Os testes E2E usaram Edge/Playwright com `pt-BR`, movimento reduzido, API e web iniciados pelo executor em portas locais aleatórias, banco por spec em `scratch/commercial-e2e/run-*/` e diretório de arquivos correspondente. A requisição da interface foi usada para obter a origem da API efetivamente conectada; a leitura direta do SQLite usou `GEOGESTOR_E2E_ROOT` da mesma execução. Integrações de API usaram bancos próprios em `scratch`.
- O banco padrão `data/geogestor.db` tinha **2.449.408 bytes** e última modificação em **23/09/2026 18:03:10** antes e depois; não foi mutado. Uma tentativa de SHA-256 falhou porque o arquivo estava aberto por outro processo. A enumeração global de processos/portas permaneceu indisponível no sandbox; nenhum processo desconhecido foi encerrado. Como todos os ensaios mutáveis ocorreram em instâncias descartáveis, não houve necessidade de resetar dados comuns, embora o usuário o tenha autorizado.
- Viewports exercitados: `1120×680` nas capturas, `360×800`, `768×800`, `1024×800` e `1440×800` nas asserções de reflow. Tema escuro foi exercitado na lista; zoom nativo de 200% e janela Electron instalada ficaram bloqueados.

## Resultado funcional e de persistência

A [matriz de 45 itens](MATRIZ-DE-COBERTURA.md) cobre acesso, lista vazia, busca sem resultados, 32 clientes, filtros combinados, ordenação, paginação, URL e recarga; cadastro PF com todos os grupos do formulário, validação/foco, cancelamento e descarte; edição e persistência; detalhes e abas; histórico CRM, notas, propriedade, projeto e orçamento vinculados; upload, preview, download, renomeação de pasta e exclusão física do anexo; restrição e exclusão lógica do cliente. O teste de listagem adicional percorreu mais de 500 registros em banco isolado.

Na interface, o cliente sintético foi criado, localizado, editado, recarregado e excluído. O PNG `QA-AUDIT-S02-evidência ÁÇÃO.PNG` foi enviado, encontrado após o rename da pasta, pré-visualizado e baixado com autenticação, removido pela API e confirmado ausente no disco. A exclusão do cliente foi recusada com vínculos ativos (`409`), depois aceita com esses vínculos desativados no ambiente descartável, e seu endpoint retornou `404`. A integração específica confirmou rejeição de data impossível e projeto de outro cliente (`400`), criação de histórico (`201`) com `audit_logs`, exclusão lógica (`204`), histórico oculto e `404` para acesso e edição posteriores.

O E2E exigiu ausência de novos erros de console fora das respostas 409/404 esperadas, Axe sem violações nas amostras e ausência de rolagem horizontal nas larguras exercitadas. As capturas mostram [lista vazia](evidencias/01-clientes-vazio.png), [lista populada](evidencias/02-clientes-populado.png), [detalhe após correção](evidencias/03-cliente-detalhes.png) e [estado após exclusão após correção](evidencias/04-cliente-excluido.png). As duas primeiras foram preservadas da primeira execução aprovada; as duas últimas vieram da execução final. A [captura da falha anterior](evidencias/05-navegacao-antes.png) mostra o controle de retorno original.

## Achados e alterações

**1 defeito novo P3, 1 correção de produção, 0 reprovações pendentes.** A [asserção nova falhou antes da correção](evidencias/05-navegacao-antes.png): os controles de retorno do detalhe existente e do estado “Cliente não encontrado” eram botões com navegação programática, contrariando as diretrizes do projeto. Ambos agora são links nativos para `/clientes`, e a spec verifica seu papel; no estado 404, também clica e confirma a lista. O [registro de achados](ACHADOS.md) detalha causa, arquivo e reteste, além de seis grupos de lacunas de evidência.

Arquivos alterados nesta rodada:

| Arquivo | Motivo |
|---|---|
| `apps/web/src/pages/Clientes/ClienteDetalhes.tsx` | Correção S02R-F01: dois retornos para a lista agora usam `Link`; foco/hover no estado 404 e ícone decorativo oculto da árvore acessível. |
| `tests/e2e/session02-clients.spec.ts` | Ampliação da spec preexistente para verificar reflow de lista/detalhes em 360, 768, 1024 e 1440 px, além da alternância claro/escuro na lista. |
| `docs/auditorias/2026-09-23-clientes-revalidacao/` | Nova matriz, relatório, achados, comandos, resumo E2E e quatro capturas. |

A spec também passou a exigir os dois links e a navegação de retorno do estado 404. A revisão do Git confirmou que a spec já era não rastreada e que as muitas mudanças alheias à rodada foram mantidas.

## Comandos, limpeza e evidências

A [lista de comandos e resultados](COMANDOS-E-RESULTADOS.md) registra três execuções E2E **2/2** e uma execução focada **0/1 antes da correção**, a integração do ciclo de vida **1/1**, duas integrações adicionais **2/2**, `pnpm run typecheck` e `pnpm run lint` com saída 0. O [resumo da execução final](evidencias/e2e-summary.json) tem SHA-256 `D1D964C3AFE5121AE851ADAE6762F5494B126F5EC0B10BCBCE721235CDA3D674`.

**Limpeza concluída para os dados criados nesta rodada.** O executor removeu os três diretórios `run-*` aprovados após sucesso; o diretório da falha reproduzida foi removido manualmente após preservar a captura. A inexistência dos quatro caminhos foi confirmada. Os três diretórios de integração da rodada foram removidos pelo caminho exato após verificação de criação em 23/09/2026. Não restaram registros, anexos nem relacionamentos sintéticos desta rodada no banco/pasta de QA. Diretórios históricos preexistentes em `scratch` permaneceram intactos. O banco padrão conservou tamanho e hora de modificação.

## Ressalvas e próxima sessão

Os **9 itens bloqueados** são C02-29/30 (resumos preenchidos de tarefas/agenda e mapa completo), C02-35 (cada classe de dependência isoladamente), C02-39/44 (segurança e arquivos hostis), C02-40/41 (teclado completo e leitor de tela), C02-42 (zoom/Electron nativo) e C02-43 (rede lenta/offline e concorrência). São limites de comprovação; nenhum P0/P1/P2 ficou pendente. A [Sessão 01 revalidada](../2026-09-23-visao-geral-revalidacao/RELATORIO.md) também mantém bloqueios transversais de rede, acessibilidade e zoom.

Melhorias **não implementadas**, separadas das correções:

| Prioridade | Proposta | Benefício | Esforço / risco |
|---|---|---|---|
| 1 | Matriz isolada de MIME, tamanho, duplicidade, nome longo e travessia de caminho nos arquivos do cliente | Evidência de validação e confinamento | Médio / baixo se limitada a banco e FS descartáveis |
| 2 | Ensaio de tarefas, agenda e mapa com dados válidos/inválidos iniciados no detalhe do cliente | Fecha resumos e controles visuais | Médio / baixo |
| 3 | Política explícita para duas edições simultâneas do mesmo cliente | Evita perda silenciosa de atualização | Alto / médio; pode exigir decisão de produto e contrato de versão |

**Recomendação:** iniciar a Sessão 03 (CRM e Funil) mantendo esses nove itens em backlog de homologação transversal e repetindo a integração de cliente quando o CRM criar/converter vínculos. O escopo funcional de Clientes exercitado nesta rodada não apresenta defeito confirmado pendente.
