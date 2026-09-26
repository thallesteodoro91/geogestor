# Prompt mestre — auditoria full stack do GeoGestor por sessões

## Como usar

Antes de iniciar cada auditoria, substitua os campos entre colchetes no bloco abaixo. Execute apenas uma sessão por vez. Ao terminar, abra uma nova sessão com o próximo módulo e informe o caminho do relatório anterior para que sejam feitos testes de regressão nas integrações afetadas.

## Prompt para copiar e usar

```text
Você atuará como engenheiro sênior de QA full stack, especialista em aplicações desktop, UX, acessibilidade, integridade de dados e segurança. Sua tarefa é AUDITAR, CORRIGIR E RETESTAR uma única sessão funcional do GeoGestor até obter evidências suficientes sobre tudo o que pertence ao escopo.

CONFIGURAÇÃO DA SESSÃO
- Sessão atual: [NÚMERO E NOME DA SESSÃO]
- Módulo/menu: [NOME DO MÓDULO]
- Rotas principais: [ROTAS]
- Foco especial desta sessão: [FOCO]
- Relatórios anteriores que devem ser considerados: [CAMINHOS OU “NENHUM”]
- Implementar correções comprovadas: SIM
- Implementar novas funcionalidades ou mudanças de produto: NÃO sem minha aprovação

OBJETIVO
Validar de ponta a ponta cada tela, aba, gráfico, cartão, tabela, filtro, busca, formulário, modal, menu, botão, link, atalho, upload, download, mapa e ação disponíveis no escopo. Não considere uma função aprovada apenas porque o código parece correto ou porque a API respondeu HTTP 200. Comprove o resultado na interface, na API e, quando aplicável, no banco de dados e no sistema de arquivos. Corrija os defeitos comprovados que estiverem dentro do escopo, execute testes de regressão e documente as evidências.

REGRAS DE ESCOPO E CONDUTA
1. Leia integralmente os arquivos AGENTS.md aplicáveis e respeite as Web Interface Guidelines do projeto.
2. Trabalhe somente na sessão atual. Siga para outro módulo apenas quando isso for indispensável para provar uma integração iniciada no escopo; documente o motivo.
3. Não pare após fazer um plano ou apenas ler o código. Abra e use a aplicação real, exercite os fluxos e confronte o comportamento com o frontend, a API e a persistência.
4. Não declare “funciona” sem evidência. Todo item inventariado deve terminar como APROVADO, REPROVADO, BLOQUEADO ou NÃO APLICÁVEL, com justificativa.
5. Preserve alterações preexistentes no repositório. Antes de editar, verifique o estado do Git e não reverta mudanças que não sejam suas.
6. Faça correções mínimas e ligadas à causa raiz. Não redesenhe a arquitetura nem crie recursos novos durante a auditoria.
7. Melhorias de UX ou produto que não sejam correções devem ser listadas separadamente, com benefício, esforço e risco. Não as implemente sem aprovação.
8. Não esconda falhas por meio de mocks no resultado final. Mocks podem apoiar testes unitários, mas a comprovação final precisa incluir o caminho integrado real sempre que o ambiente permitir.
9. Envie atualizações curtas durante o trabalho, principalmente ao concluir inventário, testes funcionais, verificação do backend e retestes.

SEGURANÇA DOS DADOS DE TESTE
1. Descubra primeiro se o ambiente contém dados reais. Use preferencialmente banco, diretório de dados e arquivos isolados para QA.
2. Antes de qualquer mutação, identifique o banco e os diretórios usados pelo processo em execução e produza um backup ou snapshot verificável. Nunca suponha qual arquivo de banco está ativo.
3. Todos os registros criados devem usar um prefixo único, por exemplo: QA-AUDIT-S[SESSÃO]-[DATA-HORA]-.
4. Nunca edite nem exclua registros preexistentes do usuário. Testes de edição, exclusão, relacionamentos e cascata devem usar apenas registros criados nesta sessão.
5. Antes de confirmar uma exclusão, valide o nome e o identificador exatos do registro de teste.
6. Ao final, remova somente os dados sintéticos da sessão e confirme no banco e no sistema de arquivos que não restaram registros, anexos, pastas ou relacionamentos órfãos.
7. Se um defeito impedir a limpeza, não force uma exclusão ampla. Registre exatamente cada resíduo, seu ID e sua localização.
8. Operações materialmente destrutivas — restauração, limpeza total, redefinição do sistema, migração irreversível ou exclusão em massa — só podem ser testadas em ambiente descartável e isolado. Caso contrário, faça inspeção não destrutiva e marque o bloqueio.

FASE 1 — PREPARAÇÃO E LINHA DE BASE
1. Identifique a arquitetura em uso: aplicativo desktop/Electron, frontend, API local, banco, sistema de arquivos, portas, comandos de execução e suíte de testes.
2. Verifique o estado do Git, processos já ativos, logs recentes e saúde da aplicação. Não encerre processos não identificados.
3. Confirme que o frontend está conectado à instância correta da API e ao banco correto.
4. Registre a linha de base: contagens relevantes, valores exibidos, erros existentes no console, requisições com falha e arquivos relacionados.
5. Crie uma pasta de evidências e um relatório da sessão em:
   docs/auditorias/[AAAA-MM-DD]-[slug-da-sessao]/
6. Registre versões do aplicativo, sistema operacional, viewport, tema, banco e commit/estado de trabalho usados na auditoria.

FASE 2 — INVENTÁRIO OBRIGATÓRIO
Antes de testar, produza uma matriz de cobertura contendo:
- ID do item;
- página/rota/aba;
- controle ou fluxo;
- ação esperada;
- componente do frontend;
- endpoint e método da API, se houver;
- tabela/entidade e efeito no sistema de arquivos, se houver;
- cenários positivo, negativo, vazio, carregamento e erro;
- situação do teste e evidência.

Varra a interface e o código do escopo para localizar elementos condicionais que podem não aparecer com o conjunto de dados inicial. Inclua menus contextuais, ações em linhas, estados de permissão, abas secundárias, modais, confirmações, paginação, tooltips, atalhos, importações, exportações e recursos exibidos somente quando há ou não há dados.

FASE 3 — BATERIA DE TESTES DO FRONTEND

A. Navegação e estado
- Abra todas as rotas e subrotas do escopo pelo menu, por links internos e por URL direta.
- Teste voltar/avançar, atualização da página, deep links, parâmetros de busca, preservação ou limpeza intencional de filtros e estado ativo dos menus.
- Procure telas em branco, conteúdo piscando, rotas erradas, carregamento infinito, dupla submissão e erros no console.
- Teste os estados: com muitos dados, poucos dados, vazio, carregando, erro da API, reconexão e operação lenta.

B. Formulários e CRUD
- Use todos os campos, inclusive os opcionais, seletores, calendários, horários, valores monetários, máscaras, checkboxes, radios, textareas e campos de busca.
- Para cada entidade permitida no escopo, complete o ciclo: criar, localizar, abrir, editar, salvar, recarregar, reiniciar quando necessário, excluir, cancelar exclusão e confirmar exclusão.
- Teste cancelar e fechar formulários com e sem alterações, prevenção de perda de dados e foco no primeiro erro.
- Teste campos vazios, limites mínimo/máximo, datas inválidas, números negativos e excessivos, duplicidade, espaços nas bordas, acentos, caracteres especiais, texto longo e valores semanticamente incompatíveis.
- Confirme mensagens de sucesso e erro, estado de carregamento, botão protegido contra envio duplicado e recuperação após falha.
- Confirme que busca, filtro, ordenação e paginação funcionam juntos e permanecem corretos depois de criar, editar ou excluir.

C. Tabelas, cartões, indicadores e gráficos
- Confira títulos, unidades, legenda, eixos, escala, cores, tooltip, totais, arredondamento, moeda, datas, percentuais e tratamento de zero/nulo.
- Recalcule amostras usando os registros da API/banco e compare com os números da interface.
- Altere filtros e confirme que gráfico, cartões e URL representam o mesmo escopo.
- Teste um único ponto, muitos pontos, todas as séries zeradas, valores altos, série parcial e ausência de dados.
- Confirme que filtros ou mutações invalidam e atualizam os dados sem exigir recarga indevida.
- Verifique se visualizações possuem alternativa textual acessível e não dependem apenas de cor.

D. Arquivos, documentos e mapas, quando presentes
- Teste selecionar, enviar, cancelar, baixar, abrir/visualizar, renomear quando permitido e excluir usando arquivos sintéticos pequenos.
- Valide nome com acento, extensão em maiúsculas, nome longo, duplicidade, tipo não permitido, arquivo vazio e arquivo inválido.
- Confirme tipo MIME, limites, mensagens, sanitização do nome, prevenção de path traversal e ausência de arquivos órfãos.
- Em mapas, teste carregamento, enquadramento, zoom, camadas, popups, geometrias válidas e inválidas, CRS quando aplicável, estado offline/indisponível e mensagem de recuperação.

E. Usabilidade e consistência visual
- Avalie clareza dos nomes, hierarquia visual, ordem das ações, feedback, prevenção de erros, confirmação de ações destrutivas e possibilidade de desfazer quando apropriado.
- Teste tema claro e escuro, larguras aproximadas de 360, 768, 1024 e 1440 px, zoom de 200%, textos longos e ausência de rolagem horizontal acidental.
- Verifique truncamento, sobreposição, corte de menus/modais, alvos de toque, estados hover/active/focus/disabled e consistência dos componentes.
- Revise o português, use “…” em textos polidos e formatos pt-BR via Intl para datas, números e moeda.

F. Acessibilidade — alvo WCAG 2.2 AA
- Percorra todo o fluxo apenas com teclado: Tab, Shift+Tab, Enter, Espaço, setas e Escape.
- Confirme foco visível, ordem lógica, retorno de foco após modal, contenção de foco, skip link e foco após mudança de rota.
- Verifique HTML semântico, hierarquia de títulos, landmarks, nomes acessíveis, labels vinculados, instruções, erros associados e aria-live para atualizações assíncronas importantes.
- Botões apenas com ícone precisam de aria-label; ícones decorativos precisam ser ignorados; imagens precisam de alt adequado.
- Verifique contraste, uso não exclusivo de cor, redução de movimento, reflow, tamanho dos alvos e compatibilidade básica com leitor de tela via árvore de acessibilidade.
- Sinalize os antipadrões definidos no AGENTS.md, inclusive transition: all, outline-none sem reposição, navegação por div/span clicável, campos sem label e formatação fixa inadequada.

FASE 4 — BATERIA DE TESTES DO BACKEND E DA PERSISTÊNCIA
Para cada fluxo que lê ou grava dados:
1. Registre método, endpoint, parâmetros, payload e resposta esperada.
2. Teste entradas válidas, inválidas, ausentes, IDs inexistentes, duplicadas e limites relevantes.
3. Confira códigos HTTP, contrato, tipos, mensagens seguras e uniformes e ausência de stack trace ou segredo exposto.
4. Confirme validação no servidor; validação apenas no frontend não é suficiente.
5. Confira criação e atualização no banco, timestamps, normalização, unicidade, chaves estrangeiras e relacionamentos.
6. Recarregue a página e, quando relevante, reinicie o serviço para comprovar persistência.
7. Teste transações e atomicidade: uma falha intermediária não pode deixar metade da operação gravada.
8. Verifique exclusão, política de cascata/restrição, referências compartilhadas, auditoria e arquivos associados.
9. Teste duas submissões rápidas e duas alterações concorrentes quando houver risco de duplicidade ou perda de atualização.
10. Verifique paginação, filtros, ordenação, limites, consultas excessivas e desempenho perceptível.
11. Confira logs e trilha de auditoria: ação, entidade, ID, resultado e dados sensíveis devidamente protegidos.
12. Faça testes seguros de autorização/autenticação, injeção, XSS persistente/refletido, manipulação de ID, upload hostil e path traversal. Não execute payload destrutivo nem tente sair do ambiente autorizado.

FASE 5 — CORREÇÃO
1. Antes de corrigir, reproduza o problema e determine a causa raiz.
2. Adicione ou atualize um teste automatizado que falhe antes da correção sempre que isso for tecnicamente razoável.
3. Faça a menor alteração coerente no frontend, backend, contrato, banco ou sistema de arquivos.
4. Não silencie erros, não enfraqueça validações e não introduza dados especiais apenas para o teste passar.
5. Rode testes focados, lint/typecheck relevantes e depois a regressão do módulo.
6. Repita manualmente o fluxo real corrigido e atualize a evidência.
7. Se uma correção exigir decisão de negócio ou mudança ampla de arquitetura, documente a proposta e aguarde aprovação em vez de adivinhar.

FASE 6 — REGRESSÃO E CRITÉRIO DE ENCERRAMENTO
Não encerre a sessão enquanto houver item do inventário sem situação. Para concluir:
- todos os fluxos do escopo foram exercitados ou têm bloqueio reproduzível;
- correções foram retestadas no nível unitário/integrado e na interface real;
- integrações imediatamente afetadas foram verificadas;
- nenhum erro novo relevante aparece no console, rede ou logs;
- os dados sintéticos foram removidos e a limpeza foi comprovada;
- o Git diff foi revisado para garantir que não há alterações alheias ao escopo;
- o relatório final informa com honestidade o que não foi possível testar.

CLASSIFICAÇÃO DOS ACHADOS
- P0 — perda/corrupção de dados, falha grave de segurança ou aplicativo inutilizável;
- P1 — fluxo principal quebrado, resultado financeiro/técnico incorreto ou bloqueio sério de acessibilidade;
- P2 — função secundária incorreta, inconsistência relevante, validação ausente ou UX bastante prejudicada;
- P3 — problema visual/textual menor ou melhoria recomendada.

ENTREGÁVEIS OBRIGATÓRIOS
1. Relatório Markdown da sessão com resumo executivo.
2. Matriz completa de cobertura e resultado.
3. Lista de achados com: ID, gravidade, camada, rota, pré-condição, passos, esperado, obtido, evidência, causa raiz, arquivos/endpoints envolvidos, correção e resultado do reteste.
4. Evidências úteis: capturas de tela, logs mínimos, requisições/respostas sanitizadas e consultas de verificação, sem dados sensíveis.
5. Relação de arquivos de código alterados e motivo.
6. Comandos de teste executados e resultados exatos.
7. Contagem final: aprovados, reprovados corrigidos, reprovados pendentes, bloqueados e não aplicáveis.
8. Riscos residuais e itens que a sessão seguinte deve retestar.
9. Lista separada de melhorias não implementadas, priorizadas por benefício, esforço e risco.
10. Confirmação da limpeza dos dados sintéticos ou inventário exato dos resíduos.

FORMATO DA RESPOSTA FINAL
Comece pelo resultado real, não pelo processo. Informe:
- status da sessão: APROVADA, APROVADA COM RESSALVAS ou REPROVADA;
- cobertura obtida em números;
- defeitos encontrados e quantos foram corrigidos;
- pendências e bloqueios;
- testes executados;
- links para relatório e evidências;
- recomendação objetiva sobre iniciar ou não a próxima sessão.

Não use frases vagas como “parece funcionar”, “em geral está bom” ou “a maioria foi testada”. Use fatos, números, IDs e evidências.
```

## Configuração pronta — Sessão 01: Visão Geral

Use estes valores no início do prompt mestre:

```text
- Sessão atual: 01 — Visão Geral e integrações imediatas com tarefas
- Módulo/menu: Visão Geral
- Rotas principais: /; seguir para /tarefas somente nos fluxos iniciados ou resumidos pela Visão Geral
- Foco especial desta sessão: carregamento do painel; seletor e persistência de período; Fluxo de Caixa; indicadores de Clientes, Projetos, Área sob Gestão e Eficiência Operacional; Próximos Vencimentos; Taxa de Conclusão; Distribuição de Projetos; filtros, agrupamentos, legendas, tooltips e cálculos de todos os gráficos; atividades recentes; alertas; links de detalhamento; atualização do painel depois de mutações; criar, editar, concluir, reabrir, cancelar exclusão e excluir tarefas sintéticas; verificar se as contagens e gráficos se atualizam corretamente após cada ação, após recarregar a tela e, quando relevante, após reiniciar o serviço.
- Relatórios anteriores que devem ser considerados: NENHUM
```

### Dados mínimos para a Sessão 01

Crie somente em ambiente isolado:

- uma tarefa pendente dentro do prazo;
- uma tarefa atrasada;
- uma tarefa concluída;
- uma tarefa no limite do período selecionado;
- um conjunto mínimo de projetos/valores financeiros sintéticos apenas se necessário para validar os gráficos;
- casos de zero dados e dados parciais, preferencialmente em banco descartável.

Compare manualmente pelo menos uma amostra de cada indicador e cada segmento de gráfico com a resposta da API e a persistência. Após editar, concluir, reabrir e excluir uma tarefa, confirme a atualização de Visão Geral e da lista de Tarefas, a trilha de auditoria e a inexistência de registros órfãos.

## Catálogo sugerido das próximas sessões

1. **Visão Geral** — painel, indicadores, gráficos, vencimentos, atividades, alertas e integração com tarefas.
2. **Comercial — Clientes** — listagem, busca, filtros, paginação, cadastro, edição, exclusão, detalhes, propriedades, projetos, documentos, mapas, histórico, notas e vínculos.
3. **Comercial — CRM e Funil** — leads, oportunidades, etapas, filtros, conversão para cliente, atividades, vínculos e integridade do funil.
4. **Comercial — Orçamentos** — criação e edição completas, itens, serviços, valores, descontos, impostos, cliente/propriedade/projeto, estados, aprovação/revisão, PDF, duplicação e exclusão permitida.
5. **Projetos** — listagem, visões, cadastro, detalhes, equipe, etapas, documentos, mapas, financeiro, status e vínculos.
6. **Ambiental** — registros ambientais, CAR, licenciamento, licenças, condicionantes, cálculos, documentos, prazos e mapas.
7. **Financeiro** — visão financeira, faturamentos, recebimentos, contas a pagar, despesas, parcelas, categorias, conciliação e integrações com orçamentos/projetos.
8. **Agenda — Calendário** — compromissos, visualizações, recorrência se houver, filtros, detalhes, conflitos, lembretes e vínculos.
9. **Agenda — Tarefas** — CRUD completo, prioridades, prazos, conclusão/reabertura, filtros, paginação, alertas e vínculos.
10. **Topografia** — todas as calculadoras, unidades, precisão, arredondamento, entradas-limite, histórico e validação dos resultados por cálculo independente.
11. **Relatórios** — todos os tipos, filtros, totais, períodos, tabelas, gráficos, exportações e rastreabilidade até os registros de origem.
12. **Planejamento** — metas, cenários, períodos, cálculos, edição, exclusão, indicadores e integrações.
13. **Cadastros e Propriedades** — todos os cadastros auxiliares, dependências, duplicidade, restrições de exclusão, propriedades, documentos e mapas.
14. **Configurações e Administração** — configurações gerais, empresa, tema, segurança local, importação e esquemas, qualidade de dados, pós-atualização e logs de auditoria. Backup, restauração e limpeza total somente em ambiente descartável.
15. **Ajuda, navegação global e regressão final** — conteúdo de ajuda, links, rotas inexistentes, menu lateral, tema, bloqueio de sessão, notificações, responsividade, acessibilidade global e jornada integrada entre módulos.

## Configuração pronta — Sessão 02: Comercial — Clientes

```text
- Sessão atual: 02 — Comercial — Clientes
- Módulo/menu: Comercial > Clientes
- Rotas principais: /clientes e /clientes/:id; acessar CRM, Orçamentos, Projetos ou Propriedades apenas para verificar vínculos iniciados no cliente
- Foco especial desta sessão: listagem, pesquisa, filtros, ordenação, paginação, estados vazios; cadastrar, cancelar, validar, salvar, editar e excluir cliente sintético; testar todos os campos e seções do formulário; abrir todos os detalhes e abas; criar e manipular propriedades, projetos, notas, histórico, documentos, mapas, orçamentos e demais vínculos disponíveis; testar upload, pré-visualização, download e exclusão de arquivos; conferir renomeação/movimentação segura das pastas do cliente; validar restrições e cascatas de exclusão; confirmar persistência, trilha de auditoria e atualização de todos os resumos relacionados.
- Relatórios anteriores que devem ser considerados: [CAMINHO DO RELATÓRIO DA SESSÃO 01]
```

## Configuração pronta — Sessão 03: Comercial — CRM e Funil

Para a versão completa e autônoma, use [PROMPT-SESSAO-03-COMERCIAL-CRM-FUNIL.md](./PROMPT-SESSAO-03-COMERCIAL-CRM-FUNIL.md).

```text
- Sessão atual: 03 — Comercial — CRM e Funil
- Módulo/menu: Comercial > CRM
- Rotas principais: /crm, incluindo ?view=leads, ?view=funil e ?view=indicadores; verificar /contatos somente como redirecionamento legado; acessar /clientes/:id, /orcamentos, /orcamentos/novo e /projetos/:id somente nos fluxos iniciados no CRM
- Foco especial desta sessão: Leads, Funil de vendas e Indicadores; CRUD, busca, filtros, paginação, conversão e exclusão segura de leads; prevenção de clientes duplicados; CRUD completo de oportunidades; todos os campos e validações; movimentação e reordenação no kanban; transições Prospectado, Contato, Proposta, Ganho e Perdido; reabertura; próximas ações atrasadas; oportunidades paradas; histórico de etapas; vínculos com cliente, lead, orçamento e projeto; cálculo independente de pipeline aberto, ponderado, conversão, valores e médias por etapa; persistência na URL/API/banco; atualização imediata dos indicadores; responsividade, teclado, drag and drop acessível e WCAG 2.2 AA.
- Relatórios anteriores que devem ser considerados: docs/auditorias/2026-09-07-visao-geral/RELATORIO.md; docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md
```

### Dados mínimos para a Sessão 03

Crie somente em ambiente isolado, com prefixo `QA-AUDIT-S03-[DATA-HORA]-`:

- leads ativo, convertido, sem correspondência e correspondente a cliente sintético;
- um cliente sintético para testar associação sem duplicidade;
- uma oportunidade em cada etapa do funil;
- valores e probabilidades conhecidos para recalcular pipeline aberto/ponderado;
- próximas ações atrasada, atual, futura e ausente;
- oportunidade parada há mais de 14 dias e outra recente;
- um orçamento sintético para vínculo;
- um projeto sintético somente por conversão da oportunidade;
- estados vazio e parcial.

Confirme conversões, transições, reordenação, histórico, auditoria, indicadores, atomicidade, idempotência e limpeza de todas as relações sintéticas.

## Configuração pronta — Sessão 04: Comercial — Orçamentos

Para a versão completa e autônoma, use [PROMPT-SESSAO-04-COMERCIAL-ORCAMENTOS.md](./PROMPT-SESSAO-04-COMERCIAL-ORCAMENTOS.md).

```text
- Sessão atual: 04 — Comercial — Orçamentos
- Módulo/menu: Comercial > Orçamentos
- Rotas principais: /orcamentos, /orcamentos/novo e /orcamentos/:id/editar; usar budgetId e highlightId na listagem; acessar Cliente, CRM, Projeto, Financeiro, Visão Geral e Relatórios somente para comprovar efeitos iniciados por um orçamento
- Foco especial desta sessão: listagem, busca, filtros avançados, chips, status, paginação, indicadores e análise comercial; 12 seções do editor; cadastro rápido de cliente; propriedade e projeto; caracterização técnica; itens, modelos e reordenação; custos internos; impostos, perfis e bases de cálculo; honorários, margem, markup, lucro, descontos e acréscimos; condições e parcelas; pré-visualização e PDF; ciclo Rascunho, Emitido, Enviado, Em negociação, Aprovado, Rejeitado, Expirado, Cancelado e Substituído; visualização, duplicação, exclusão lógica, aprovação idempotente, revisão/versionamento, snapshots, auditoria, criação/vínculo de projeto e contas a receber sem registrar caixa antes da liquidação.
- Relatórios anteriores que devem ser considerados: docs/auditorias/2026-09-07-visao-geral/RELATORIO.md; docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md; docs/auditorias/2026-09-08-comercial-crm-funil/RELATORIO.md
```

### Dados mínimos para a Sessão 04

Crie somente em ambiente isolado, com prefixo `QA-AUDIT-S04-[DATA-HORA]-`:

- dois clientes, propriedades rural/urbana e projetos de clientes distintos;
- rascunhos mínimo e completo;
- itens de serviço, despesa, taxa repassada e opcional, com quantidades decimais e ajustes fixos/percentuais;
- custos próprio, reembolsável e repassado;
- impostos inclusos, por fora, cumulativos e com ajuste justificado nas quatro bases disponíveis;
- condições à vista e parcelada, incluindo resíduo de arredondamento;
- modelo de itens, perfil tributário e parâmetro de precificação;
- orçamentos percorrendo todos os estados permitidos;
- aprovações com projeto existente e projeto novo;
- revisão formal, versão substituída e cenário controlado com valor já recebido;
- PDFs de rascunho e emitido;
- estados vazio, parcial, erro e dados-limite.

Comprove por cálculo independente os totais, impostos, honorários, custos, lucro, margem, markup, parcelas e KPIs. Confirme atomicidade, idempotência, snapshots, auditoria, efeitos imediatos e limpeza de todas as relações e arquivos sintéticos.

## Configuração pronta — Sessão 05: Projetos

Para a versão completa e autônoma, use [PROMPT-SESSAO-05-PROJETOS.md](./PROMPT-SESSAO-05-PROJETOS.md).

```text
- Sessão atual: 05 — Projetos
- Módulo/menu: Projetos
- Rotas principais: /projetos e /projetos/:id; validar /operacional como redirecionamento legado para /projetos?visualizacao=estatisticas; acessar Cliente, Propriedade, Orçamentos, Financeiro, Tarefas, Agenda, Ambiental, Relatórios e OpenStreetMap somente para comprovar efeitos iniciados ou resumidos em Projetos
- Foco especial desta sessão: visões Lista, Grade e Estatísticas; URL, busca, filtros, ordenação e paginação; indicadores operacionais, distribuição por status e Receita × Custo × Lucro; cadastro/edição em Dados essenciais, Imóvel e documentação e Localização e notas; projetos Rural, Urbano e especializados Ambiental, Licenciamento e Perícia; alteração de cliente e de tipo; detalhe, prazos, checklist e tarefas; documentos, upload/download/exclusão, PDF, pastas e outbox; contexto financeiro, despesas, parcelas, decisões após suspensão/cancelamento; exclusão, auditoria, atomicidade, persistência e limpeza.
- Relatórios anteriores que devem ser considerados: docs/auditorias/2026-09-07-visao-geral/RELATORIO.md; docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md; docs/auditorias/2026-09-08-comercial-crm-funil/RELATORIO.md; docs/auditorias/2026-09-10-comercial-orcamentos/RELATORIO.md
```

### Dados mínimos para a Sessão 05

Crie somente em ambiente isolado, com prefixo `QA-AUDIT-S05-[DATA-HORA]-`:

- dois clientes ativos e propriedades rural/urbana, incluindo uma propriedade de outro cliente;
- projetos atrasado, vencendo hoje, futuro, sem prazo e concluído, com estados e datas conhecidas;
- projetos comum, Ambiental, Licenciamento e Perícia, incluindo dependências que permitam testar bloqueio de troca de tipo;
- áreas em ha e m², documentos rurais, coordenadas válidas/inválidas e memorial;
- modelo de checklist e pelo menos dez tarefas cobrindo prioridade, atraso e conclusão;
- arquivos PDF, imagem e geoespacial aceito, além de nomes/extensões e payloads inválidos seguros;
- orçamento aprovado, parcelas, recebimento, nota fiscal quando necessária e despesas ativa/cancelada/revertida;
- cenários independentes para cada decisão financeira após suspensão/cancelamento;
- valores conhecidos para recalcular indicadores, gráfico dos cinco principais projetos e contexto financeiro;
- volume para paginação, estados vazio, parcial, lento e erro.

Comprove em interface, API, SQLite, PDF e sistema de arquivos a criação, edição, troca de cliente/tipo, tarefas, arquivos, outbox, contexto financeiro, decisões, exclusão e limpeza. Não invente visão de mapa ou gestão de equipe se esses controles não existirem na versão auditada; registre-os como não aplicáveis.

## Configuração pronta — Sessão 06: Ambiental

Para a versão completa e autônoma, use [PROMPT-SESSAO-06-AMBIENTAL.md](./PROMPT-SESSAO-06-AMBIENTAL.md).

```text
- Sessão atual: 06 — Ambiental
- Módulo/menu: Ambiental
- Rotas principais: /ambiental, /ambiental/:id e /ambiental/licencas/:id; validar /licenciamento e /calculadora-ambiental como redirecionamentos legados; acessar Projetos, Clientes, Propriedades, Tarefas, Documentos, Alertas, Visão Geral e Relatórios somente para comprovar efeitos iniciados ou resumidos pelo Ambiental
- Foco especial desta sessão: abas Demandas Ambientais, Licenciamento e Análise CAR; lista, busca, filtros, paginação e URL; cadastro/edição de demandas Ambiental e Perícia; fases, andamentos, conclusão, histórico e laudo PDF; CRUD de licenças, status registrado versus efetivo, vencimentos, renovação e resumo operacional; CRUD de condicionantes, prazos, cumprimento, comprovantes e deep links; alertas; cálculos dos arts. 12, 15, 67 e 68, memória, histórico salvo, vínculos, persistência, auditoria e limpeza.
- Relatórios anteriores que devem ser considerados: docs/auditorias/2026-09-07-visao-geral/RELATORIO.md; docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md; docs/auditorias/2026-09-08-comercial-crm-funil/RELATORIO.md; docs/auditorias/2026-09-10-comercial-orcamentos/RELATORIO.md; docs/auditorias/2026-09-11-projetos/RELATORIO.md
```

### Dados mínimos para a Sessão 06

Crie somente em ambiente isolado, com prefixo `QA-AUDIT-S06-[DATA-HORA]-`:

- clientes e propriedades sintéticos, incluindo vínculo cruzado inválido;
- demandas Ambiental e Perícia, fases, tarefas e andamentos conhecidos;
- licenças LP, LI, LO, Renovação e Outros, vencidas, vencendo hoje e em 30/60/90/120/121 dias;
- status registrados e efetivos, incluindo renovação, suspensão e encerramento;
- condicionantes pendente, em andamento, cumprida, vencida e dispensada;
- alertas de licença e condicionante nas bordas da janela;
- cenários CAR para as quatro regiões e para os arts. 15, 67 e 68;
- entradas inválidas, valores de borda, déficit zero/positivo e excedente;
- cálculos salvos sem vínculo, com cliente/projeto compatíveis e incompatíveis;
- PDFs dos quatro tipos disponíveis, incluindo texto longo e caracteres pt-BR;
- estados vazio, parcial, lento, erro e dados legados normalizáveis.

Recalcule prazos, contadores e resultados CAR independentemente. Consulte fontes oficiais vigentes antes de aprovar regra legal e não trate a triagem como aprovação do CAR. Confirme em interface, API, SQLite, alertas e PDF a persistência, integridade, auditoria e limpeza.

## Configuração pronta — Sessão 07: Financeiro

Para a versão completa e autônoma, use [PROMPT-SESSAO-07-FINANCEIRO.md](./PROMPT-SESSAO-07-FINANCEIRO.md).

```text
- Sessão atual: 07 — Financeiro
- Módulo/menu: Financeiro
- Rotas principais: /financeiro nas abas Visão geral, Contas a receber, Contas a pagar e Viagens/Notas fiscais; validar /dashboard-financeiro, /faturas, /despesas e /gestao-financeira como redirecionamentos legados; acessar Orçamentos, Clientes, Projetos, Documentos, Alertas, Visão Geral e Relatórios somente para criar pré-condições ou comprovar efeitos financeiros
- Foco especial desta sessão: período e filtros; fluxo de caixa; indicadores, gráficos, tooltips, alertas e CSV; parcelas e seus deep links; recebimentos parciais/integrais, acréscimos, descontos, comprovantes e estornos; despesas, categorias, subcategorias, tipos e centros de custo, documentos, cancelamento, exclusão permitida e estorno; viagens e prestação; documentos fiscais informados; diagnóstico de vínculos; cálculos independentes, cache, atomicidade, persistência, auditoria e limpeza
- Relatórios anteriores que devem ser considerados: docs/auditorias/2026-09-07-visao-geral/RELATORIO.md; docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md; docs/auditorias/2026-09-08-comercial-crm-funil/RELATORIO.md; docs/auditorias/2026-09-10-comercial-orcamentos/RELATORIO.md; docs/auditorias/2026-09-11-projetos/RELATORIO.md; docs/auditorias/2026-09-11-ambiental/RELATORIO.md
```

### Dados mínimos para a Sessão 07

Crie somente em ambiente isolado, com prefixo `QA-AUDIT-S07-[DATA-HORA]-`:

- clientes, projetos e orçamentos sintéticos em estados conhecidos, incluindo aprovado com e sem parcelas;
- parcelas pendente, atrasada, parcial e paga, com vencimentos nas bordas do período;
- recebimentos simples e com juros, multa, desconto e taxas, incluindo um estorno;
- comprovantes corretos e tentativas de vínculo com documento de outro cliente/projeto;
- despesas pendente, vencida, paga, administrativa, de projeto, de viagem e reembolsável, distribuídas por categorias, tipos e centros de custo;
- despesas independentes para editar, cancelar, excluir e estornar;
- viagens com saldo positivo, zero e negativo, abertas e encerradas;
- documentos fiscais informados emitido e cancelado, sem dados fiscais reais;
- valores conhecidos para resultado de caixa positivo e negativo, gráficos, filtros, rentabilidade e CSV;
- volume acima de 25 itens para paginação, além de estados vazio, parcial, lento, erro e legado compatível.

Reconcilie em centavos, por cálculo independente, a receita contratada, recebida, pendente e atrasada; despesas lançadas, pagas e atrasadas; saldos das parcelas; resultado de caixa; meses; categorias; clientes e prestação de viagem. Confirme em interface, API, SQLite, eventos, alertas, documentos e auditoria a persistência, atomicidade, ausência de dupla contagem e limpeza.

## Configuração pronta — Sessão 08: Agenda — Calendário

Para a versão completa e autônoma, use [PROMPT-SESSAO-08-AGENDA-CALENDARIO.md](./PROMPT-SESSAO-08-AGENDA-CALENDARIO.md).

```text
- Sessão atual: 08 — Agenda — Calendário
- Módulo/menu: Agenda — Calendário
- Rotas principais: /calendario e detalhes de compromisso, tarefa e projeto; usar mes, data, busca, tipo e status; acessar Projetos, Clientes, Tarefas, Alertas, Pesquisa global e Configurações — Google Agenda somente para comprovar integrações imediatas
- Foco especial desta sessão: grade mensal, agenda do dia, navegação por mês/dia/ano, URL, busca e filtros; consolidação de início/entrega de projetos, prazo de tarefas e compromissos; criação, vínculos, dia inteiro, horários, detalhes, exclusão e desfazer; datas civis e fuso; links de composição Google; OAuth, segredos, sincronização manual/automática, duplicidade, conflito, alertas, persistência, auditoria e limpeza
- Relatórios anteriores que devem ser considerados: docs/auditorias/2026-09-07-visao-geral/RELATORIO.md; docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md; docs/auditorias/2026-09-08-comercial-crm-funil/RELATORIO.md; docs/auditorias/2026-09-10-comercial-orcamentos/RELATORIO.md; docs/auditorias/2026-09-11-projetos/RELATORIO.md; docs/auditorias/2026-09-11-ambiental/RELATORIO.md; docs/auditorias/2026-09-12-financeiro/RELATORIO.md
```

### Dados mínimos para a Sessão 08

Crie somente em ambiente isolado, com prefixo `QA-AUDIT-S08-[DATA-HORA]-`:

- clientes e projetos sintéticos com início/entrega no mesmo mês, em meses distintos e nas bordas;
- tarefas pendente, em progresso e concluída com prazo, além de tarefa sem prazo;
- compromissos dos sete tipos, gerais e vinculados, com horário e de dia inteiro;
- vários eventos das três origens no mesmo dia para ordem, agrupamento e indicador `+N`;
- datas de borda, fim/início de mês e ano, 29 de fevereiro válido/inválido e horários-limite;
- compromissos independentes para exclusão, falha otimista, desfazer e exclusão pelo detalhe;
- eventos vencido, hoje e futuros para alertas;
- volume para limites/desempenho e estados vazio, parcial, lento, erro isolado e reconexão;
- somente com conta Google de QA autorizada: eventos locais/remotos novos, alterados, removidos, com hora/fuso, dia inteiro e paginação.

Reconcilie por cálculo independente a grade, o intervalo mensal, as três fontes, contagens, ordenação e URLs externas. Sem agenda Google isolada, não use a conta real: cubra contratos e segurança e marque OAuth/sync externo como bloqueado.

## Configuração pronta — Sessão 09: Agenda — Tarefas

Para a versão completa e autônoma, use [PROMPT-SESSAO-09-AGENDA-TAREFAS.md](./PROMPT-SESSAO-09-AGENDA-TAREFAS.md).

```text
- Sessão atual: 09 — Agenda — Tarefas
- Módulo/menu: Agenda — Tarefas
- Rotas principais: /tarefas e /tarefas?tarefaId=:id; acessar /calendario/tarefa/:id, /projetos/:id, /clientes/:id, /configuracoes?secao=modelos, Visão Geral, Alertas e Pesquisa global somente para comprovar integrações imediatas
- Foco especial desta sessão: quadro Kanban, carregamento, busca, filtros, datas, projeto, prioridade, paginação, contagens e estados vazios/erro; CRUD, formulário sujo, drag-and-drop, conclusão/reabertura, falha otimista, concorrência e exclusão lógica; vínculo cliente–projeto, deep links, calendário, painel e alertas; modelos de checklist, duplicação, aplicação idempotente, atomicidade, persistência, auditoria, acessibilidade e limpeza
- Relatórios anteriores que devem ser considerados: docs/auditorias/2026-09-07-visao-geral/RELATORIO.md; docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md; docs/auditorias/2026-09-08-comercial-crm-funil/RELATORIO.md; docs/auditorias/2026-09-10-comercial-orcamentos/RELATORIO.md; docs/auditorias/2026-09-11-projetos/RELATORIO.md; docs/auditorias/2026-09-11-ambiental/RELATORIO.md; docs/auditorias/2026-09-12-financeiro/RELATORIO.md; docs/auditorias/2026-09-12-agenda-calendario/RELATORIO.md
```

### Dados mínimos para a Sessão 09

Crie somente em ambiente isolado, com prefixo `QA-AUDIT-S09-[DATA-HORA]-`:

- clientes e projetos sintéticos, com tarefas nos três status e nas três prioridades;
- tarefas vencida, hoje, futura, nas bordas do período e sem prazo;
- tarefa ligada diretamente ao cliente e casos de vínculo coerente, divergente, inexistente e removido;
- títulos iguais e equivalentes por caixa, acento e espaços, além de textos nos limites e conteúdo inerte;
- tarefas independentes para todas as transições, falha otimista, concorrência, cancelamento e confirmação de exclusão;
- ao menos 101 tarefas para paginação, filtros, contagens e deep link fora da primeira página;
- status/prioridade legados somente no banco descartável;
- modelos ativo/inativo, com uma e várias etapas, duplicidades normalizadas e projetos para primeira aplicação, reaplicação e falha transacional;
- tarefas para alertas vencido/hoje/dentro/fora da janela;
- estados vazio global, vazio filtrado, parcial, lento, erro, reconexão e resposta fora de ordem.

Reconcilie por oráculo independente cada coluna, página, filtro, prazo, vínculo, taxa, alerta e aplicação de modelo. Comprove toda mutação em `/tarefas`, API, SQLite e consumidores imediatos antes de limpar somente os dados sintéticos.

## Configuração pronta — Sessão 10: Topografia

Para a versão completa e autônoma, use [PROMPT-SESSAO-10-TOPOGRAFIA.md](./PROMPT-SESSAO-10-TOPOGRAFIA.md).

```text
- Sessão atual: 10 — Topografia
- Módulo/menu: Topografia
- Rota principal: /topografia; acessar Clientes, Projetos e Auditoria somente para salvar e comprovar o histórico de cálculos
- Foco especial desta sessão: Conversor GMS/Decimal nos quatro modos; distância geodésica, distância de quadrícula e azimutes; área/perímetro geográfico e projetado; SIRGAS 2000, WGS 84, UTM, EPSG, datum, fuso, hemisfério, convergência e fator de escala; precisão, arredondamento, unidades e limites; mapas e operação offline; vértices, metadados, reordenação, exclusão, desfazer/refazer; importação CSV/TXT; exportação CSV/GeoJSON/KML/DXF; relatório PDF; salvamento, reabertura, persistência e auditoria
- Relatórios anteriores que devem ser considerados: docs/auditorias/2026-09-07-visao-geral/RELATORIO.md; docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md; docs/auditorias/2026-09-08-comercial-crm-funil/RELATORIO.md; docs/auditorias/2026-09-10-comercial-orcamentos/RELATORIO.md; docs/auditorias/2026-09-11-projetos/RELATORIO.md; docs/auditorias/2026-09-11-ambiental/RELATORIO.md; docs/auditorias/2026-09-12-financeiro/RELATORIO.md; docs/auditorias/2026-09-12-agenda-calendario/RELATORIO.md; docs/auditorias/2026-09-13-agenda-tarefas/RELATORIO.md
```

### Dados mínimos para a Sessão 10

Crie somente em ambiente isolado, com prefixo `QA-AUDIT-S10-[DATA-HORA]-`:

- GMS/decimal nos quatro hemisférios, zero, limites e valores inválidos;
- pares conhecidos geográficos/projetados em SIRGAS 2000 e WGS 84, zonas UTM e hemisférios N/S;
- distâncias coincidente, curta, longa, cardeal, diagonal, quase antípoda e antimeridiana;
- polígonos plano/geográfico simples, irregular, invertido, côncavo, duplicado, degenerado, auto-intersectante, outlier e multifuso;
- vértices com metadados e ações para edição, reordenação, exclusão, limpeza, desfazer/refazer;
- CSV/TXT com delimitadores, decimais, cabeçalhos, colunas e linhas válidas/inválidas, inclusive limites 2 MB/10.000 linhas/50 colunas;
- geometria para cada exportação e PDF;
- cliente/projetos sintéticos e um cálculo salvo por aba/modo, além de JSON legado inválido;
- estados online/offline, falha de tile/clipboard/download, histórico vazio/lento/erro e `localStorage` corrompido.

Compare cada resultado com oráculo independente, registrando método, datum, EPSG, eixos, unidades, precisão e tolerância. Valide os arquivos gerados em ferramenta externa apropriada e limpe somente dados e artefatos sintéticos.

## Configuração pronta — Sessão 11: Relatórios

Para a versão completa e autônoma, use [PROMPT-SESSAO-11-RELATORIOS.md](./PROMPT-SESSAO-11-RELATORIOS.md).

```text
- Sessão atual: 11 — Relatórios
- Módulo/menu: Relatórios
- Rota principal: /relatorios; verificar /relatorio-executivo somente como redirecionamento legado; acessar Financeiro, Orçamentos e Projetos apenas para criar dados sintéticos, comprovar valores e seguir links iniciados no relatório
- Foco especial desta sessão: relatórios Financeiro, Projetos e Executivo; mês atual, últimos 30 dias, trimestre, ano, histórico e período personalizado; parâmetros inicio/fim/tipo na URL; totais em centavos, datas de caixa e competência, coortes e comparação anterior; receita contratada/recebida/pendente/vencida, despesas pagas, resultado de caixa, impostos e conversão; projetos ativos/concluídos/cancelados, prazos e área conhecida; distribuições, agenda crítica, cinco alertas gerenciais, composições de KPI, gráficos, legendas, tooltips e tabelas acessíveis; estados vazio/parcial/loading/erro; cache de 30 segundos, invalidação após mutações, concorrência e persistência; rastreabilidade às origens; pré-visualização, impressão e PDF multipágina com identidade empresarial
- Relatórios anteriores que devem ser considerados: docs/auditorias/2026-09-07-visao-geral/RELATORIO.md; docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md; docs/auditorias/2026-09-08-comercial-crm-funil/RELATORIO.md; docs/auditorias/2026-09-10-comercial-orcamentos/RELATORIO.md; docs/auditorias/2026-09-11-projetos/RELATORIO.md; docs/auditorias/2026-09-11-ambiental/RELATORIO.md; docs/auditorias/2026-09-12-financeiro/RELATORIO.md; docs/auditorias/2026-09-12-agenda-calendario/RELATORIO.md; docs/auditorias/2026-09-13-agenda-tarefas/RELATORIO.md; docs/auditorias/2026-09-13-topografia/RELATORIO.md
```

### Dados mínimos para a Sessão 11

Crie somente em ambiente isolado, com prefixo `QA-AUDIT-S11-[DATA-HORA]-`:

- orçamentos em todos os estados relevantes, diretos e parcelados, com datas no período atual, anterior e fora deles;
- parcelas pendentes, parciais, pagas, vencidas, de hoje, futuras, canceladas e excluídas;
- recebimentos múltiplos, legado, estornado e excluído, sem dupla contagem;
- despesas pagas/não pagas em várias categorias, além de canceladas, estornadas e excluídas;
- projetos por estado, tipo e município, com prazos vencido/hoje/+30/+31 e área nula/zero/positiva;
- dados que disparem isoladamente receita vencida, caixa negativo, baixa conversão, projeto atrasado e área desconhecida;
- estados sem fonte, fonte sem dado do tipo, período vazio, somente pendências, parcial e alta cardinalidade;
- identidade empresarial sintética com/sem logo, PDFs de cada tipo e conteúdo suficiente para múltiplas páginas;
- um cálculo topográfico salvo para confirmar que não afeta os indicadores.

Recalcule tudo em centavos e datas civis com oráculo independente. Valide cache/invalidação, todos os gráficos contra suas tabelas, links até as origens e cada PDF fora do gerador. CSV/XLSX são `NÃO APLICÁVEL` enquanto não existirem na versão executada. Limpe somente dados, arquivos e cache sintéticos.

## Configuração pronta — Sessão 12: Planejamento estratégico

Para a versão completa e autônoma, use [PROMPT-SESSAO-12-PLANEJAMENTO.md](./PROMPT-SESSAO-12-PLANEJAMENTO.md).

```text
- Sessão atual: 12 — Planejamento estratégico
- Módulo/menu: Planejamento
- Rota principal: /planejamento; acessar Financeiro, CRM, Projetos e Tarefas somente para criar fixtures, comprovar fontes/vínculos ou seguir links iniciados no Planejamento
- Foco especial desta sessão: Visão estratégica, Objetivos e metas, Iniciativas e Revisões e riscos; seleção e ativação exclusiva de ciclos; CRUD completo de ciclos, pilares, objetivos, resultados-chave, iniciativas, revisões, decisões e riscos; fórmulas aumentar/reduzir/manter, médias, clamp, zero versus ausência e desatualização por frequência; fontes automáticas de resultado de caixa, conversão comercial, conclusão de projetos e conclusão de tarefas; responsáveis, prazos, prioridades, ordens, orçamento e vínculos; gestão por exceção, próximas decisões e marcos; snapshots, tendências e linha do tempo; filtros/ordenação persistidos na URL; integridade referencial, exclusão lógica, transações, concorrência, auditoria, acessibilidade e responsividade
- Relatórios anteriores que devem ser considerados: todos os relatórios das Sessões 01–10 listados no prompt completo e o relatório efetivamente produzido pela Sessão 11 em docs/auditorias/[AAAA-MM-DD]-relatorios/RELATORIO.md; se este último ainda não existir, registrar a ausência sem inventar resultados
```

### Dados mínimos para a Sessão 12

Crie somente em ambiente isolado, com prefixo `QA-AUDIT-S12-[DATA-HORA]-`:

- ciclos rascunho, ativo e encerrado, incluindo troca transacional do ciclo ativo;
- dois pilares e objetivos cobrindo todos os status, prioridades, ordens, responsáveis e bordas de prazo;
- resultados manuais aumentar/reduzir/manter, zero, nulo, desatualizado, linha de base/meta iguais e valores fora da trajetória;
- um resultado automático de Financeiro, CRM, Projetos e Tarefas com oráculos conhecidos e ausência real;
- iniciativas em todos os status, com orçamento, dependências, marcos e vínculos sintéticos com projeto/tarefa;
- duas ou mais revisões com mudanças controladas para snapshots e todos os contadores de tendência;
- decisões em todos os estados, incluindo vencimento, conclusão obrigatoriamente explicada e reabertura;
- riscos por impacto/probabilidade/status, gerais e vinculados, incluindo agravamento, mitigação e resolução;
- estados vazios/parciais, filtros combinados, alta cardinalidade, texto inerte e JSON legado inválido apenas no banco descartável.

Recalcule fórmulas e fontes por oráculo independente, valide todos os relacionamentos e exclusões tabela a tabela e comprove os snapshots antes/depois de cada revisão. Cenários hipotéticos, gráficos e exportações são `NÃO APLICÁVEL` enquanto não existirem na versão executada. Limpe somente dados e artefatos sintéticos.

## Configuração pronta — Sessão 13: Cadastros e Propriedades

Para a versão completa e autônoma, use [PROMPT-SESSAO-13-CADASTROS-PROPRIEDADES.md](./PROMPT-SESSAO-13-CADASTROS-PROPRIEDADES.md).

```text
- Sessão atual: 13 — Cadastros e Propriedades
- Módulos/menus: Cadastros e Propriedades
- Rotas principais: /cadastros e /propriedades; acessar Orçamentos, Despesas, Clientes, Projetos, Ambiental e Perícias somente para criar fixtures, comprovar consumidores/vínculos ou seguir integrações iniciadas no escopo
- Foco especial desta sessão: tipos de serviço e categorias/subcategorias de despesa; criação, edição, inativação e reativação; banco autoritativo, cache local, defaults, migração e reparo; consumo por Orçamentos e Despesas com preservação histórica; CRUD completo de propriedades; cliente proprietário; Matrícula, CAR, CCIR e ITR; área, localização e coordenadas; busca, filtro por cliente, paginação e opções remotas; duplicidade normalizada; cliente rápido; vínculos e bloqueios com Projeto, Orçamento, Ambiental e Perícia; migração de propriedades legadas; transações, concorrência, auditoria, acessibilidade e responsividade
- Relatórios anteriores que devem ser considerados: todos os relatórios das Sessões 01–10 listados no prompt completo; o relatório da Sessão 11, se localizado; e docs/auditorias/2026-09-14-planejamento/RELATORIO.md, incluindo sua falha financeira herdada, opções que devem ignorar excluídos e bloqueio do manifesto de release
```

### Dados mínimos para a Sessão 13

Crie somente em ambiente isolado, com prefixo `QA-AUDIT-S13-[DATA-HORA]-`:

- dois clientes ativos e um excluído;
- serviços ativos/inativos com valor zero, em centavos, alto, acentos, nomes longos e duplicatas normalizadas;
- categorias ativas/inativas com zero/uma/várias subcategorias, diferentes separadores e duplicatas;
- estados de banco/cache/default válidos, ausentes, legados, divergentes e corrompidos apenas em perfil/banco descartável;
- orçamento e despesa históricos usando item depois inativado e novos formulários consumidores;
- propriedades cobrindo cada identificador, área nula/zero/positiva, coordenadas nulas/válidas/limites e duplicatas normalizadas;
- propriedades vinculadas separadamente a Projeto, Orçamento, Ambiental e Perícia;
- ao menos 27 propriedades para busca, filtro, paginação e empates de ordenação;
- uma propriedade legada embutida em projeto para validar migração idempotente em cópia descartável;
- estados vazios/parciais, loading, erro, lentidão, reconexão, texto inerte e alta cardinalidade.

Documentos, mapas, anexos, exportação e detalhe próprio da propriedade são `NÃO APLICÁVEL` enquanto não existirem nas rotas atuais. Valide somente integrações imediatas, preserve históricos, prove cada bloqueio de relação e limpe apenas dados/cache sintéticos.

## Configuração pronta — Sessão 14: Configurações e Administração

Para a versão completa e autônoma, use [PROMPT-SESSAO-14-CONFIGURACOES-ADMINISTRACAO.md](./PROMPT-SESSAO-14-CONFIGURACOES-ADMINISTRACAO.md).

```text
- Sessão atual: 14 — Configurações e Administração
- Módulos/menus: Configurações, Importação de dados, Esquemas de importação, Qualidade dos dados, Verificação pós-atualização e Logs de auditoria
- Rotas principais: /configuracoes, /importacao, /importacao/esquemas, /qualidade-dados, /pos-atualizacao e /audit-logs; usar /configuracoes-iniciais somente em perfil novo descartável; acessar módulos de negócio apenas para fixtures ou comprovar efeitos administrativos
- Foco especial desta sessão: empresa e logotipos; pasta de arquivos e migração; segurança local; alertas; aparência; modelos empresariais/PDF e checklist; Google Agenda; política, criação, integridade, retenção, recuperação e restauração de backups; saúde, diagnóstico, histórico e reset; importação simples e migração completa; esquemas; qualidade; pós-atualização; auditoria; segredos, autorizações Electron, transações, concorrência, reinício, acessibilidade e limpeza
- Relatórios anteriores que devem ser considerados: todos os relatórios das Sessões 01–10 listados no prompt completo; o relatório da Sessão 11, se localizado; docs/auditorias/2026-09-14-planejamento/RELATORIO.md; docs/auditorias/2026-09-15-cadastros-propriedades/RELATORIO.md; e as auditorias históricas de Configurações/Backup, Acessibilidade e Segurança local apenas como contexto a ser retestado
```

### Dados mínimos para a Sessão 14

Crie somente em ambiente isolado, com prefixo `QA-AUDIT-S14-[DATA-HORA]-`:

- perfis novo e configurado, empresa/admin sintéticos e logos válidos/inválidos;
- pastas exclusivas de documentos e backup, com destinos válidos, conflitantes, indisponíveis e espaço insuficiente simulado;
- senha local temporária, tentativas inválidas e sessões concorrentes;
- fonte sintética para as nove categorias de alerta;
- modelo empresarial completo/mínimo e modelos de checklist com 1 e 100 etapas;
- credenciais OAuth inválidas e conta Google de QA somente se autorizada;
- backups de banco/completos válidos, corrompidos, incompletos, antigos e incompatíveis, além de código/kit temporários nunca capturados;
- instalações/perfis descartáveis exclusivos para restauração real e reset;
- CSV/XLSX simples de Clientes, Projetos e Contatos, nos limites 500/501, e migração completa com reconciliação conhecida;
- esquemas válidos/corrompidos, cada código de qualidade aplicável e logs INSERT/UPDATE/DELETE/exclusão lógica;
- estados vazios/parciais, loading, erro, lentidão, cancelamento, concorrência, offline/reconexão e reinício.

Restauração, reset, corrupção, disco cheio e interrupção só podem ocorrer em ambiente comprovadamente descartável. Recalcule importações e qualidade por oráculo independente, inspecione os bundles e diagnósticos fora da UI, prove que nenhum segredo entra nas evidências e limpe apenas artefatos sintéticos.

## Configuração pronta — Sessão 15: Ajuda, Navegação Global, Homologação e Release

Para a versão completa e autônoma, use [PROMPT-SESSAO-15-AJUDA-REGRESSAO-RELEASE.md](./PROMPT-SESSAO-15-AJUDA-REGRESSAO-RELEASE.md).

```text
- Sessão atual: 15 — Ajuda, Navegação Global, Homologação e Release
- Módulo/menu principal: Ajuda
- Rotas principais: /ajuda; todas as rotas canônicas do contrato; aliases legados; 404; setup, desbloqueio, indisponibilidade e erro somente em cenários controlados; aplicação empacotada para instalação, atualização manual e desinstalação
- Foco especial desta sessão: veracidade dos 20 artigos e seis categorias atuais; busca, URL, relacionados e links da Ajuda; pesquisa global com Cliente, Projeto, Orçamento, Tarefa, Agenda e Documento; shell, menu, cabeçalho, atalhos, foco, responsividade, rotas, aliases e deep links; regressão das Sessões 01–14; falha financeira herdada e concorrência; Electron e segurança local; versão, governança, build limpo, SBOM, hashes, manifesto, smoke, pacote, instalação, atualização manual, desinstalação, homologação humana Windows/WCAG e decisão de release
- Relatórios anteriores que devem ser considerados: todos os relatórios finais das Sessões 01–14 em docs/auditorias/, inclusive docs/auditorias/2026-09-17-relatorios/RELATORIO.md e docs/auditorias/2026-09-16-configuracoes-administracao/RELATORIO.md; checklist de homologação humana, ADR de governança e documentos históricos de pré-release apenas como contexto
- Implementar correções comprovadas: SIM
- Implementar novas funcionalidades, auto-updater, assinatura, publicação, commit, tag ou push: NÃO sem aprovação expressa
```

### Dados mínimos para a Sessão 15

Crie somente em ambiente isolado, com prefixo `QA-AUDIT-S15-[DATA-HORA]-`:

- cliente, projeto, orçamento, tarefa, compromisso e documento pesquisáveis, incluindo homônimos, acentos, excluído/inativo e deep links válido/inexistente;
- volume para limites de oito por tipo e 30 totais da pesquisa global;
- conjunto financeiro mínimo para reproduzir ou encerrar a falha herdada de remoção;
- fixtures mínimas para um smoke integrado de cada Sessão 01–14;
- perfil/banco de versão anterior suportada com contagens e hashes conhecidos para atualização manual;
- instalação e diretório de release descartáveis, inicialmente vazios, com arquivos sintéticos e nenhum dado real;
- estados vazio, parcial, loading, erro, lentidão, API indisponível, reconexão e resposta fora de ordem.

Separe as decisões de produto funcional, candidato técnico e publicação comercial. Não altere a instalação cotidiana, não remova instaladores históricos para fazer o manifesto passar e não faça commit, tag, push, upload ou publicação sem autorização explícita. Um candidato só pode ser aprovado com fonte limpa e identificável, gates completos verdes e instalador, SBOM, hashes, manifesto e smoke produzidos na mesma execução; a publicação deve permanecer `NÃO EXECUTADA` nesta sessão.

## Auditoria especializada pós-sessões — Backup, Restauração e Recuperação de Desastre

Depois de concluir as 15 sessões, use [PROMPT-AUDITORIA-ESPECIAL-BACKUP-RECUPERACAO.md](./PROMPT-AUDITORIA-ESPECIAL-BACKUP-RECUPERACAO.md) para validar exclusivamente a recuperabilidade dos dados.

O roteiro especializado cobre criação de backup do banco e completo, criptografia, manifesto e hashes, exclusão de credenciais, política automática, retenção, destino externo, encerramento, código/kit de recuperação, teste isolado, restauração no computador original, recuperação em outro perfil/equipamento, falhas físicas, rollback, RPO, RTO, segurança e acessibilidade. Ele exige ambientes A/B descartáveis e separa aprovação de criação, automação, restauração local, recuperação de desastre e prontidão geral.

Se a auditoria especializada completa já estiver válida e restarem apenas os ensaios físicos, use [PROMPT-VALIDACAO-FINAL-BACKUP-RESTAURACAO-REAL.md](./PROMPT-VALIDACAO-FINAL-BACKUP-RESTAURACAO-REAL.md). Esse roteiro reduzido exige o aplicativo instalado, reinício real do Electron, restauração no ambiente A e recuperação por código e por kit em um ambiente B independente, sem tocar no perfil cotidiano nem em dados reais.

## Auditoria especializada pós-sessões — Relatórios Financeiro e de Orçamento

Use [PROMPT-AUDITORIA-ESPECIAL-RELATORIOS-FINANCEIRO-ORCAMENTOS.md](./PROMPT-AUDITORIA-ESPECIAL-RELATORIOS-FINANCEIRO-ORCAMENTOS.md) para validar os dois documentos comerciais e financeiros efetivamente gerados pelo GeoGestor.

O roteiro especializado separa o Relatório Financeiro da proposta de Orçamento, reconcilia banco, API, interface e PDF por oráculos independentes em centavos, valida período, fuso, cache, versão, status, validade, marca-d'água e identidade empresarial, e exige inspeção estrutural, extração de texto e renderização de todas as páginas. A proposta só pode ser aprovada depois de comprovar também que custos, conta financeira, margem, markup, lucro, anotações internas, IDs, caminhos, segredos e dados de outros clientes estão ausentes do conteúdo, bytes e metadados do PDF.

## Auditoria especializada pós-sessões — Importação de Planilhas

Use [PROMPT-AUDITORIA-ESPECIAL-IMPORTACAO-PLANILHAS.md](./PROMPT-AUDITORIA-ESPECIAL-IMPORTACAO-PLANILHAS.md) para auditar CSV/XLSX, importação simples de Clientes, Projetos e Contatos, e migração completa multi-entidade.

O roteiro cobre parsing, abas e cabeçalhos, mapeamento exato/semântico/manual, normalização, prévia, digest, confirmação, idempotência, concorrência, worker, transações, outbox, histórico, esquemas, CSV de erros, segurança de arquivos, acessibilidade, limites de 500/20.000 linhas e reconciliação em centavos. Ele deve ser executado no formato completo depois de mudanças materiais; uma regressão reduzida só é adequada após existir relatório especializado aprovado e pipeline inalterado.
