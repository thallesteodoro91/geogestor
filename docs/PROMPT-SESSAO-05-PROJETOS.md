# Prompt de auditoria — Sessão 05: Projetos

Você atuará como engenheiro sênior de QA full stack, especialista em aplicações desktop, gestão de projetos, cálculos operacionais e financeiros, UX, acessibilidade, integridade de dados, sistema de arquivos e segurança. Sua tarefa é **AUDITAR, CORRIGIR E RETESTAR** somente a Sessão 05 do GeoGestor até obter evidências suficientes sobre tudo o que pertence ao escopo.

## Configuração da sessão

- Sessão atual: **05 — Projetos**.
- Módulo/menu: **Projetos**.
- Rotas principais: **`/projetos`** e **`/projetos/:id`**.
- Redirecionamento legado: **`/operacional` → `/projetos?visualizacao=estatisticas`**.
- Visões da listagem: **Lista**, **Grade** e **Estatísticas**, controladas por `visualizacao=lista`, `visualizacao=grade` e `visualizacao=estatisticas`.
- Parâmetros navegáveis: `visualizacao`, `busca`, `status`, `tipo`, `inicio`, `fim`, `situacao`, `pagina`, `porPagina` e `ordenar`.
- Abas do detalhe: `aba=checklist`, `aba=documentos` e `aba=financeiro`.
- Integrações permitidas: acessar Cliente, Propriedade, Orçamentos, Financeiro, Tarefas, Agenda, Ambiental, Relatórios e OpenStreetMap somente para comprovar efeitos iniciados ou resumidos em Projetos. Não auditar integralmente esses módulos.
- Foco especial: listagem, visões, busca, filtros, ordenação, paginação, estatísticas, cadastro e edição completos, tipos especializados, propriedade, localização, tarefas, documentos, pastas, PDF, contexto financeiro, decisões após cancelamento/suspensão, alteração de cliente, alteração de tipo, exclusão e integridade de todos os vínculos.
- Relatórios anteriores obrigatórios:
  - `docs/auditorias/2026-09-07-visao-geral/RELATORIO.md`
  - `docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md`
  - `docs/auditorias/2026-09-08-comercial-crm-funil/RELATORIO.md`
  - `docs/auditorias/2026-09-10-comercial-orcamentos/RELATORIO.md`
- Implementar correções comprovadas: **SIM**.
- Implementar novas funcionalidades ou mudanças de produto: **NÃO, sem aprovação expressa**.
- Diretório dos entregáveis: `docs/auditorias/[AAAA-MM-DD]-projetos/`.

## Objetivo

Validar de ponta a ponta cada tela, visão, cartão, indicador, gráfico, filtro, tabela, campo, seletor, aba, modal, menu, botão, link, tarefa, arquivo, relatório e ação disponível em Projetos. Não aprove uma função porque o código parece correto ou porque a API respondeu HTTP 200. Comprove o resultado na interface real, no contrato da API, no banco SQLite e, quando aplicável, no sistema de arquivos, PDF, módulo relacionado, histórico e trilha de auditoria.

Recalcule estatísticas, progresso, prazos, receitas, custos e saldos de forma independente a partir de dados sintéticos conhecidos. Corrija somente defeitos reproduzidos e pertencentes ao escopo. Após cada correção, execute teste automatizado focado, reteste manual integrado e regressão proporcional ao risco.

## Dados mínimos obrigatórios

Crie tudo somente em banco, perfil e diretórios descartáveis, com prefixo único `QA-AUDIT-S05-[DATA-HORA]-`:

1. Dois clientes ativos sintéticos, para testar isolamento e alteração de cliente.
2. Um cliente inativo ou removido somente se o ambiente descartável permitir comprovar a rejeição de vínculos inválidos.
3. Uma propriedade rural e uma urbana do cliente principal e uma propriedade pertencente ao segundo cliente.
4. Projetos com prazo atrasado, prazo no dia atual, prazo futuro, sem prazo e concluído com datas de início e entrega conhecidas.
5. Projetos suficientes para cobrir os estados `Planejamento`, `Em Análise`, `Em Andamento`, `Aguardando Cliente`, `Aguardando Documentação`, `Aguardando Órgão`, `Com Pendência`, `Suspenso`, `Finalizado` e `Cancelado`, respeitando as transições permitidas.
6. Projetos dos tipos `Rural`, `Urbano`, `Comercial`, `Industrial`, `Ambiental`, `Licenciamento`, `Perícia`, `Institucional` e `Outro` quando o custo da fixture for razoável; no mínimo, cubra um tipo comum e os três tipos especializados.
7. Para Licenciamento: tipo de licença, órgão, número, emissão, validade, status inicial e observação conhecidos.
8. Para Ambiental: tipo de demanda, órgão e protocolo conhecidos.
9. Para Perícia: tipo, número do processo e data de vistoria conhecidos.
10. Área em hectares e em metros quadrados, com resultado normalizado conhecido; coordenadas válidas no SIRGAS 2000 e casos inválidos de latitude/longitude.
11. Um modelo de checklist sintético e tarefas aberta, atrasada, concluída, sem prazo e com prioridades baixa, média e alta. Crie pelo menos dez tarefas em um projeto para revelar os filtros condicionais.
12. Arquivos sintéticos pequenos: PDF, imagem, nome com acento, extensão em maiúsculas, arquivo geoespacial aceito quando suportado e tipo não permitido ou inválido. Inclua arquivo vazio, nome longo e tentativa segura de duplicidade.
13. Um orçamento aprovado vinculado ao projeto, com valor contratado conhecido e parcelas pendente, parcialmente paga e paga, somente em dados descartáveis.
14. Despesas do projeto com valores conhecidos, incluindo ativa, cancelada e estornada/revertida, para provar o que entra nos cálculos.
15. Nota fiscal ou faturamento sintético somente se necessário para comprovar `Faturado` no contexto financeiro.
16. Uma decisão financeira de cada tipo permitido, distribuída em cenários independentes: `manter_sem_alteracao`, `cancelar_parcelas_futuras`, `cobranca_parcial`, `registrar_devolucao` e `registrar_credito`.
17. Registros com receita e custo conhecidos para validar o gráfico dos cinco principais projetos e a distribuição por status.
18. Mais de 12 registros e, quando viável, mais de 48 registros descartáveis para paginação e estabilidade das visões.
19. Para lote/API, linhas válidas, cliente por ID e por referência, associação manual pendente, duplicidade interna, duplicidade existente, cliente inativo e limite máximo permitido, apenas se esses endpoints continuarem pertencendo ao domínio de Projetos.
20. Estados de zero dados, dados parciais, texto longo, acentos, espaços nas bordas, datas-limite, valores altos ainda seguros, erro da API e operação lenta.

Defina antes da execução uma tabela de resultados esperados. Não derive os valores esperados usando as mesmas funções de produção que estão sendo testadas.

## Regras de escopo e conduta

1. Leia integralmente todos os `AGENTS.md` aplicáveis e siga as Web Interface Guidelines do projeto.
2. Leia integralmente os quatro relatórios anteriores. Reteste somente integrações, correções e riscos que afetem diretamente Projetos.
3. Dê atenção especial ao projeto criado ou vinculado por Orçamentos, às parcelas geradas e ao relacionamento originado no CRM, sem reauditar esses módulos por inteiro.
4. Registre como risco herdado o smoke empacotado bloqueado pela auditoria de configuração inicial na Sessão 04. Tente o pacote instalado somente se houver ambiente seguro; não atribua a Projetos uma falha externa sem reproduzir a causa.
5. Trabalhe somente nesta sessão. Abra outro módulo apenas para provar uma consequência iniciada em Projetos e registre o motivo.
6. Não pare após planejar ou ler o código. Use a aplicação real e confronte interface, rede, API, banco, sistema de arquivos, PDF e logs.
7. Todo item inventariado deve terminar como `APROVADO`, `APROVADO APÓS CORREÇÃO`, `REPROVADO`, `BLOQUEADO` ou `NÃO APLICÁVEL`, com justificativa e evidência.
8. Não presuma a existência de visão cartográfica, gestão de equipe, etapas ou outro recurso apenas porque aparece no catálogo geral. Varra a interface e o código. Se o controle não existir nesta versão, registre `NÃO APLICÁVEL`; não crie a funcionalidade.
9. Preserve alterações preexistentes. Registre o estado inicial do Git e não reverta trabalho de terceiros.
10. Corrija a causa raiz com a menor alteração coerente. Não redesenhe o produto nem crie recursos novos.
11. Melhorias não corretivas devem ser separadas por benefício, esforço e risco e não podem ser implementadas sem aprovação.
12. Mocks podem apoiar testes unitários, mas a comprovação final deve usar frontend, API e SQLite integrados sempre que o ambiente permitir.
13. Envie atualizações curtas ao concluir inventário, lista/estatísticas, formulário, detalhe, tarefas, arquivos, financeiro, backend, correções e reteste.

## Segurança dos dados de teste

1. Identifique o banco, perfil Electron, diretório de dados, pasta-raiz de documentos e serviço realmente usados pelo processo em execução. Nunca presuma qual banco ou diretório está ativo.
2. Detecte dados reais antes de mutar. Use preferencialmente banco, perfil, diretório de arquivos e downloads totalmente isolados.
3. Antes da primeira mutação, produza backup ou snapshot verificável e registre caminho, tamanho, data e SHA-256 quando aplicável.
4. Nunca edite, mova, renomeie, conclua, cancele ou exclua registros e arquivos preexistentes do usuário.
5. Antes de confirmar exclusão, alteração de cliente, mudança de tipo, cancelamento ou decisão financeira, confira ID, nome, cliente e prefixo exatos.
6. Testes de renomeação e movimentação de pastas devem usar somente projetos e clientes desta sessão. Valide o caminho resolvido antes da operação.
7. Não abra executáveis nem arquivos hostis. Use payloads inertes e nomes maliciosos apenas para confirmar sanitização.
8. Operações irreversíveis, exclusão em massa, restauração e limpeza total só podem ocorrer em ambiente descartável.
9. Ao final, remova apenas dados sintéticos e confirme a ausência de tarefas, documentos, arquivos físicos, pastas, lançamentos, decisões, vínculos, especializados, eventos e registros órfãos.
10. Se um defeito impedir a limpeza, não force exclusão ampla. Registre cada resíduo com tabela, ID, caminho e dependências.

## Fase 1 — Preparação e linha de base

1. Identifique Electron, frontend React/Vite, API Fastify, Drizzle/SQLite, portas, processos, comandos, diretórios e suítes aplicáveis.
2. Verifique Git, processos ativos, logs recentes e saúde da aplicação sem encerrar processos não identificados.
3. Confirme que frontend, API, banco e diretório de arquivos pertencem à mesma instância isolada.
4. Registre versão do aplicativo, commit, estado do worktree, sistema operacional, viewport, zoom, tema, banco, diretório de dados e diretório de downloads.
5. Capture a linha de base das tabelas de projetos, clientes, propriedades, tarefas, arquivos/documentos, orçamentos, vínculos orçamento-projeto, parcelas, recebimentos, despesas, notas fiscais, licenças, registros ambientais, perícias, eventos financeiros, outbox e auditoria, usando os nomes reais do schema.
6. Registre contagens e indicadores iniciais, erros no console, requisições com falha e mensagens dos logs.
7. Crie `docs/auditorias/[AAAA-MM-DD]-projetos/` para relatório, matriz, cálculos e evidências sanitizadas.

## Fase 2 — Inventário obrigatório

Antes de testar, produza uma matriz contendo:

- ID do item;
- rota, parâmetro, visão, aba ou modal;
- controle ou fluxo;
- ação e resultado esperado;
- componente do frontend;
- endpoint e método da API;
- tabelas, relacionamentos e efeito no sistema de arquivos;
- cenários positivo, negativo, vazio, carregamento, lentidão, erro e recuperação;
- situação e evidência.

Varra a interface e o código para localizar elementos condicionais: menus de linha, ações por status, filtros exibidos somente com volume suficiente, cliente/propriedade remotos, tipos especializados, impacto de troca de cliente, bloqueio de troca de tipo, pendência de decisão financeira, alertas, botões de pasta, links externos, geração de PDF, estados sem orçamento ou sem parcelas e controles que surgem somente com ou sem dados.

Inventarie pelo menos estes contratos, se existirem na versão auditada:

- `GET /api/projetos`, `GET /api/projetos/options`, `GET /api/projetos/deadlines`, `GET /api/projetos/calendar`, `GET /api/projetos/filters` e `GET /api/projetos/overview`;
- `GET /api/projetos/:id`, `POST /api/projetos`, `PATCH /api/projetos/:id` e `DELETE /api/projetos/:id`;
- `GET /api/projetos/:id/reassignment-impact` e `POST /api/projetos/:id/reassign-client`;
- `GET /api/projetos/:id/contexto-financeiro` e `POST /api/projetos/:id/decisao-financeira`;
- `GET /api/projetos/lote/clientes`, `POST /api/projetos/lote/preview` e `POST /api/projetos/lote`, quando ainda pertencentes ao domínio;
- endpoints de tarefas filtradas por projeto, aplicação de modelo, criação, atualização e exclusão;
- endpoints de listagem, upload em fluxo, download, prévia quando disponível, abertura de pasta e exclusão de arquivos do projeto;
- endpoints de despesas utilizados pela aba Financeiro.

Não marque os três endpoints de lote como cobertura visual se não houver controle correspondente em Projetos. Teste o contrato de backend no limite do escopo e registre a ausência de entrada visual como `NÃO APLICÁVEL`.

## Fase 3 — Listagem, navegação e estado

### Rotas e visões

1. Abra `/projetos` pelo menu, por URL direta e por retorno de Cliente, Orçamento e CRM quando houver vínculo sintético.
2. Abra `/projetos/:id` com ID válido, inexistente, UUID inválido, removido e projeto pertencente a outro cenário sintético.
3. Valide `/operacional` e confirme o redirecionamento exato para a visão de estatísticas, sem loop ou perda indevida de estado.
4. Teste `visualizacao=lista`, `grade` e `estatisticas`, alternância por clique e teclado, recarga, voltar/avançar e persistência intencional.
5. Abra `visualizacao=mapa` e qualquer valor inválido. Confirme o fallback seguro para uma visão suportada e que não há tela quebrada.
6. Teste as abas do detalhe com `aba=checklist`, `documentos` e `financeiro`; confirme fallback de aba inválida, recarga, histórico e foco após mudança.
7. Procure telas em branco, conteúdo piscando, carregamento infinito, estado duplicado, erro no console e requisição repetitiva.

### Busca, filtros, ordenação e paginação

1. Teste busca por nome do projeto, cliente, município, matrícula e CAR, com acentos, caixa, espaços nas bordas, texto parcial, termo inexistente e texto longo.
2. Teste filtros de status, tipo, data inicial/final e situação `late`, `in_progress`, `completed` e `other`, isolados e combinados.
3. Teste datas nas bordas, intervalo invertido, projeto sem prazo, concluído atrasado e prazo no dia atual considerando o fuso local.
4. Teste ordenações `updated_desc`, `deadline_asc`, `deadline_desc`, `name_asc`, `name_desc`, `client_asc` e `status_asc`.
5. Teste tamanhos de página 12, 24 e 48, primeira/última página, página inexistente, exclusão do último item e retorno à página válida.
6. Confirme que URL, controles, lista e resposta da API representam o mesmo escopo; filtros alterados devem retornar à página 1.
7. Confirme comportamento de parâmetros desconhecidos, duplicados, codificação especial, `page` e `limit` negativos, zero, decimal e acima do máximo do servidor.
8. Após criar, editar, alterar status e excluir projeto, confirme atualização de lista, grade, estatísticas, opções de filtro e contagens sem recarga indevida.

### Lista e grade

1. Compare os mesmos projetos nas duas visões: nome, cliente, tipo, status, município, área, prazo, progresso, atualização e ações.
2. Exercite todas as ações disponíveis no menu: editar, abrir documentos, gerar relatório PDF, abrir no Windows quando aplicável e excluir.
3. Confirme que ações condicionais aparecem apenas quando possíveis e possuem nome acessível.
4. Teste cartões e linhas com textos longos, dados parciais, nulos, área zero, sem cliente exibível, status desconhecido legado e datas inválidas legadas.
5. Valide estado vazio global, vazio filtrado, carregamento, falha e recuperação explícita. Erro da API não pode ser apresentado como ausência de projetos.

## Fase 4 — Estatísticas e cálculos operacionais

Valide `GET /api/projetos/overview` e a visão `visualizacao=estatisticas` no mesmo conjunto filtrado, quando filtros forem suportados.

1. Recalcule e confronte:
   - Total de projetos;
   - Tempo médio de entrega;
   - Produtividade;
   - Valor médio dos projetos aprovados;
   - quantidade por situação operacional;
   - distribuição por status;
   - Receita, Custo e Lucro dos cinco projetos destacados.
2. Confirme que produtividade é calculada pela regra de negócio vigente e documente numerador, denominador, arredondamento e tratamento de conjunto vazio.
3. Para projetos concluídos, valide a duração entre início e entrega, limites de data, valores nulos e arredondamento da média.
4. Confirme que somente orçamentos nos estados financeiros elegíveis entram em receita e valor médio e que versões substituídas ou canceladas não duplicam valores.
5. Confirme que apenas despesas ativas, não canceladas e não revertidas entram no custo realizado.
6. Calcule `Lucro = Receita − Custo` para cada projeto e confirme ordenação dos cinco principais conforme o contrato vigente.
7. Teste filtro por tipo no gráfico de Receita × Custo e compare gráfico, legenda, tooltip e alternativa textual.
8. Teste um projeto, mais de cinco, empate, receita zero, custo zero, custo maior que receita, valores altos, séries parciais e todas as séries zeradas.
9. Confira títulos, unidades, moeda pt-BR, percentuais, escalas, cores, legendas, tooltips, truncamento e tratamento de zero/nulo.
10. Confirme que nenhuma informação depende apenas de cor e que gráficos possuem resumo textual acessível.
11. Após orçamento, despesa, conclusão e exclusão sintéticos, confirme invalidação e atualização dos indicadores e gráficos; recarregue e, quando relevante, reinicie o serviço.

## Fase 5 — Cadastro e edição de projeto

### Fluxo geral

1. Abra o cadastro pelo botão principal e todos os pontos de entrada existentes. Teste cancelar, fechar, Escape e navegação com e sem alterações.
2. Confirme aviso de descarte, foco inicial, contenção e retorno do foco, bloqueio de submissão duplicada, estado de salvamento e recuperação após falha.
3. Percorra por clique e teclado as três etapas/abas: **Dados essenciais**, **Imóvel e documentação** e **Localização e notas**.
4. Crie cliente pelo cadastro rápido. Confirme que o novo cliente passa a ser selecionável e associado sem duplicidade; não reaudite todo o módulo de Clientes.
5. Aplique modelo inicial de checklist e confirme que tarefas são criadas uma única vez com os vínculos corretos.
6. Salve, localize, abra, edite, recarregue e reinicie o serviço para confirmar persistência.

### Dados essenciais

1. Teste nome obrigatório e limite de 160 caracteres.
2. Teste cliente obrigatório, busca remota, cliente inexistente, inativo e troca durante o preenchimento.
3. Teste todos os tipos disponíveis: Rural, Urbano, Comercial, Industrial, Ambiental, Licenciamento, Perícia, Institucional e Outro.
4. Teste todos os status iniciais permitidos e rejeite valores fora do contrato pela API.
5. Teste datas de início e término: vazias quando permitidas, iguais, término anterior ao início, data impossível e bordas de fuso.
6. Teste descrição vazia e limite de 500 caracteres, acentos, caracteres especiais, espaços externos e conteúdo semelhante a HTML/JavaScript inerte.

### Tipos especializados

1. Para **Ambiental**, teste tipo de demanda, órgão e protocolo; confirme criação/atualização transacional do registro especializado.
2. Para **Licenciamento**, teste LP, LI, LO, Renovação e Outros; órgão e número obrigatórios; emissão, validade obrigatória, validade anterior à emissão; status Em análise, Válida, Em renovação, Suspensa e Encerrada; observação até 2.000 caracteres.
3. Para **Perícia**, teste Judicial, Extrajudicial, Assistência técnica, Avaliação técnica e Outro; número do processo e data de vistoria.
4. Confirme que campos especializados aparecem e somem conforme o tipo sem apagar dados silenciosamente.
5. Tente mudar o tipo quando existirem dependências especializadas. Confirme bloqueio `PROJECT_TYPE_CHANGE_BLOCKED` ou contrato equivalente, mensagem acionável e nenhuma alteração parcial.
6. Quando a mudança for permitida, confirme criação, atualização ou encerramento coerente da entidade especializada e ausência de órfãos.
7. A auditoria desta sessão cobre somente o ciclo especializado criado pelo formulário de Projeto. Fluxos completos de licenças, condicionantes e cálculos ambientais ficam para a Sessão 06.

### Imóvel e documentação

1. Pesquise e selecione propriedade do cliente; tente associar propriedade de outro cliente, inexistente ou removida pela UI e API.
2. Troque o cliente após selecionar a propriedade e confirme limpeza ou bloqueio explícito do vínculo incompatível.
3. Teste área com ponto e vírgula, zero, negativa, alta e inválida; teste unidades ha e m² e confira normalização para hectares no banco e exibição.
4. Teste situação, matrícula e averbação, inclusive textos longos e caracteres especiais.
5. Em projeto rural, teste CAR, CCIR e ITR; confirme que a mudança para tipo não rural trata os campos de modo explícito e coerente.
6. Confirme precedência entre dados digitados no projeto e dados compartilhados da propriedade; nenhuma edição deve alterar o cadastro compartilhado sem confirmação ou contrato explícito.

### Localização e notas

1. Teste município e UF; normalize UF em duas letras e rejeite valores inválidos no servidor.
2. Teste latitude em −90, 90 e fora da faixa; longitude em −180, 180 e fora da faixa; vírgula/ponto, zero e texto.
3. Exija latitude e longitude em conjunto; não aceite apenas uma coordenada.
4. Confirme rótulo/referência SIRGAS 2000 e ausência de inversão latitude/longitude.
5. Teste status do memorial: Não informado, Não, Em elaboração e Sim, ou os equivalentes reais.
6. Teste notas vazias e até 1.200 caracteres.
7. Após salvar, copie coordenadas e abra o link do OpenStreetMap. Confirme URL, ordem e codificação, sem tratar falha da rede externa como defeito do GeoGestor.

## Fase 6 — Detalhe e visão geral do projeto

1. Confira cabeçalho, nome, cliente, tipo, status, prazo, ações e navegação de retorno.
2. Valide os cartões Prazo, Checklist, Documentos e Financeiro contra API e banco.
3. Confira detalhes gerais, propriedade, referências técnicas, área, município, documentos rurais, coordenadas e notas.
4. Teste dados ausentes, parciais, longos e legados sem quebrar a tela.
5. Use o link do cliente e confirme o vínculo correto; retorne sem perder a aba ou o estado relevante.
6. Teste copiar coordenadas, abrir mapa externo, copiar caminho e abrir pasta quando disponíveis, incluindo falha de permissão e pasta ausente.
7. Gere o relatório PDF do projeto pela lista e pelo detalhe, se ambos existirem. Compare nome, conteúdo, cliente, propriedade, datas, status, checklist, documentos e valores permitidos; confirme que dados internos ou sensíveis não vazam.
8. Teste projeto com pouco e muito conteúdo, paginação, textos longos, caracteres pt-BR e falha de geração/recuperação.

## Fase 7 — Checklist e tarefas do projeto

1. Abra `aba=checklist` por clique e deep link.
2. Crie tarefa com título, prioridade baixa/média/alta, prazo e descrição; teste todos os campos e limites reais.
3. Teste vazio, espaços, texto longo, data inválida, prazo passado, caracteres especiais, HTML/JavaScript inerte e dupla submissão.
4. Conclua e reabra pelo controle da interface; confirme status, timestamp, progresso, próxima tarefa e contagem.
5. Exclua tarefa sintética: cancele uma vez e confirme em outra. Valide nome e ID antes da confirmação.
6. Com dez ou mais tarefas, teste busca, situação Todas/Abertas/Concluídas/Atrasadas e prioridade, isoladas e combinadas.
7. Recalcule quantidade concluída, total e percentual de progresso; defina o esperado para projeto sem tarefas.
8. Valide tarefa atrasada, vencendo hoje, futura, sem prazo e concluída com prazo antigo.
9. Aplique modelo no cadastro e, se a API permitir reaplicação, confirme idempotência pela regra real, inclusive títulos repetidos.
10. Confirme que tarefas criadas no projeto aparecem no módulo de Tarefas com o mesmo projeto/cliente e que mutações externas imediatamente relevantes atualizam o cartão do projeto.
11. Teste API com projeto inexistente, cliente incompatível, IDs inválidos, prioridade/status desconhecidos e payload extra.
12. A auditoria não deve expandir para todas as ferramentas do módulo autônomo de Tarefas; cubra somente o ciclo iniciado e resumido no projeto.

## Fase 8 — Documentos, arquivos e pastas

1. Abra `aba=documentos` por clique e deep link. Liste arquivos e confronte metadados com banco e sistema de arquivos.
2. Teste seleção e arrastar-e-soltar, upload, cancelamento, progresso, sucesso, erro e nova tentativa.
3. Valide o limite real de 50 MB e a rejeição antes ou durante o fluxo conforme o contrato. Não use arquivo grande fora do ambiente descartável.
4. Teste PDF, imagem, GPKG, SHP, KML, KMZ, DWG e outras extensões anunciadas pela interface, sem presumir pré-visualização ou processamento inexistente.
5. Teste nome com acento, extensão maiúscula, espaços, nome longo, duplicidade, arquivo vazio, MIME divergente, tipo não permitido e arquivo corrompido.
6. Teste nomes inertes contendo `../`, `..\\`, separadores, caracteres reservados, duplas extensões e HTML. Confirme sanitização e confinamento na pasta do projeto.
7. Baixe e compare tamanho e hash. Abra ou visualize somente se houver controle seguro e confirme MIME/nome do download.
8. Exclua arquivo sintético: cancele uma vez e confirme em outra; valide remoção lógica/física conforme o contrato e ausência de órfãos.
9. Com dez ou mais arquivos, teste busca e filtro de tipo, isolados e combinados.
10. Teste copiar caminho e abrir pasta; trate indisponibilidade do shell com mensagem segura e recuperável.
11. Renomeie projeto e cliente sintéticos. Confirme que a outbox cria/renomeia/move a pasta após commit, mantém arquivos, não escapa da raiz e conclui após reinício sem duplicar operações.
12. Simule falha segura do sistema de arquivos. A operação de banco não pode deixar caminho falso como concluído; documente política de retry/compensação.
13. Confirme que excluir projeto não apaga arquivo compartilhado ou dado de outro cliente e que a política de retenção é explícita.
14. Se arquivos geoespaciais acionarem processamento automático, valide resultado e erro correspondente. Não transforme esta sessão em auditoria completa das ferramentas cartográficas do detalhe de Cliente ou de Cadastros.

## Fase 9 — Contexto financeiro do projeto

Abra `aba=financeiro` e valide `GET /api/projetos/:id/contexto-financeiro` com cálculos independentes em centavos.

1. Recalcule e confronte os oito cartões:
   - Orçado;
   - Contratado;
   - Executado informado;
   - Faturado;
   - Recebido;
   - Saldo aberto;
   - Custo previsto;
   - Custo realizado.
2. Documente exatamente quais estados de orçamento entram em Orçado e Contratado. Exclua rascunhos, cancelados, substituídos ou versões conforme a regra vigente e teste contra dupla contagem.
3. Confirme que Faturado vem de documentos fiscais ativos e que Recebido vem de liquidação real, não da mera criação de parcela.
4. Recalcule saldo aberto como a soma não negativa de valor menos valor pago das parcelas elegíveis.
5. Confirme que custo previsto vem do orçamento contratado e que custo realizado exclui despesas canceladas e revertidas.
6. Recalcule `Desvio de custo = Custo realizado − Custo previsto` e percentual consumido com duas casas; quando o previsto for zero, exija tratamento explícito sem divisão inválida.
7. Teste projetos sem orçamento, com orçamento sem parcelas, com recebimento parcial, quitado, custo acima do previsto, custo negativo proibido e dados parciais.
8. Quando houver contratado sem parcelas, use o link para `/financeiro?tab=faturas&acao=parcela&projeto=...&cliente=...` e confirme parâmetros e pré-seleção; não audite o módulo Financeiro inteiro.
9. Use o link de registrar despesa e confirme `/financeiro?tab=pagar&acao=despesa&projeto=...` e o vínculo resultante.
10. Teste lista de despesas do projeto: busca, categoria, datas inicial/final, combinações, vazio, erro e exclusão permitida com confirmação.
11. Valide a linha do tempo financeira, ordem cronológica, moeda, datas, origem, duplicidade e atualização após mutação.
12. Confronte os valores com a Sessão 04: aprovar orçamento não pode registrar recebimento antecipado, e revisão substituída não pode duplicar receita ou custo.

## Fase 10 — Status, cancelamento e decisões financeiras

1. Mapeie as transições realmente permitidas entre os status do projeto; teste-as pela UI e diretamente pela API.
2. Tente transições proibidas, status desconhecido, regressão indevida e duas alterações simultâneas.
3. Para suspensão ou cancelamento com dependências financeiras, confirme abertura do modal de decisão, resumo dos impactos e opção **Decidir depois** quando prevista.
4. Teste cada decisão em cenário independente:
   - manter sem alteração;
   - cancelar parcelas futuras;
   - cobrança parcial;
   - registrar devolução;
   - registrar crédito.
5. Exija motivo entre 5 e 2.000 caracteres ou os limites reais. Teste vazio, espaços, limite, excesso e conteúdo inerte semelhante a script.
6. Em cobrança parcial, teste percentual de 0 a 100 e valor em centavos; rejeite negativo, acima do contratado, formato inválido e campos conflitantes.
7. Confirme que cancelar parcelas futuras preserva recebimentos anteriores, não altera parcelas vencidas/pagas indevidamente e é idempotente.
8. Confirme que devolução e crédito usam sinal, categoria, origem e vínculo corretos, sem duplicar caixa.
9. Confirme que decisão pendente persiste após recarga/reinício e que a decisão final atualiza contexto, linha do tempo, parcelas e auditoria atomicamente.
10. Simule falha intermediária controlada. Nenhum cenário pode ficar metade cancelado, com evento sem lançamento ou lançamento sem evento.
11. Verifique repetição da mesma requisição, chaves de idempotência quando existentes e duas decisões concorrentes.

## Fase 11 — Alteração de cliente, tipo e exclusão

### Alteração de cliente

1. Consulte `reassignment-impact` antes da troca e compare todas as dependências retornadas com o banco.
2. Sem dependências bloqueadoras, confirme o modal e a atualização transacional de tarefas, compromissos, viagens, documentos, licenças, registros ambientais, perícias, oportunidades e interações que pertençam ao projeto.
3. Confirme renomeação/movimentação segura da pasta e preservação dos arquivos.
4. Com dependência financeira, confirme bloqueio da troca, mensagem clara e ausência de qualquer atualização parcial.
5. Teste cliente inexistente, inativo, igual ao atual e duas trocas rápidas.
6. Confirme que propriedade incompatível é tratada e que nenhum dado compartilhado do cliente antigo é copiado silenciosamente.

### Exclusão

1. Exclua somente projeto sintético. Cancele a confirmação uma vez e confirme em outra.
2. Confirme se a exclusão é lógica ou física e valide o campo/timestamp correspondente.
3. Tente excluir projeto com tarefas, arquivos, orçamento, parcelas, despesas e registro especializado, em cenários descartáveis independentes.
4. Documente a política real de cascata, restrição, retenção e restauração. Dados financeiros e auditoria não podem desaparecer indevidamente.
5. Confirme que listas, estatísticas, opções, cliente, CRM, orçamento, tarefas e relatórios deixam de exibir ou passam a tratar o projeto segundo a regra vigente.
6. Verifique a outbox e a pasta física. Não aceite arquivos órfãos, exclusão fora da raiz ou perda de arquivo compartilhado.
7. Teste exclusão repetida, ID inexistente, UUID inválido e concorrência com edição.

## Fase 12 — Backend, persistência, segurança e desempenho

Para cada fluxo que lê ou grava dados:

1. Registre método, endpoint, parâmetros, payload sanitizado, resposta esperada e efeito persistente.
2. Teste entradas válidas, inválidas, ausentes, extras, IDs inexistentes, duplicadas e limites relevantes.
3. Confira códigos HTTP, contrato, tipos, mensagens uniformes e ausência de stack trace, SQL, caminho absoluto ou segredo exposto.
4. Confirme validação no servidor; validação somente no frontend não é suficiente.
5. Confira timestamps, normalização, unicidade, chaves estrangeiras, relacionamentos e soft delete.
6. Recarregue a página e reinicie o serviço quando relevante para comprovar persistência e processamento da outbox.
7. Teste atomicidade da criação do projeto e das entidades Ambiental/Licenciamento/Perícia, aplicação de modelo, troca de cliente e decisão financeira.
8. Teste duas submissões rápidas e atualizações concorrentes para detectar duplicidade ou perda silenciosa de atualização.
9. Nos endpoints de lote, quando aplicáveis, teste prévia, referência/associação de cliente, duplicidade interna e existente, cliente inativo, máximo de 500 registros, rollback e repetição idempotente.
10. Faça testes seguros de autorização/autenticação conforme a arquitetura local, manipulação de ID, mass assignment, injeção, XSS persistente/refletido, path traversal e upload hostil inerte.
11. Verifique paginação máxima de 100 no servidor, filtros, ordenação, estabilidade e ausência de N+1 evidente.
12. Meça tempos perceptíveis de lista, detalhe, overview, upload pequeno, PDF e contexto financeiro em volume representativo. Registre ambiente e limiares; não invente aprovação sem critério.
13. Confira logs e auditoria: ator/contexto local, ação, entidade, ID, resultado, motivo e proteção de dados sensíveis.

## Fase 13 — Usabilidade, responsividade e WCAG 2.2 AA

1. Teste tema claro e escuro, viewports aproximados de 360, 768, 1024 e 1440 px, zoom de página a 200%, textos longos e ausência de rolagem horizontal acidental.
2. Percorra lista, formulário, detalhe, tarefas, arquivos, financeiro, menus e modais somente com teclado: Tab, Shift+Tab, Enter, Espaço, setas, Home, End e Escape.
3. Confirme foco visível, ordem lógica, contenção e retorno do foco em modais, foco no primeiro erro e foco após mudança de rota/aba.
4. Verifique landmarks, hierarquia de títulos, listas/tabelas semânticas, labels associados, nomes acessíveis, descrições de erro e `aria-live` para atualizações importantes.
5. Botões somente com ícone precisam de `aria-label`; ícones decorativos devem ser ignorados; links e botões devem usar elementos nativos.
6. Confirme contraste, uso não exclusivo de cor, redução de movimento, reflow, tamanho dos alvos e árvore de acessibilidade.
7. Valide gráficos com alternativa textual, tooltip acessível quando possível e conteúdo compreensível sem cor.
8. Em arrastar-e-soltar, forneça alternativa por teclado. Upload não pode depender exclusivamente do gesto.
9. Revise português, mensagens acionáveis, uso de `…`, formatos pt-BR via `Intl`, números financeiros tabulares e diferença clara entre ha e m².
10. Sinalize `transition: all`, `outline-none` sem reposição, `div/span` clicável, campos sem label, navegação sem link, botão de ícone sem nome, formatação fixa e `autoFocus` injustificado.
11. Verifique prevenção de perda de dados, confirmação destrutiva e clareza de ações como Cancelar projeto, Excluir projeto e Cancelar parcelas, que não podem ser confundidas.

## Fase 14 — Correção e regressão

1. Antes de corrigir, reproduza o defeito e determine a causa raiz.
2. Adicione ou ajuste um teste automatizado que falhe antes da correção sempre que tecnicamente razoável.
3. Faça a menor alteração coerente no frontend, backend, contrato, banco ou sistema de arquivos.
4. Não silencie erros, não enfraqueça validações e não introduza dados especiais apenas para o teste passar.
5. Rode testes focados, lint e typecheck relevantes, testes das aplicações afetadas e regressão do módulo.
6. Repita manualmente o fluxo real corrigido e atualize a evidência.
7. Reteste integrações diretamente afetadas com Clientes, Orçamentos, CRM, Tarefas, Financeiro, Ambiental e Relatórios.
8. Revise o diff final e separe com precisão alterações preexistentes das realizadas nesta sessão.
9. Se a correção exigir decisão de negócio, migração ampla ou novo recurso, documente a proposta e aguarde aprovação.

## Critério de encerramento

Não encerre enquanto houver item do inventário sem situação. Para concluir:

- todas as rotas, visões, abas, controles, ações condicionais e contratos do escopo foram exercitados ou possuem bloqueio reproduzível;
- cálculos operacionais e financeiros foram comparados com valores independentes conhecidos;
- cadastro, edição, persistência, status, tarefas, arquivos, PDF, financeiro, troca de cliente/tipo e exclusão foram testados;
- correções foram retestadas de modo automatizado e na interface real;
- nenhum erro novo relevante aparece no console, rede, API, logs ou outbox;
- dados e arquivos sintéticos foram removidos e a limpeza foi comprovada;
- o diff foi revisado e não contém alterações alheias atribuídas à sessão;
- o relatório declara com exatidão tudo o que ficou bloqueado ou não aplicável.

## Classificação dos achados

- **P0** — perda/corrupção de dados, movimentação/exclusão indevida de arquivo, cálculo financeiro gravemente incorreto, falha grave de segurança ou aplicativo inutilizável.
- **P1** — fluxo principal quebrado, troca/cancelamento não atômico, indicador relevante incorreto ou bloqueio sério de acessibilidade.
- **P2** — função secundária incorreta, validação ausente, inconsistência relevante, atualização defasada ou UX bastante prejudicada.
- **P3** — problema visual/textual menor ou melhoria recomendada.

## Entregáveis obrigatórios

1. `RELATORIO.md` com resumo executivo e status real.
2. `MATRIZ-DE-COBERTURA.md` com todos os itens e situações.
3. `ACHADOS.md` com ID, gravidade, camada, rota, pré-condição, passos, esperado, obtido, evidência, causa raiz, arquivos/endpoints, correção e reteste.
4. `CALCULOS.md` com fixtures, fórmulas e comparação independente das estatísticas, progresso e contexto financeiro.
5. Evidências úteis: capturas, PDFs, logs mínimos, requisições/respostas sanitizadas, consultas e hashes, sem dados sensíveis.
6. Relação dos arquivos de código alterados e motivo.
7. Comandos executados e resultados exatos.
8. Contagem final de aprovados, aprovados após correção, reprovados, bloqueados e não aplicáveis.
9. Riscos residuais e itens que a Sessão 06 deve retestar.
10. Lista separada de melhorias não implementadas, priorizadas por benefício, esforço e risco.
11. Confirmação da limpeza ou inventário exato dos resíduos com IDs e caminhos.

## Formato da resposta final

Comece pelo resultado real, não pelo processo. Informe:

- status da sessão: **APROVADA**, **APROVADA COM RESSALVAS** ou **REPROVADA**;
- cobertura obtida em números;
- defeitos encontrados por gravidade e quantos foram corrigidos;
- pendências, bloqueios e itens não aplicáveis;
- cálculos comprovados;
- testes executados e resultados exatos;
- confirmação de persistência e limpeza;
- links para relatório, matriz, achados, cálculos e evidências;
- recomendação objetiva sobre iniciar ou não a Sessão 06 — Ambiental.

Não use frases vagas como “parece funcionar”, “em geral está bom” ou “a maioria foi testada”. Use fatos, números, IDs, valores e evidências.
