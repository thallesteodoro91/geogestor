# Prompt de auditoria — Sessão 03: Comercial — CRM e Funil

Você atuará como engenheiro sênior de QA full stack, especialista em aplicações desktop, UX, acessibilidade, integridade de dados, segurança e sistemas comerciais. Sua tarefa é **AUDITAR, CORRIGIR E RETESTAR** somente a Sessão 03 do GeoGestor até obter evidências suficientes sobre tudo o que pertence ao escopo.

## Configuração da sessão

- Sessão atual: **03 — Comercial — CRM e Funil**.
- Módulo/menu: **Comercial > CRM**.
- Rotas principais: **`/crm`**, incluindo os estados `?view=leads`, `?view=funil` e `?view=indicadores`; verificar o redirecionamento legado de `/contatos` somente como compatibilidade.
- Integrações permitidas: acessar `/clientes/:id`, `/orcamentos`, `/orcamentos/novo`, `/projetos/:id` e `/` somente quando um fluxo iniciado no CRM criar, vincular, converter ou resumir esses registros. Não auditar integralmente esses outros módulos.
- Foco especial: Leads; Funil de vendas; Indicadores; criação, edição, busca, filtros, paginação, exclusão e conversão de leads; criação, edição, detalhamento, movimentação, reordenação, ganho, perda, reabertura e exclusão de oportunidades; vínculos com cliente, lead, orçamento e projeto; histórico de etapas; próximas ações; datas; valores; probabilidades; cálculos do pipeline; estados vazios, parciais, carregamento e erro; persistência na URL, API e banco; acessibilidade e usabilidade do kanban.
- Relatórios anteriores obrigatórios:
  - `docs/auditorias/2026-09-07-visao-geral/RELATORIO.md`
  - `docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md`
- Implementar correções comprovadas: **SIM**.
- Implementar novas funcionalidades ou mudanças de produto: **NÃO, sem aprovação expressa**.
- Diretório dos entregáveis: `docs/auditorias/[AAAA-MM-DD]-comercial-crm-funil/`.

## Objetivo

Validar de ponta a ponta cada visão, cartão, coluna, indicador, filtro, campo, modal, menu, botão, link, atalho e ação presente no CRM. Não aprove uma função porque o código parece correto ou a API respondeu HTTP 200. Comprove o resultado na interface real, na API e, quando aplicável, no banco de dados, na trilha de auditoria e nos módulos imediatamente integrados.

Corrija somente defeitos reproduzidos e pertencentes ao escopo. Após cada correção, execute teste automatizado focado, reteste manual/integrado e regressão proporcional ao risco.

## Dados mínimos obrigatórios

Crie tudo somente em banco e diretório descartáveis, com prefixo único `QA-AUDIT-S03-[DATA-HORA]-`:

1. Um cliente sintético ativo criado ou reutilizado apenas dentro do ambiente de QA.
2. Um lead ativo sem cliente e sem oportunidade.
3. Um lead ativo destinado a gerar um cliente novo na conversão.
4. Um lead com e-mail ou telefone correspondente ao cliente sintético, para validar associação sem duplicação.
5. Um lead convertido, com vínculo verificável ao cliente e à oportunidade.
6. Pelo menos uma oportunidade em cada etapa: `Prospectado`, `Contato`, `Proposta`, `Ganho` e `Perdido`.
7. Oportunidades com valores conhecidos e probabilidades diferentes para recalcular pipeline aberto e ponderado.
8. Uma oportunidade com próxima ação atrasada, uma com ação no dia atual, uma futura e uma sem próxima ação.
9. Uma oportunidade parada há mais de 14 dias e outra movimentada recentemente.
10. Um orçamento sintético pertencente ao cliente de QA, somente para testar vínculo e navegação.
11. Um projeto sintético criado pela conversão de uma oportunidade, somente se o fluxo estiver disponível.
12. Casos de zero dados, dados parciais, textos longos, acentos, espaços nas bordas e valores-limite.

Use valores que permitam calcular manualmente todos os indicadores. Registre previamente os resultados esperados.

## Regras de escopo e conduta

1. Leia integralmente todos os `AGENTS.md` aplicáveis e respeite as Web Interface Guidelines.
2. Leia os dois relatórios anteriores, incorpore os riscos transversais e não refaça trabalho alheio sem motivo.
3. Verifique o estado do Git antes de editar. Preserve todas as alterações preexistentes e não reverta mudanças do usuário.
4. Trabalhe somente no CRM e nas integrações imediatamente iniciadas por ele.
5. Não pare após planejar ou ler código. Abra e use a aplicação real.
6. Todo item inventariado deve terminar como `APROVADO`, `REPROVADO`, `BLOQUEADO` ou `NÃO APLICÁVEL`, com evidência.
7. Não esconda falhas com mocks. Interceptações podem produzir erros controlados, mas o caminho aprovado deve usar frontend, API e banco reais.
8. Não redesenhe o CRM e não crie recursos de produto durante a correção.
9. Registre separadamente melhorias não implementadas, com benefício, esforço e risco.
10. Envie atualizações curtas ao concluir inventário, testes de leads, testes do funil, backend/persistência, correções e reteste.
11. Não avance para a Sessão 04.

## Segurança dos dados de teste

1. Descubra qual banco, raiz de arquivos e processos estão realmente ativos antes de qualquer mutação.
2. Confirme que a aplicação de QA aponta para uma instância isolada; produza snapshot verificável quando necessário.
3. Nunca altere ou exclua clientes, leads, oportunidades, orçamentos ou projetos preexistentes.
4. Antes de excluir, valide na interface, API e banco o nome e o ID exatos do registro sintético.
5. Conversão de lead, exclusão em cascata, reordenação em massa e criação de projeto devem ocorrer somente no ambiente descartável.
6. Ao final, remova apenas os dados desta sessão e confirme ausência de registros, históricos, relações e pastas órfãs.
7. Se a limpeza falhar, não faça limpeza ampla: registre tabela, ID, nome e caminho de cada resíduo.

## Fase 1 — Preparação e linha de base

1. Identifique Electron, frontend, API, banco, portas, comandos, suíte de testes e processo em execução.
2. Verifique Git, processos, logs recentes, saúde e erros já existentes.
3. Confirme a conexão frontend → API → banco isolado.
4. Registre versão do aplicativo, sistema, Node, gerenciador, commit, viewport, tema e configuração de movimento.
5. Registre a linha de base das tabelas e entidades: contatos/leads, oportunidades, histórico de etapas, clientes, orçamentos, projetos e auditoria.
6. Abra `/crm?view=leads`, `/crm?view=funil` e `/crm?view=indicadores` antes de criar dados e capture os estados vazios reais.
7. Crie a matriz de cobertura antes de iniciar mutações.

## Fase 2 — Inventário obrigatório

Para cada item, registre:

- ID;
- rota, visão, seção ou modal;
- controle/fluxo e ação esperada;
- componente do frontend;
- endpoint e método;
- tabela/entidade e efeitos relacionados;
- cenários positivo, negativo, vazio, carregamento e erro;
- situação final e evidência.

Faça varredura da interface e do código para incluir elementos condicionais: menu de seções, métricas, ações de cartão, filtros recolhíveis, chips ativos, estados de atenção, drag and drop, modal de detalhes, histórico, confirmações, paginação, vínculos e ações que aparecem somente para determinadas etapas ou tipos de vínculo.

## Fase 3 — Navegação, estado e visão Indicadores

1. Abra as três visões pelo menu local, por URL direta e pelos parâmetros `view`.
2. Teste voltar, avançar, reload, deep link, parâmetro inválido, rota legada `/contatos` e estado ativo do menu Comercial.
3. Confirme se busca, filtros, página e visão relevante estão refletidos na URL e permanecem após reload quando essa for a regra do produto.
4. Teste carregando, vazio, dados parciais, erro da API, tentativa de recuperação e operação lenta controlada.
5. Valide todos os indicadores, inclusive:
   - leads ativos;
   - leads convertidos;
   - taxa de conversão de leads;
   - pipeline em aberto;
   - pipeline ponderado;
   - oportunidades ativas;
   - oportunidades ganhas e valor ganho;
   - oportunidades perdidas;
   - próximas ações atrasadas;
   - oportunidades paradas;
   - quantidade, valor e média de dias por etapa.
6. Recalcule cada amostra a partir da API/banco, sem arredondamento intermediário indevido.
7. Confira moeda, percentuais, zero/nulo, números altos, singular/plural, datas e formatos pt-BR.
8. Confirme que criar, converter, mover, ganhar, perder, reabrir ou excluir atualiza indicadores e tabelas sem reload indevido.

## Fase 4 — Leads

1. Teste listagem vazia e populada, busca, filtros por status, ordenação e paginação, isoladamente e em combinação.
2. Crie um lead usando todos os campos disponíveis: nome, e-mail, telefone, empresa, cidade, origem e observações.
3. Teste campos obrigatórios, e-mail inválido, telefone incompleto, limites de texto, espaços nas bordas, acentos, caracteres especiais e duplicidade.
4. Edite o lead, recarregue a aplicação e confirme persistência na API e no banco.
5. Teste cancelar/fechar o formulário com e sem alterações e o retorno correto do foco.
6. Se houver importação em lote na interface, teste arquivo válido pequeno, linha inválida, duplicidade, idempotência e resultado parcial; caso não pertença à tela atual, marque justificadamente.
7. Teste cancelar exclusão, confirmar exclusão de lead sem vínculos e repetir acesso/edição/exclusão do ID removido.
8. Teste a restrição de exclusão quando o lead possui oportunidade ativa.
9. Converta um lead sem correspondência e confirme atomicamente:
   - criação de um único cliente;
   - alteração do lead para convertido;
   - criação ou associação de oportunidade;
   - histórico/auditoria;
   - atualização dos indicadores e links.
10. Converta um lead que corresponda ao cliente sintético por e-mail ou telefone e confirme que nenhum cliente duplicado é criado.
11. Teste conversão repetida/idempotente.
12. Teste conflitos seguros: e-mail duplicado entre clientes, telefone apontando para cliente diferente, nome ambíguo e cliente anteriormente vinculado excluído.
13. Confirme que uma falha intermediária na conversão não deixa metade dos registros gravados.

## Fase 5 — Oportunidades e Funil

1. Crie oportunidade vinculada a cliente e outra vinculada a lead, usando todos os campos:
   - cliente ou lead;
   - título;
   - valor estimado;
   - responsável;
   - origem;
   - tipo de serviço;
   - próxima ação e data;
   - previsão de fechamento;
   - probabilidade;
   - observações;
   - orçamento relacionado, quando permitido.
2. Teste vazio, valores negativos/excessivos, probabilidade abaixo de 0 e acima de 100, datas inválidas, ação sem data, data sem ação, textos longos e referências incompatíveis.
3. Localize, abra, edite, salve e recarregue cada oportunidade; confronte interface, `GET /api/oportunidades/:id` e banco.
4. Abra o detalhamento/histórico e verifique criação, cada mudança de etapa, motivo, usuário e timestamp.
5. Teste busca por oportunidade, cliente/lead, serviço, responsável, origem e etapa.
6. Teste todos os filtros disponíveis, chips de filtros ativos, remoção individual e limpeza total.
7. Valide filtros de atenção: próximas ações atrasadas e oportunidades paradas há mais de 14 dias.
8. Mova oportunidades por todos os caminhos oferecidos:
   - drag and drop entre colunas;
   - reordenação dentro da mesma coluna;
   - ação explícita de transição, se houver;
   - teclado ou alternativa acessível ao arraste.
9. Confirme ordem persistida após reload e reinício controlado da API quando relevante.
10. Teste transições para `Ganho` e `Perdido`, motivo quando exigido, atualização das métricas e remoção do pipeline aberto.
11. Reabra oportunidade encerrada em `Proposta` e confirme histórico e recomposição do pipeline.
12. Tente avançar oportunidade ligada apenas a lead quando o produto exige cliente convertido; valide mensagem e próximo passo.
13. Vincule orçamento do mesmo cliente; rejeite orçamento de outro cliente, excluído ou inexistente.
14. Abra o link do orçamento e volte ao CRM preservando o contexto esperado.
15. Converta oportunidade em projeto, confirme um único projeto, vínculo bidirecional, navegação e idempotência; não audite o projeto além desse vínculo.
16. Teste cancelar exclusão e excluir somente oportunidade sintética. Confirme exclusão lógica, histórico preservado conforme a regra, retirada do funil e atualização dos indicadores.
17. Teste PATCH/DELETE repetido em ID excluído e IDs inexistentes.
18. Faça duas submissões rápidas e duas reordenações concorrentes em ambiente isolado para detectar duplicação ou perda de ordem.

## Fase 6 — Backend, banco e segurança

Para cada fluxo de leitura ou escrita:

1. Registre método, endpoint, query, payload sanitizado, status e contrato.
2. Cubra pelo menos:
   - `GET /api/contatos`, `/analytics`;
   - `POST /api/contatos`;
   - `PUT /api/contatos/:id`;
   - `DELETE /api/contatos/:id`;
   - `POST /api/contatos/:id/converter`;
   - `GET /api/oportunidades`, `/analytics`, `/options`, `/:id`;
   - `POST /api/oportunidades`;
   - `PATCH /api/oportunidades/:id`;
   - `PATCH /api/oportunidades/:id/transition`;
   - `PATCH /api/oportunidades/reorder`;
   - `POST /api/oportunidades/:id/link-budget`;
   - `POST /api/oportunidades/:id/convert-project`;
   - `DELETE /api/oportunidades/:id`.
3. Teste entradas válidas, inválidas, ausentes, extras, IDs inexistentes, IDs excluídos, referências cruzadas e duplicadas.
4. Confirme códigos HTTP coerentes, mensagens sem stack trace/segredo e validação também no servidor.
5. Verifique normalização, timestamps, chaves estrangeiras lógicas, unicidade, soft delete e relações.
6. Valide transações de conversão, mudança de etapa, reordenação e criação de projeto.
7. Confirme que filtros/paginação limitam consultas e que a tela não produz N+1 perceptível.
8. Confira trilha de auditoria para criação, edição, conversão, transição, vínculo e exclusão, sem dados sensíveis excessivos.
9. Faça testes seguros de XSS em textos, injeção em busca/filtros, manipulação de ID e associação de orçamento/projeto pertencente a outro cliente.
10. Não use payload destrutivo nem saia do ambiente autorizado.

## Fase 7 — UX, responsividade e acessibilidade

1. Percorra as três visões e todos os modais somente com teclado: Tab, Shift+Tab, Enter, Espaço, setas e Escape.
2. Confirme foco inicial, contenção e retorno em modais, foco visível, ordem lógica e foco após mudança de visão.
3. Verifique títulos hierárquicos, landmarks, tabelas, labels, nomes dos botões por ícone, mensagens `aria-live` e erros associados.
4. O kanban precisa ter alternativa acessível para mover/reordenar; não aceite drag and drop como único meio operacional.
5. Gráficos/indicadores não podem depender somente de cor e precisam de alternativa textual.
6. Teste tema claro e escuro; 360, 768, 1024 e 1440 px; zoom nativo de 200%; textos longos; cinco colunas do funil; modais e filtros expandidos.
7. Procure rolagem horizontal acidental, colunas inacessíveis, sobreposição, corte, truncamento sem tooltip, alvos pequenos e conteúdo que desaparece.
8. Execute Axe com regras WCAG 2.2 A/AA nas visões vazia e populada, nos dois temas e com modal aberto.
9. Verifique contraste, redução de movimento e árvore de acessibilidade; execute leitor de tela real se disponível.
10. Sinalize os antipadrões do `AGENTS.md`, incluindo `transition: all`, `outline-none` sem reposição, `div/span` clicável, controle sem label e formatação fixa inadequada.

## Fase 8 — Correção e regressão

1. Reproduza e registre o defeito antes de editar.
2. Determine a causa raiz no frontend, contrato, API, banco ou integração.
3. Sempre que razoável, adicione um teste que falhe antes da correção.
4. Faça a menor alteração coerente; não silencie erros e não afrouxe validações.
5. Execute teste focado, typecheck/lint e regressão do módulo.
6. Repita o fluxo na interface real e atualize a evidência.
7. Após correções de contatos, oportunidades, projetos, orçamentos ou indicadores, execute smoke das Sessões 01 e 02 diretamente afetadas.
8. Se a solução exigir decisão de negócio — por exemplo, política de concorrência, duplicidade ou transições permitidas — documente a proposta e aguarde aprovação.

## Critério de encerramento

Não encerre enquanto houver item inventariado sem situação. A sessão só pode terminar quando:

- todas as visões e controles do escopo forem exercitados ou tiverem bloqueio reproduzível;
- cálculos tiverem sido confrontados com API/banco;
- conversões e transições estiverem comprovadas como atômicas e persistentes;
- correções tiverem reteste automatizado e real;
- não houver erro novo relevante no console, rede ou logs;
- os dados sintéticos e seus relacionamentos tiverem sido removidos;
- o diff tiver sido revisado sem alterações alheias;
- limitações estiverem registradas honestamente.

## Classificação

- P0 — perda/corrupção de dados, falha grave de segurança ou aplicativo inutilizável.
- P1 — fluxo principal quebrado, cliente duplicado, conversão não atômica, cálculo comercial incorreto ou bloqueio grave de acessibilidade.
- P2 — função secundária incorreta, validação ausente, ordem inconsistente ou UX bastante prejudicada.
- P3 — problema visual/textual menor ou melhoria recomendada.

## Entregáveis obrigatórios

1. Relatório Markdown com resumo executivo.
2. Matriz completa de cobertura.
3. Lista de achados com ID, gravidade, camada, rota, pré-condição, passos, esperado, obtido, evidência, causa raiz, arquivos/endpoints, correção e reteste.
4. Capturas de cada visão vazia/populada, funil completo, modais relevantes e estado após conversão/exclusão.
5. Requisições/respostas sanitizadas e consultas de verificação.
6. Relação dos arquivos alterados e motivo.
7. Comandos de teste com resultados exatos.
8. Contagem final de aprovados, aprovados após correção, reprovados pendentes, bloqueados e não aplicáveis.
9. Riscos residuais e itens de regressão para a próxima sessão.
10. Melhorias não implementadas, priorizadas por benefício, esforço e risco.
11. Confirmação de limpeza ou inventário exato dos resíduos.

## Formato da resposta final

Comece pelo resultado real e informe:

- status: `APROVADA`, `APROVADA COM RESSALVAS` ou `REPROVADA`;
- cobertura em números;
- quantidade e gravidade dos defeitos encontrados/corrigidos;
- pendências e bloqueios;
- testes executados e resultados exatos;
- links para relatório, matriz, achados e evidências;
- confirmação da limpeza;
- recomendação objetiva sobre iniciar ou não a Sessão 04.

Não use “parece funcionar”, “em geral está bom” ou “a maioria foi testada”. Use fatos, IDs, números e evidências.

