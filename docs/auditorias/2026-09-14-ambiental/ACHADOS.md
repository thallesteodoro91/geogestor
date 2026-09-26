# Achados — Sessão 06: Ambiental

Foram confirmados **18 defeitos: 0 P0, 6 P1, 12 P2 e 0 P3**. Todos foram corrigidos e retestados; não há achado reprovado aberto no escopo.

**Revalidação de 14/09/2026:** nenhum defeito de produto novo foi confirmado e nenhum dos 18 achados reabriu. Houve uma correção apenas no sincronismo do teste E2E: a auditoria Axe aguardava o fechamento visual, mas não a desmontagem do diálogo animado, gerando um falso positivo transitório de contraste. O teste passou a aguardar `dialog = 0` antes da varredura; a repetição fechou em 5/5 e zero violação. Esse ajuste não altera produção nem entra na contagem de defeitos do produto.

## S06-A01 — Próxima ação podia ocultar tarefa atrasada

- **Severidade/camada/rota:** P1, API/SQL, `GET /api/ambiental`.
- **Pré-condição:** demanda com tarefa aberta sem prazo e outra tarefa aberta atrasada.
- **Passos:** listar demandas e comparar `proximaAcao` com as tarefas persistidas.
- **Esperado:** a tarefa atrasada com prazo é a próxima ação.
- **Obtido:** a tarefa sem prazo era ordenada primeiro.
- **Causa raiz:** ordenação SQLite de `NULL` antes das datas crescentes.
- **Correção:** ordenação explícita de prazos nulos por último, seguida de prazo e atualização.
- **Arquivos/efeitos:** `ambiental.routes.ts`; tabelas `tarefas`/`projetos`.
- **Evidência/reteste:** teste S06 falhou em RED e passou em GREEN; API completa 185/185 na revalidação; E2E confirmou o título atrasado.

## S06-A02 — Exclusão de licença mantinha condicionantes ativas

- **Severidade/camada/rota:** P1, API/persistência, `DELETE /api/licencas/:id`.
- **Pré-condição:** licença sintética com condicionantes em estados diferentes.
- **Passos:** excluir a licença e consultar detalhe, condições, resumo e alertas.
- **Esperado:** exclusão lógica coerente da licença e das filhas, sem alerta órfão.
- **Obtido:** filhas permaneciam elegíveis para contagem/alerta.
- **Causa raiz:** soft delete limitado à linha da licença.
- **Correção:** cascata lógica transacional das condicionantes e auditoria dentro da mesma transação.
- **Arquivos/efeitos:** `licencas.routes.ts`; `licencas`, `condicionantes_ambientais`, `audit_logs`.
- **Evidência/reteste:** integração S06 e regressão API 185/185 na revalidação.

## S06-A03 — Alertas ambientais ignoravam exclusão/encerramento de ancestrais

- **Severidade/camada/rota:** P1, serviço de alertas, `GET /api/alertas/resumo`.
- **Pré-condição:** licença, projeto ou condicionante removida; licença encerrada.
- **Passos:** materializar ocorrências antes/depois da mutação.
- **Esperado:** itens inativos não geram ocorrência.
- **Obtido:** joins incompletos permitiam alertas residuais.
- **Causa raiz:** filtros apenas no registro terminal.
- **Correção:** joins e filtros de `deletedAt`/estado em toda a cadeia projeto–licença–condicionante.
- **Arquivos/efeitos:** `deadline-alerts.service.ts`; ocorrências e configurações de alerta.
- **Evidência/reteste:** integração S06, fronteiras E2E e regressão API.

## S06-A04 — Calculadora aceitava valores sintaticamente ou fisicamente inválidos

- **Severidade/camada/rota:** P1, frontend/cálculo CAR, `/ambiental?tab=car`.
- **Pré-condição:** `1e4`, texto, negativos, parcelas maiores que o imóvel ou soma acima do total.
- **Passos:** preencher os campos e observar resultado/salvamento.
- **Esperado:** análise inválida, mensagem acionável e salvamento indisponível.
- **Obtido:** coerção numérica aceitava notação científica e faltavam invariantes territoriais.
- **Causa raiz:** `Number()` sem gramática decimal e validação cruzada incompleta.
- **Correção:** parser decimal pt-BR estrito e invariantes para total, APP, vegetação, módulos e remanescente.
- **Arquivos/efeitos:** `environmentalCalculation.ts`, `CalculadoraAmbiental.tsx`, `NumericInput.tsx`.
- **Evidência/reteste:** unit CAR/PDF 8/8; web 192/192 na revalidação; E2E captura 05.

## S06-A05 — JSON legado inválido derrubava o histórico de cálculos

- **Severidade/camada/rota:** P1, API/frontend, `GET /api/dados-operacionais/calculos?tipo=ambiental`.
- **Pré-condição:** registro legado com `entradas_json`/`resultado_json` malformados.
- **Passos:** abrir o histórico CAR.
- **Esperado:** item marcado como legado inválido, demais itens preservados.
- **Obtido:** exceção de parse comprometia a lista.
- **Causa raiz:** `JSON.parse` sem isolamento por registro.
- **Correção:** desserialização tolerante com marcador sanitizado “Dados legados inválidos”.
- **Arquivos/efeitos:** `operational-data.routes.ts`, `CalculationHistory.tsx`.
- **Evidência/reteste:** integração S06 e E2E do histórico resiliente.

## S06-A06 — Vínculos de licença/cálculo podiam divergir do projeto

- **Severidade/camada/rota:** P1, API/integridade, POST/PATCH licenças e POST cálculos.
- **Pré-condição:** cliente inativo, `clienteId` de terceiro ou projeto incompatível.
- **Passos:** enviar payload manipulado diretamente à API.
- **Esperado:** 409/400 e nenhuma escrita.
- **Obtido:** validação relacional não cobria todas as combinações; PATCH permitia tentativa de reatribuição.
- **Causa raiz:** resolução de vínculos distribuída e incompleta.
- **Correção:** serviço comum de integridade, exigência de cliente ativo e rejeição de reatribuição de projeto.
- **Arquivos/efeitos:** `relationship-integrity.service.ts`, `licencas.routes.ts`, `operational-data.routes.ts`.
- **Evidência/reteste:** integração S06 e API completa.

## S06-A07 — Query de demandas aceitava paginação e datas inválidas

- **Severidade/camada/rota:** P2, API, `GET /api/ambiental`.
- **Reprodução:** `page=0`, `page=1.5`, `limit=101`, `inicio=2026-02-30` ou intervalo invertido.
- **Esperado/obtido:** deveria responder 400; coerções/strings passavam parcialmente.
- **Causa/correção:** contrato permissivo; schema estrito com inteiros, limites, data de calendário e ordem do período.
- **Arquivos/evidência:** `environmental.ts`, `ambiental.routes.ts`; integração S06 e 185/185 na revalidação.

## S06-A08 — Fase e andamento aceitavam valores fora do domínio

- **Severidade/camada/rota:** P2, API, `PATCH /api/ambiental/:id/fase`, `POST .../andamentos`.
- **Reprodução:** fase inventada, categoria vazia, data impossível e chave extra.
- **Esperado/obtido:** 400 sem efeito; antes havia aceitação parcial e validação textual superficial.
- **Causa/correção:** schemas não canônicos; enums, limites, datas reais e `.strict()`.
- **Arquivos/evidência:** `environmental.ts`, `ambiental.routes.ts`; integração e E2E.

## S06-A09 — Contrato de licença era permissivo e PATCH não validava o objeto mesclado

- **Severidade/camada/rota:** P2, API, POST/PUT/PATCH `/api/licencas`.
- **Reprodução:** campo extra, status desconhecido, data impossível ou PATCH que torna emissão/vencimento incompatíveis.
- **Esperado/obtido:** rejeição uniforme; validações variavam por método.
- **Causa/correção:** schemas separados e validação somente do fragmento; contrato estrito e validação pós-merge.
- **Arquivos/evidência:** `licencas.routes.ts`, `environmental.ts`; integração S06.

## S06-A10 — Condicionante podia ser consultada/mutada sem validar a licença pai

- **Severidade/camada/rota:** P2, API, rotas aninhadas de condicionantes.
- **Reprodução:** licença A na URL com `conditionId` de B, ou licença removida/inexistente.
- **Esperado/obtido:** 404 seguro; a checagem do pai era incompleta em alguns métodos.
- **Causa/correção:** consulta por ID terminal; escopo por `licencaId`, pai ativo e condição não removida.
- **Arquivos/evidência:** `licencas.routes.ts`; integração S06.

## S06-A11 — Data/status de condicionante podia ficar incoerente

- **Severidade/camada/rota:** P2, API/UI, PATCH de condicionante.
- **Reprodução:** marcar Cumprida sem data ou voltar a Pendente mantendo `dataCumprimento`.
- **Esperado/obtido:** Cumprida exige data; outros estados limpam a data; antes o PATCH parcial podia preservar combinação inválida.
- **Causa/correção:** regra aplicada antes do merge; validação pós-merge e limpeza explícita.
- **Arquivos/evidência:** `licencas.routes.ts`, `ConditionFormModal.tsx`; integração/E2E.

## S06-A12 — Cálculo de “hoje” dependia de UTC

- **Severidade/camada/rota:** P2, datas/UI/API, licenças e condicionantes.
- **Reprodução:** comparar limite na borda do dia em Brasília.
- **Esperado/obtido:** dia civil `America/Sao_Paulo`; conversão UTC podia deslocar a fronteira.
- **Causa/correção:** uso de ISO UTC para data local; helper de data civil local e comparações inclusivas.
- **Arquivos/evidência:** `licencas.routes.ts`, `deadline-alerts.service.ts`, `LicencaDetalhes.tsx`; testes de −1/0/30/60/90/120/121.

## S06-A13 — Status legado desconhecido era mascarado

- **Severidade/camada/rota:** P2, API/UI, listas/detalhe de licença.
- **Reprodução:** persistir `Status legado inesperado`.
- **Esperado/obtido:** preservar e sinalizar; antes a normalização podia aparentar um estado canônico.
- **Causa/correção:** fallback sem metadado; campos `statusRegistrado` e `statusRegistradoReconhecido`.
- **Arquivos/evidência:** `licencas.routes.ts`, `LicencaDetalhes.tsx`; E2E.

## S06-A14 — Salvamento CAR aceitava contrato/vínculo incompatível

- **Severidade/camada/rota:** P2, API, `POST /api/dados-operacionais/calculos`.
- **Reprodução:** chave extra, data inválida ou projeto Rural para cálculo ambiental.
- **Esperado/obtido:** 400/409; o tipo do projeto não era garantido.
- **Causa/correção:** schema genérico e vínculo sem compatibilidade; contrato estrito e tipo Ambiental exigido.
- **Arquivos/evidência:** `operational-data.routes.ts`, `relationship-integrity.service.ts`; integração S06.

## S06-A15 — URL inválida podia manter estado oculto

- **Severidade/camada/rota:** P2, frontend, `/ambiental`.
- **Reprodução:** aba ausente/inválida combinada com `action` não pertencente à aba.
- **Esperado/obtido:** fallback canônico sem modal invisível; parâmetros podiam sobreviver.
- **Causa/correção:** normalização visual sem saneamento da query; canonização e remoção seletiva de `action`.
- **Arquivos/evidência:** `ListagemAmbiental.tsx`; web test/E2E.

## S06-A16 — Deep link informava, mas não localizava a condicionante

- **Severidade/camada/rota:** P2, acessibilidade/UX, detalhe de licença.
- **Reprodução:** abrir `?condicionante=:id` partindo de alerta.
- **Esperado/obtido:** aba ativa, destaque e foco; o item permanecia difícil de localizar.
- **Causa/correção:** consumo do parâmetro antes do commit da aba; efeito em duas etapas após render, com scroll, foco e destaque.
- **Arquivos/evidência:** `LicencaDetalhes.tsx`; E2E captura 04.

## S06-A17 — Modal/PDF tinham riscos de acessibilidade e nome de arquivo

- **Severidade/camada/rota:** P2, frontend/PDF, detalhe ambiental.
- **Reprodução:** projeto com `Área <Norte> / CAR? *`, teclado e geração repetida.
- **Esperado/obtido:** nome Windows seguro, labels, data pt-BR, retorno de foco e identidade neutra; havia caracteres reservados e defaults inadequados.
- **Causa/correção:** sanitização parcial e formulário sem metadados completos; sanitizador dedicado, limites, labels/names/autocomplete, estado pendente e toast.
- **Arquivos/evidência:** `GeradorLaudoModal.tsx`, `laudoPdfGenerator.ts`; unit e quatro PDFs E2E.

## S06-A18 — Contraste insuficiente e smoke incompatível com paginação

- **Severidade/camada/rota:** P2, UI/release, detalhe de demanda/licença e `/api/audit-logs`.
- **Reprodução:** Axe encontrou 2,56:1 em metadados; smoke esperava array após endpoint virar objeto paginado.
- **Esperado/obtido:** AA e smoke verde; ambos falharam antes da correção.
- **Causa/correção:** `text-zinc-400` sobre branco e consumidor com shape antigo; contraste elevado e leitura retrocompatível de `items`.
- **Arquivos/evidência:** `AmbientalDetalhes.tsx`, `LicencaDetalhes.tsx`, `smoke-packaged-api.mjs`; Axe zero violações e smoke aprovado.
