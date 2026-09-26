# Achados — revalidação da Sessão 02

**Um defeito P3 foi reproduzido e corrigido nesta rodada.** Os dez defeitos da auditoria anterior (S02-F01 a S02-F10, quatro P1 e seis P2) constam em [ACHADOS.md da auditoria de 07–08/09](../2026-09-07-comercial-clientes/ACHADOS.md). Os fluxos principais correspondentes passaram novamente nos testes integrados; essa aprovação não significa que todos os casos extremos foram repetidos.

| ID / gravidade | Camada, rota e pré-condição | Reprodução, esperado e obtido | Causa raiz e arquivos | Correção e reteste |
|---|---|---|---|---|
| S02R-F01 / P3 | Frontend, `/clientes/:id`, cliente existente ou excluído/inexistente | Abrir detalhe e procurar o controle “Voltar para clientes”; repetir no estado “Cliente não encontrado”. Esperado: link nativo para `/clientes`. Obtido: `<button>` com `onClick` de navegação nas duas telas. Após adicionar `getByRole('link')`, o E2E falhou na [primeira tela, antes da correção](evidencias/05-navegacao-antes.png), linha 296 da spec. | `ClienteDetalhes.tsx` usava ação programática para navegação, contrariando a diretriz de usar `<Link>` para destino. API e banco não envolvidos. | Dois botões foram trocados por `Link to="/clientes"`; adicionado foco/hover no estado não encontrado e `aria-hidden` no ícone decorativo. A [spec](../../../tests/e2e/session02-clients.spec.ts) exige os dois links e clica no retorno da tela 404. E2E final **2/2** passou, incluindo a [captura após](evidencias/04-cliente-excluido.png); typecheck/lint passaram. |

## Lacunas de evidência

| ID | Itens da matriz | Camada / pré-condição | Evidência obtida | Ensaio que falta | Consequência |
|---|---|---|---|---|---|
| S02R-B01 | C02-29, C02-30 | Detalhe com tarefas, agenda e geometria | Captura do estado vazio, contagens de propriedade/projeto/orçamento | Criar vínculos ativos de tarefa/compromisso; exercitar mapa com geometrias válidas e inválidas, camadas/zoom | Resumos e mapa preenchidos não homologados nesta rodada |
| S02R-B02 | C02-35 | Cliente com múltiplas classes de dependência | HTTP 409 no E2E com propriedade/projeto/orçamento e 409 da integração com propriedade | Isolar cada tipo de vínculo, inclusive tarefa, compromisso e documento, e verificar resposta/atomicidade | Regra de restrição só parcialmente revalidada por tipo |
| S02R-B03 | C02-39, C02-44 | Anexo malicioso ou requisição sem autorização | PNG válido, preview e download autenticados | Matriz segura de MIME, tamanho, vazio, duplicado, nome longo, path traversal, ID alheio e falta de sessão | Validação e confinamento extremos não comprovados |
| S02R-B04 | C02-40, C02-41 | Operação por tecnologia assistiva | Axe sem violações nas telas amostradas, labels e Escape do preview | Percurso completo de teclado e leitor de tela real | WCAG 2.2 AA não pode ser declarado integralmente |
| S02R-B05 | C02-42 | Electron instalado e zoom nativo | Playwright/Edge sem overflow em 360/768/1024/1440; lista clara/escura | Zoom 200%, detalhes em tema escuro e janela nativa | Reflow nativo ainda não homologado |
| S02R-B06 | C02-43 | Rede e duas sessões de edição | Fluxos normais de API/SQLite | Offline, latência, reconexão, duas alterações concorrentes | Recuperação e política de conflito sem evidência |

As lacunas são bloqueios de **cobertura**, não falhas de produto observadas. Não se justificou alteração do código de produção sem reprodução de defeito.
