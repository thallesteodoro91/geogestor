# Prompt de auditoria — Sessão 07: Financeiro

Você atuará como engenheiro sênior de QA full stack, especialista em aplicações desktop, controles financeiros, reconciliação, UX, acessibilidade, integridade de dados e segurança. Sua tarefa é **AUDITAR, CORRIGIR E RETESTAR** somente a Sessão 07 do GeoGestor até obter evidências suficientes sobre tudo o que pertence ao escopo.

## Configuração da sessão

- Sessão atual: **07 — Financeiro**.
- Módulo/menu: **Financeiro**.
- Rota principal: **`/financeiro`**.
- Abas principais:
  - visão geral financeira: `tab=visao` ou URL canônica sem `tab`;
  - contas a receber: `tab=faturas`;
  - contas a pagar: `tab=pagar`;
  - viagens e notas fiscais: `tab=auxiliares`.
- Subáreas de Viagens e notas fiscais: **Viagens e prestação**, **Documentos fiscais** e **Diagnóstico de vínculos**.
- Redirecionamentos legados:
  - `/dashboard-financeiro` → `/financeiro`;
  - `/faturas` → `/financeiro?tab=faturas`;
  - `/despesas` → `/financeiro?tab=pagar`;
  - `/gestao-financeira` → `/financeiro?tab=auxiliares`.
- Parâmetros e deep links a inventariar:
  - visão geral: `periodo`, `inicio`, `fim`, `cliente`, `categoria`, `tipoCusto` e `centroCusto`;
  - criação contextual: `acao=despesa` ou `acao=parcela`, com `cliente` e `projeto` quando fornecidos;
  - conta a receber específica: `tab=faturas&parcela=[ID]`;
  - conta a pagar específica: `tab=pagar&despesa=[ID]`.
- Integrações permitidas: acessar Orçamentos, Clientes, Projetos, Documentos, Alertas, Visão Geral e Relatórios somente para criar pré-condições ou comprovar efeitos financeiros iniciados ou resumidos no Financeiro. Não reauditar integralmente esses módulos.
- Foco especial: visão financeira, períodos e filtros, fluxo de caixa, contas a receber, parcelas, recebimentos parciais e integrais, acréscimos e descontos, comprovantes, estornos, contas a pagar, despesas, categorias, tipos e centros de custo, cancelamentos, exclusões permitidas, viagens, prestação de contas, documentos fiscais informados, diagnóstico de vínculos, exportação CSV, cálculos, alertas, cache/invalidação, persistência e trilha de auditoria.
- Relatórios anteriores obrigatórios:
  - `docs/auditorias/2026-09-07-visao-geral/RELATORIO.md`;
  - `docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md`;
  - `docs/auditorias/2026-09-08-comercial-crm-funil/RELATORIO.md`;
  - `docs/auditorias/2026-09-10-comercial-orcamentos/RELATORIO.md`;
  - `docs/auditorias/2026-09-11-projetos/RELATORIO.md`;
  - `docs/auditorias/2026-09-11-ambiental/RELATORIO.md`.
- Implementar correções comprovadas: **SIM**.
- Implementar novas funcionalidades ou mudanças de produto: **NÃO, sem aprovação expressa**.
- Diretório dos entregáveis: `docs/auditorias/[AAAA-MM-DD]-financeiro/`.

## Objetivo

Validar de ponta a ponta cada aba, cartão, indicador, gráfico, tabela, filtro, campo, seletor, modal, menu, botão, link, impressão, exportação e ação disponível no Financeiro. Não aprove uma função porque o código parece correto ou porque a API respondeu HTTP 200. Comprove o efeito na interface real, no contrato da API, no SQLite, nas entidades relacionadas, nos arquivos vinculados, nos alertas, nos eventos financeiros e na trilha de auditoria.

Recalcule amostras financeiras fora do código de produção, em centavos inteiros, e reconcilie cada total com os registros ativos do banco. Corrija apenas defeitos reproduzidos e pertencentes ao escopo. Para cada correção, adicione teste automatizado quando tecnicamente razoável, repita a jornada real e execute regressão proporcional ao risco.

## Limites contábeis, fiscais e de produto

1. O GeoGestor é um controle gerencial. Não o apresente como escrituração contábil, conciliação bancária automática, apuração tributária ou sistema fiscal oficial.
2. **Nova receita** abre o fluxo real de Orçamento; não existe lançamento arbitrário de receita na interface atual. Audite a integração com a Sessão 04 sem repetir toda a campanha de Orçamentos.
3. Orçamento aprovado representa **receita contratada**, não dinheiro recebido. Só trate como caixa um recebimento efetivo, ou a compatibilidade legada explicitamente prevista para orçamento pago sem parcelas.
4. O demonstrativo de cobrança não é nota fiscal nem recibo de pagamento. A impressão deve comunicar corretamente qual documento está sendo produzido.
5. A área **Documentos fiscais** apenas registra dados informados; ela não emite NFS-e, não valida o documento no município e não calcula tributos.
6. A área **Diagnóstico de vínculos** deve ser somente leitura. Não permita que sua execução corrija, exclua ou reassocie registros silenciosamente.
7. Uma divergência que dependa de decisão contábil ou regra de negócio deve ser documentada e submetida à aprovação; não altere a semântica financeira por suposição.

## Invariantes financeiras obrigatórias

Antes de executar, derive dos contratos vigentes uma memória de cálculo independente e registre os resultados esperados. No mínimo, comprove:

- valores monetários persistidos e calculados em centavos inteiros, sem erro de ponto flutuante;
- valor efetivamente recebido = principal + juros + multa − desconto − taxas;
- o valor efetivamente recebido deve ser positivo;
- o principal recebido deve ser maior que zero e a soma dos principais ativos não pode ultrapassar o principal da parcela;
- saldo da parcela = valor da parcela − soma do principal dos recebimentos ativos;
- parcela sem principal ativo = Pendente; com principal parcial = Parcialmente pago; integralmente liquidada = Pago;
- juros e multa afetam caixa, mas não reduzem o principal pendente; desconto e taxas reduzem o caixa conforme o contrato vigente;
- estorno de recebimento preserva histórico, remove o recebimento dos totais ativos e recalcula saldo, status e data de pagamento da parcela;
- receita recebida = soma do caixa dos recebimentos não excluídos e não estornados, acrescida somente das compatibilidades legadas válidas e sem dupla contagem;
- despesa lançada e despesa paga são conceitos distintos; caixa considera somente despesa efetivamente paga e ativa;
- resultado de caixa = receita recebida − despesas pagas;
- resultado mensal usa a data financeira correta de cada evento, não apenas `createdAt`;
- resultado por competência usa as datas e categorias de competência definidas pelo contrato vigente;
- cancelados, estornados e excluídos logicamente não compõem totais ativos, gráficos, alertas ou rentabilidade;
- saldo da prestação de viagem = adiantamento − total de despesas ativas vinculadas;
- margens, percentuais, ponto de equilíbrio, ticket médio, conversão, despesas em aberto e atrasadas não produzem `NaN`, infinito ou divisão por zero;
- o mesmo orçamento, parcela, recebimento ou despesa não pode ser contado duas vezes por coexistência de campos legados e registros normalizados;
- datas-limite e status vencido usam o dia civil e o fuso local documentado.

Não use as mesmas funções de produção para gerar os valores esperados. Mantenha uma planilha ou tabela manual com entradas, fórmula, resultado esperado, resultado da UI, resultado da API e resultado do banco.

## Dados mínimos obrigatórios

Crie tudo somente em banco, perfil e diretórios descartáveis, com prefixo único `QA-AUDIT-S07-[DATA-HORA]-`:

1. Dois clientes ativos sintéticos e dois projetos, um por cliente.
2. Um orçamento rascunho, um enviado, um aprovado sem parcelas, um aprovado com parcelas e um rejeitado ou expirado.
3. Um orçamento aprovado marcado como pago sem parcelas, exclusivamente para validar a compatibilidade legada e a ausência de dupla contagem.
4. Parcelas com vencimento ontem, hoje, amanhã, no primeiro e no último dia do período escolhido e fora do período.
5. Uma parcela pendente, uma parcialmente paga, uma integralmente paga e uma com vários recebimentos.
6. Um recebimento simples e outro com principal, juros, multa, desconto e taxas conhecidos.
7. Um comprovante documental do cliente/projeto correto e documentos pertencentes a outro cliente e outro projeto para tentativas de vínculo inválido.
8. Um recebimento a estornar, preservando outro recebimento ativo na mesma parcela para testar o recálculo parcial.
9. Despesas pendente dentro do prazo, vencida, paga, administrativa sem cliente/projeto, vinculada ao projeto, vinculada à viagem e reembolsável.
10. Despesas distribuídas por categorias, subcategorias, tipos de custo e centros de custo, incluindo valores legados normalizáveis.
11. Uma despesa não paga para cancelar, outra não paga para excluir e uma paga para estornar; mantenha casos independentes.
12. Uma viagem com saldo positivo, uma com saldo negativo após despesas e uma sem despesas; inclua estados aberta e encerrada.
13. Um documento fiscal emitido, um a cancelar e, se o contrato suportar, um substituído, sempre identificado como registro informativo.
14. Um conjunto controlado que produza resultado de caixa positivo e outro negativo.
15. Um conjunto de pelo menos 26 contas a receber e 26 despesas para paginação; gere mecanicamente apenas no banco descartável quando o fluxo manual seria desproporcional, preservando algumas criações completas pela interface.
16. Casos de zero dados, dados parciais, busca sem resultado, filtro sem resultado, carregamento, resposta lenta, erro da API, reconexão, textos longos, valores altos seguros e registros legados compatíveis.
17. Registros sintéticos de vínculo inconsistente criados somente se as restrições do banco descartável permitirem e sem desabilitar proteções do banco real, para validar o diagnóstico.

Defina antes das mutações uma tabela-oráculo com todos os totais esperados por período, cliente, categoria, tipo de custo, centro de custo, status e mês.

## Regras de escopo e conduta

1. Leia integralmente todos os `AGENTS.md` aplicáveis e siga as Web Interface Guidelines do projeto.
2. Leia integralmente os seis relatórios anteriores. Reteste apenas correções, integrações e riscos que afetem diretamente o Financeiro.
3. Considere como risco herdado da Sessão 06: concorrência multiprocesso, virada real da meia-noite, lock/timeout SQLite, leitor de tela real, matriz visual completa e upgrade sobre instalação anterior. Reteste os que forem críticos aos fluxos financeiros; mantenha bloqueio explícito quando o ambiente não permitir.
4. Trabalhe somente nesta sessão. Abra outro módulo apenas para criar pré-condição ou provar consequência financeira e registre o motivo.
5. Não pare após planejar ou ler o código. Use a aplicação real e confronte interface, rede, API, banco, documentos, eventos, alertas e logs.
6. Todo item inventariado deve terminar como `APROVADO`, `APROVADO APÓS CORREÇÃO`, `REPROVADO`, `BLOQUEADO` ou `NÃO APLICÁVEL`, com justificativa e evidência.
7. Não invente edição/exclusão de parcelas, edição visual de viagem, baixa bancária, emissão fiscal, conciliação automática ou download de arquivo se essas ações não existirem na versão auditada. Inventarie o comportamento real e marque recursos ausentes como `NÃO APLICÁVEL`.
8. Endpoints financeiros legados ou sem consumidor visual atual devem ser inventariados como contratos de backend e claramente separados dos fluxos principais.
9. Preserve alterações preexistentes. Registre o estado inicial do Git e não reverta trabalho de terceiros.
10. Faça correções mínimas ligadas à causa raiz. Não redesenhe o produto nem crie recursos novos.
11. Melhorias não corretivas devem ser listadas separadamente por benefício, esforço e risco e não podem ser implementadas sem aprovação.
12. Mocks podem apoiar testes unitários, mas a comprovação final deve usar frontend, API e SQLite integrados sempre que o ambiente permitir.
13. Envie atualizações curtas ao concluir inventário, visão geral, contas a receber, contas a pagar, auxiliares, backend/persistência, correções e regressão.

## Segurança dos dados de teste

1. Identifique banco, perfil Electron, diretório de dados, documentos e serviço realmente usados pelo processo. Nunca presuma qual banco está ativo.
2. Detecte dados reais antes de mutar. Use banco, perfil, pastas e downloads totalmente isolados.
3. Antes da primeira mutação, produza backup ou snapshot verificável e registre caminho, tamanho, data e SHA-256 quando aplicável.
4. Nunca edite, liquide, estorne, cancele ou exclua registros preexistentes do usuário.
5. Antes de confirmar qualquer operação financeira, confira ID, descrição, cliente, projeto, orçamento, valor, vencimento e prefixo exatos.
6. Não use dados bancários, fiscais, CPF/CNPJ, nomes, números de nota, comprovantes ou valores reais.
7. Documentos sintéticos devem ser pequenos, inertes e permanecer em diretório descartável. Não sobrescreva arquivos existentes.
8. Testes de concorrência e duplicidade devem usar apenas registros próprios e valores rastreáveis.
9. Não manipule diretamente o banco para contornar uma validação que está sendo testada. Inserção direta só é permitida para fixtures isoladas claramente documentadas, como volume de paginação ou corrupção controlada para diagnóstico.
10. Ao final, remova somente os dados sintéticos e confirme ausência de clientes, projetos, orçamentos, parcelas, recebimentos, despesas, viagens, notas, vínculos documentais, eventos e auditorias órfãs.
11. Se um defeito impedir a limpeza, não force exclusão ampla. Registre cada resíduo com tabela, ID, valor, caminho e dependências.

## Fase 1 — Preparação e linha de base

1. Identifique Electron, frontend React/Vite, API Fastify, contratos Zod, Drizzle/SQLite, serviços de visão financeira/cache, alertas, documentos, portas, processos, diretórios e suítes aplicáveis.
2. Verifique Git, processos ativos, logs recentes e saúde da aplicação sem encerrar processos não identificados.
3. Confirme que frontend, API, banco, documentos e perfil Electron pertencem à mesma instância isolada.
4. Registre versão do aplicativo, commit, estado do worktree, sistema operacional, fuso, data/hora, viewport, zoom, tema, banco e diretório de evidências.
5. Capture a linha de base das tabelas `orcamentos`, `parcelas`, `recebimentos`, `despesas`, `despesa_documentos`, `viagens`, `notas_fiscais`, `financeiro_eventos`, `documentos`, `projetos`, `clientes`, `interacoes_cliente`, `audit_logs` e equivalentes reais.
6. Registre contagens, somas ativas, pendências, atrasos, cache, alertas iniciais, erros no console, falhas de rede e mensagens dos logs.
7. Crie `docs/auditorias/[AAAA-MM-DD]-financeiro/` para relatório, matriz, cálculos/reconciliação e evidências sanitizadas.

## Fase 2 — Inventário obrigatório

Antes de testar, produza uma matriz contendo:

- ID do item;
- rota, alias, parâmetro, aba, tela ou modal;
- controle ou fluxo;
- ação e resultado esperado;
- componente do frontend;
- endpoint, método, query, payload e resposta da API;
- tabelas, relacionamentos, eventos, auditoria e efeitos em documentos/alertas;
- cenários positivo, negativo, vazio, carregamento, lentidão, erro, concorrência e recuperação;
- situação e evidência.

Varra interface e código para localizar elementos condicionais: menu **Novo lançamento**, filtros recolhidos, período personalizado, chips de filtro, estados vazios distintos, indicadores de fonte versus filtro, tooltips, legenda, tabela acessível do gráfico, alertas derivados, links recentes, paginação, detalhe de parcela, histórico de recebimentos, impressão, comprovantes, ações permitidas conforme status, aviso de alterações não salvas, viagens encerradas, cancelamento fiscal e diagnóstico.

Inventarie, se existirem na versão auditada, pelo menos estes contratos sob `/api/financeiro`:

- `GET /overview`;
- `GET /despesas`;
- `POST /despesas`;
- `PATCH /despesas/:id`;
- `GET /despesas/:id/documentos`;
- `POST /despesas/:id/documentos`;
- `POST /despesas/:id/cancelamento`;
- `POST /despesas/:id/estorno`;
- `DELETE /despesas/:id`;
- `GET /parcelas`;
- `GET /parcelas/:orcamentoId`;
- `POST /parcelas`;
- `PATCH /parcelas/:id`;
- `GET /parcelas/:id/recebimentos`;
- `GET /comprovantes`;
- `POST /parcelas/:id/recebimentos`;
- `POST /recebimentos/:id/estorno`;
- `GET /viagens`;
- `POST /viagens`;
- `PATCH /viagens/:id`;
- `GET /notas-fiscais`;
- `POST /notas-fiscais`;
- `POST /notas-fiscais/:id/cancelamento`;
- `GET /diagnostico-vinculos`;
- `GET /resumo-mensal`;
- `GET /dre`, como alias legado;
- `GET /resumo-gerencial`;
- `GET`, `POST`, `PATCH` e `DELETE /orcamentos`, se os contratos financeiros legados ainda estiverem montados.

Registre cabeçalhos de depreciação e métricas de contrato legado. Não misture aprovação de endpoint legado com aprovação do fluxo atual de Orçamentos.

## Fase 3 — Navegação, URL e estado global

1. Abra `/financeiro` pelo menu, por URL direta e a partir de Cliente, Projeto, Alerta, Visão Geral e Orçamento sintéticos.
2. Teste as quatro abas por clique, teclado, URL, recarga, voltar e avançar.
3. Teste `tab` ausente, inválido, duplicado e codificado; confirme fallback seguro sem tela em branco ou ação invisível.
4. Valide os quatro redirecionamentos legados, preservando o destino canônico, parâmetros válidos e deep links, sem loop.
5. Teste `acao=despesa` e `acao=parcela` com e sem cliente/projeto, ID válido, incompatível, inexistente e UUID inválido. A ação deve ser consumida sem reabrir indefinidamente após salvar, cancelar, recarregar ou navegar.
6. Teste `parcela=[ID]` e `despesa=[ID]` com registro válido, fora da página atual, inexistente, removido e de outro tipo. Confirme abertura exata, mensagem segura e limpeza intencional do parâmetro.
7. Confirme foco após mudança de rota/aba, estado ativo do menu e ausência de flash, requisição duplicada, submissão dupla, carregamento infinito ou erro no console.
8. Verifique quais filtros persistem na URL e quais são limpos ao trocar de aba. O estado visual, a URL e a requisição devem representar o mesmo escopo.

## Fase 4 — Visão geral financeira

### Período, filtros e estados

1. Teste **Este mês**, **Últimos 3 meses**, **Últimos 6 meses**, **Últimos 12 meses**, **Este ano** e **Período personalizado**.
2. Para cada período, confira datas inicial/final, inclusividade das bordas, quantidade de meses, virada de ano, mês curto, ano bissexto quando reproduzível e fuso local.
3. Teste período personalizado válido, mesma data, invertido, vazio, parcial, impossível, fora de ordem e muito amplo.
4. Teste filtros de cliente, categoria, tipo de custo e centro de custo isolados e combinados. Confira modal, aplicar, cancelar, chips, remoção individual e limpar todos.
5. Confirme persistência por recarga e voltar/avançar conforme o contrato. Parâmetro inválido não pode gerar tela vazia silenciosa nem filtro oculto.
6. Distinga e valide: carregando, erro da API, primeiro uso sem fonte, fonte existente sem resultado no filtro, dados parciais e recuperação após reconexão.
7. Verifique cache e invalidação: após cada mutação financeira, a visão ativa deve atualizar sem dado obsoleto ou necessidade indevida de recarga.

### Indicadores, gráficos e reconciliação

1. Recalcule e confira os cartões **Recebido**, **A receber**, **Despesas pagas** e **Resultado de caixa**.
2. Audite todos os demais KPIs retornados pelo backend, ainda que apareçam apenas em relatórios ou contratos: receita contratada, pendente, atrasada e pipeline; impostos estimados; receita líquida estimada; despesas lançadas, abertas e atrasadas; custos fixos, variáveis, reembolsáveis, cartório/taxas e tributários; resultados e margens; ponto de equilíbrio; ticket médio; taxa de conversão; quantidades em aberto e orçamentos sem parcelas.
3. No gráfico **Fluxo de caixa**, confira todos os meses, barras de recebido/despesas, linha do resultado mensal, zero de referência, eixos, escala, unidades, arredondamento, legenda, cores e tooltips.
4. Teste mês zerado, um único evento, todas as séries zeradas, resultado negativo, valores altos seguros, série parcial e fronteiras do período.
5. Compare gráfico visual com a tabela textual acessível e com o CSV exportado. Os três devem ter o mesmo recorte e os mesmos números.
6. Valide o CSV: nome, extensão, BOM UTF-8, separador, cabeçalhos, acentos, sinal negativo, decimal pt-BR, ordem dos meses, filtro aplicado e ausência de fórmula executável quando aberto em planilha.
7. Confira o gráfico de despesas por categoria: total, pago, aberto, quantidade, percentual, agrupamento de categoria vazia/legada e soma de 100% dentro da tolerância de arredondamento.
8. Confira rentabilidade por cliente e tabela correspondente: receita contratada, recebida, despesas pagas, resultado, margem, ordenação e limite visual dos cinco primeiros.
9. Garanta que despesa administrativa não seja atribuída a cliente indevido e que cliente/projeto removido não gere soma órfã silenciosa.
10. Confira resumo de total vencido, contas abertas, próximo vencimento e aprovados sem parcelas, incluindo zero, empate e nenhuma data futura.

### Alertas, atividades e links

1. Force recebimento atrasado, conta vencida, orçamento aprovado sem parcelas, despesa sem cliente/projeto, resultado sem custos e resultado de caixa negativo.
2. Confira gravidade, título, descrição, valor, ausência de duplicidade e link correto para Contas a receber, Contas a pagar ou Orçamentos.
3. Valide atividades financeiras recentes: tipo, título, contexto, data, status, valor, ordenação, limite e navegação para o registro exato.
4. Confirme que cancelamentos, estornos e exclusões atualizam ou removem alertas e atividades conforme a semântica, sem deixar alerta órfão.
5. Teste links para Relatórios e Orçamentos e o retorno ao mesmo contexto financeiro sem reauditar esses módulos por inteiro.

## Fase 5 — Contas a receber, parcelas e recebimentos

### Lista, busca, filtros e paginação

1. Teste abas **Pendentes** e **Recebidas**, busca por cliente e descrição do orçamento e filtros de vencimento inicial/final.
2. Teste acentos, caixa, espaços, termo parcial, inexistente, datas iguais, intervalo invertido, vencimento hoje e bordas do período.
3. Confirme status efetivo **Pendente**, **Parcialmente pago**, **Atrasado** e **Pago**, considerando saldo e data, não apenas o texto persistido.
4. Valide resumo de faturamento total, total recebido, pendente e atrasado contra API e banco.
5. Teste paginação de 25 itens, primeira/última página, página além do total e API com `page`, `limit`, `mode`, `selectedId` e limites inválidos.
6. Confira ordenação e atualização depois de criar parcela, receber, liquidar rapidamente e estornar.
7. Valide carregando, vazio global, vazio filtrado, erro, lentidão e recuperação. Erro não pode parecer ausência de contas.

### Criação e contrato da parcela

1. Abra **Nova parcela** pelo menu e por deep link contextual.
2. Confirme que somente orçamentos elegíveis aparecem e que cliente/projeto pré-preenchem ou filtram sem permitir vínculo cruzado.
3. Teste orçamento, valor, vencimento e status inicial Pendente/Pago; cancele, feche por Escape e reabra.
4. Teste valor vazio, zero, negativo, centavos, vírgula/ponto, muito alto seguro, texto, data vazia/impossível e orçamento inexistente, removido, não aprovado ou de outro cliente.
5. Tente duplicidade por mesmo orçamento, valor e vencimento, além de duas submissões rápidas e concorrentes.
6. Se a criação com status Pago for permitida, confirme que há recebimento/evento coerente e que não existe parcela marcada como paga sem trilha financeira, salvo compatibilidade explicitamente documentada.
7. Recarregue e reinicie o serviço para comprovar persistência e atualização da visão geral, orçamento, cliente/projeto e alertas.

### Detalhe, impressão e recebimento

1. Abra o detalhe pelo cartão/linha e pelo deep link. Confira cliente, orçamento, principal, saldo, caixa recebido, vencimento, pagamento, status e histórico.
2. Imprima **Demonstrativo de cobrança** para conta aberta e **Recibo** somente quando houver recebimento compatível. Confira título, aviso legal, valores, datas e ausência de alegação fiscal incorreta.
3. Registre recebimento parcial, outro parcial que conclua a parcela e um recebimento com juros, multa, desconto e taxas.
4. Verifique a fórmula do caixa e a separação entre principal liquidado e valor efetivamente recebido.
5. Teste principal zero, negativo, maior que o saldo, ajuste negativo, desconto/taxas que zerem o caixa, valor calculado adulterado, data inválida, meio de pagamento e observação longos.
6. Teste comprovante correto, sem comprovante, documento removido, de outro cliente e de outro projeto. Confirme que selecionar um documento não duplica nem move o arquivo.
7. Tente duas liquidações rápidas sobre o mesmo saldo. A transação deve impedir sobrepagamento, duplicidade ou estado intermediário.
8. Teste a liquidação rápida via `PATCH /parcelas/:id` e confirme criação de recebimento, evento, auditoria, data e idempotência prática.
9. Não permita reabrir diretamente parcela com recebimento ativo; a orientação deve exigir estorno.

### Estorno

1. Abra o estorno de um recebimento sintético, cancele a confirmação e depois confirme com motivo e data válidos.
2. Teste motivo vazio, menor que cinco caracteres, longo, data impossível, ID inexistente e segundo estorno do mesmo recebimento.
3. Confirme preservação do registro original com `estornadoEm` e motivo, evento negativo, auditoria e recálculo atômico da parcela.
4. Comprove que caixa, gráfico mensal, resumo, cliente, alertas e impressão são atualizados, inclusive quando o estorno move a parcela de Pago para Parcialmente pago ou Pendente.
5. Verifique que o histórico mostra o estorno sem contabilizá-lo como recebimento ativo.

## Fase 6 — Contas a pagar e despesas

### Lista, filtros e resumo

1. Teste busca por descrição, fornecedor, número de documento, subcategoria, observação, projeto e cliente.
2. Teste filtros de categoria, subcategoria, status, tipo de custo, centro de custo, reembolsável, período e projeto isolados e combinados.
3. Confira resumo de total previsto, pago, pendente e atrasado, incluindo vencimento hoje e data sem pagamento.
4. Teste paginação de 25 itens, ordenação, `selectedId`, modo paginado/legado, limites inválidos e atualização após mutações.
5. Confirme que cancelada, estornada e excluída permanecem rastreáveis quando apropriado, mas não entram nos totais ativos.

### Criar e editar

1. Crie despesas administrativa, de cliente, de projeto e de viagem.
2. Exercite todos os campos: cliente, projeto, viagem, descrição, fornecedor, número do documento, comprovante, valor, data, competência, pagamento, categoria, subcategoria, tipo de custo, centro de custo, reembolsável, status, forma de pagamento e observações.
3. Confirme derivação do cliente pelo projeto/viagem e rejeição de projeto, viagem ou documento pertencente a outro cliente.
4. Teste categorias auxiliares e valores históricos legados; rótulo, código normalizado e agrupamento devem permanecer coerentes.
5. Teste campo vazio, espaços, acentos, HTML/JavaScript inerte, texto longo, valor zero/negativo/extremo, vírgula/ponto, data impossível e combinações incoerentes entre status e data de pagamento.
6. Edite cada grupo de campos, salve, recarregue e confira banco, eventos, auditoria, filtros, viagem, visão geral e cliente/projeto.
7. Teste cancelar/fechar com e sem alteração, Escape, aviso de dados não salvos, tentativa de sair da rota e retorno de foco.
8. Teste submissão dupla e duas edições concorrentes. Não pode haver duplicidade nem perda silenciosa de atualização.

### Documentos, cancelamento, exclusão e estorno

1. Vincule comprovante correto e tente documento inexistente, removido, de outro cliente, de outro projeto e duplicado.
2. Confira `despesa_documentos`, referência principal, ausência de cópia física desnecessária e nenhum vínculo órfão.
3. Em despesa não paga, cancele uma vez e tente cancelar novamente; valide motivo, data, status, evento e auditoria.
4. Em outra despesa não paga, cancele a exclusão na interface e depois confirme. A exclusão deve ser lógica e preservar a jornada/auditoria previstas.
5. Tente excluir despesa paga, cancelada ou estornada; a API deve rejeitar e orientar para a operação correta.
6. Estorne uma despesa paga e tente estornar uma pendente ou já estornada.
7. Após cada ação, reconcilie listas, totais, gráfico, rentabilidade, viagem, atividades, alertas e banco.
8. Simule falha intermediária em cancelamento/estorno. Registro, `financeiro_eventos` e `audit_logs` devem ser atômicos.

## Fase 7 — Viagens, prestação e documentos fiscais

### Viagens e prestação de contas

1. Crie viagem administrativa, de cliente e de projeto. Exercite finalidade, destino, início, término, responsável, adiantamento, quilometragem e valor reembolsável.
2. Teste data final anterior à inicial, datas impossíveis, valores negativos/extremos, texto longo, projeto de outro cliente e cliente/projeto removidos.
3. Vincule despesas válidas e confira quantidade, total gasto e saldo da prestação após criar, editar, cancelar, excluir e estornar despesas.
4. Teste saldo positivo, zero e negativo; a indicação não pode depender apenas de cor.
5. Encerre uma prestação e confirme timestamp, persistência, auditoria e remoção da ação de encerramento.
6. Tente encerrar novamente e vincular nova despesa a viagem encerrada por interface e API. Compare o comportamento com a regra de negócio documentada; se não houver regra inequívoca, registre a lacuna sem inventar correção.
7. Audite os estados de API `planejada`, `em_andamento`, `prestacao_pendente`, `encerrada` e `cancelada`, mesmo que nem todos tenham controle visual.

### Documentos fiscais informados

1. Registre documento fiscal com cliente e, opcionalmente, projeto, orçamento, documento físico, número, código de verificação, emissão, valor, município e link conforme os controles/contratos existentes.
2. Teste projeto, orçamento e documento pertencentes a outro cliente; todos devem ser rejeitados no servidor.
3. Teste número vazio/longo, valor zero/negativo, data impossível, link inválido, acentos e caracteres especiais inertes.
4. Confira tabela, cliente, projeto/orçamento quando exibidos, emissão, valor, status, ordenação e persistência.
5. Cancele um documento com motivo e data; tente cancelar de novo e use ID inexistente.
6. Se substituição for aceita apenas pela API, valide vínculo `substituiNotaId`, ausência de ciclo/autorreferência e histórico; registre como backend se não houver UI.
7. Confirme em todos os estados que o GeoGestor não afirma ter emitido ou validado oficialmente a nota.

### Diagnóstico de vínculos

1. Execute o diagnóstico com base íntegra e confira todos os totais zerados esperados.
2. Em banco descartável, crie de forma controlada cada inconsistência suportada: despesa sem cliente esperado, despesa/projeto de clientes diferentes, orçamento/projeto divergentes, comprovante órfão, documento de cliente incorreto e decisão de cancelamento pendente.
3. Compare totais, registros e orientações com consultas independentes no banco.
4. Execute novamente e prove que `geradoEm` muda, mas nenhuma tabela de negócio, arquivo ou relacionamento é alterado.
5. Teste erro e lentidão da API, textos longos, chaves inesperadas e layout dos cartões.

## Fase 8 — Backend, persistência, segurança e desempenho

Para cada fluxo de leitura ou escrita:

1. Registre método, endpoint, query, payload, resposta, código HTTP e efeito esperado.
2. Teste entradas válidas, ausentes, extras, tipos errados, UUID inválido, ID inexistente, entidade removida, duplicidade e limites.
3. Confirme contratos estritos e validação no servidor. A proteção somente no frontend não é suficiente.
4. Confira timestamps, centavos, booleanos, normalização, chaves estrangeiras, soft delete, unicidade e relacionamentos.
5. Verifique atomicidade entre entidade financeira, `financeiro_eventos`, jornada do cliente e `audit_logs`.
6. Recarregue a página e reinicie o serviço para comprovar persistência de parcela, recebimento, estorno, despesa, cancelamento, viagem e nota.
7. Teste duas submissões e duas liquidações concorrentes. Quando viável, use dois clientes/processos contra o mesmo SQLite isolado e registre lock, timeout e resultado final.
8. Confirme que respostas de erro não expõem stack trace, SQL, caminho local, segredo ou conteúdo sensível.
9. Teste com conteúdo inerte tentativas de XSS, injeção, manipulação de ID e vínculo cruzado. Não execute payload destrutivo nem saia do ambiente autorizado.
10. Para links fiscais, aceite somente protocolos previstos e impeça `javascript:`, `file:` e esquemas perigosos.
11. Para CSV e impressão, teste neutralização de conteúdo iniciado por `=`, `+`, `-` e `@` quando houver risco de interpretação como fórmula.
12. Meça tempo e quantidade de requisições/consultas da visão geral, listas de 25/100 itens, filtros e diagnóstico. Procure N+1, cache obsoleto e carga desnecessária das listas legadas.
13. Compare `/overview`, `/resumo-mensal`, `/dre` e `/resumo-gerencial`; diferenças intencionais devem estar documentadas, e divergências de mesma métrica devem ser classificadas como defeito.
14. Verifique cabeçalhos de depreciação, consumidores e métricas antes de sugerir remoção de contrato legado.

## Fase 9 — Usabilidade, acessibilidade e consistência visual

1. Percorra todo o módulo somente com teclado: Tab, Shift+Tab, Enter, Espaço, setas, Home, End e Escape.
2. Confirme foco visível, ordem lógica, contenção e retorno de foco dos modais, foco no primeiro erro e foco após mudança de rota/aba.
3. Verifique semântica de abas, títulos, landmarks, tabelas, botões, links, labels, descrições, erros associados e `aria-live` para atualizações financeiras importantes.
4. Botões apenas com ícone precisam de `aria-label`; ícones decorativos devem ser ignorados.
5. Gráficos precisam de alternativa textual acessível e não podem depender apenas de cor. Valores negativos, atrasos e saldos devem ter texto ou semântica adicional.
6. Teste tema claro e escuro, larguras aproximadas de 360, 768, 1024 e 1440 px, zoom de 200%, redução de movimento, textos longos e ausência de rolagem horizontal acidental.
7. Verifique tabelas largas, menu de novo lançamento, filtros, tooltips, legendas, modais, impressão, truncamento, contraste, alvos de toque e estados hover/active/focus/disabled.
8. Confira português, uso de `…`, formatos pt-BR via `Intl`, moeda BRL, datas, percentuais e números tabulares.
9. Sinalize os antipadrões do `AGENTS.md`: `transition: all`, `outline-none` sem reposição, `div/span` clicável, campo sem label, botão-ícone sem nome, data/número fixos e `autoFocus` injustificado.
10. Faça varredura automatizada WCAG 2.2 A/AA nas quatro abas e nos principais modais, complementada por inspeção manual e árvore de acessibilidade. Leitor de tela real deve ser marcado como bloqueado se não for operado.

## Fase 10 — Correção e regressão

1. Antes de corrigir, reproduza o defeito e determine a causa raiz.
2. Adicione ou atualize teste automatizado que falhe antes da correção sempre que tecnicamente razoável.
3. Faça a menor alteração coerente em frontend, backend, contrato, cálculo, banco ou arquivo.
4. Não silencie erros, não enfraqueça validações, não arredonde para esconder divergências e não introduza dados especiais só para o teste passar.
5. Rode testes focados, lint e typecheck; depois execute regressão de API, web, Electron, build e smoke empacotado conforme o risco.
6. Repita manualmente a jornada corrigida e reconcilie novamente UI, API, banco, eventos, alertas e auditoria.
7. Se a correção exigir decisão contábil, fiscal, UX de produto ou arquitetura ampla, documente a proposta e aguarde aprovação.

## Critério de encerramento

Não encerre enquanto houver item do inventário sem situação. Para concluir:

- todas as rotas, aliases, abas, parâmetros, deep links, controles, ações condicionais e contratos foram exercitados ou têm bloqueio reproduzível;
- o oráculo financeiro reconcilia visão geral, listas, gráficos, CSV, impressão, API e banco;
- contas a receber foram comprovadas do orçamento à parcela, recebimento e estorno;
- contas a pagar foram comprovadas da criação à edição, documento, cancelamento, exclusão permitida e estorno;
- viagens, prestação, documentos fiscais informados e diagnóstico foram exercitados;
- cache, alertas, eventos, jornada e auditoria atualizam após cada mutação;
- correções foram retestadas automaticamente e na interface real;
- nenhum erro novo relevante aparece no console, rede, API ou logs;
- dados e arquivos sintéticos foram removidos e a limpeza foi comprovada;
- o diff foi revisado e não contém alterações alheias atribuídas à sessão;
- o relatório declara exatamente tudo o que ficou bloqueado ou não aplicável.

## Classificação dos achados

- **P0** — perda/corrupção financeira, dupla contabilização material, exclusão indevida de histórico, vínculo cruzado grave, falha grave de segurança ou aplicativo inutilizável.
- **P1** — recebimento, saldo, despesa, caixa, margem, vencimento ou estorno materialmente incorreto; fluxo principal quebrado; operação não atômica; ou bloqueio sério de acessibilidade.
- **P2** — função secundária incorreta, validação ausente, filtro/paginação divergente, cache desatualizado, inconsistência relevante ou UX bastante prejudicada.
- **P3** — problema visual/textual menor ou melhoria recomendada.

## Entregáveis obrigatórios

1. `RELATORIO.md` com resumo executivo e status real.
2. `MATRIZ-DE-COBERTURA.md` com todos os itens e situações.
3. `ACHADOS.md` com ID, gravidade, camada, rota, pré-condição, passos, esperado, obtido, evidência, causa raiz, arquivos/endpoints, correção e reteste.
4. `RECONCILIACAO-FINANCEIRA.md` com fixtures, fórmulas independentes, totais por período/cliente/categoria, comparação entre UI/API/banco e explicação de cada diferença legítima.
5. Evidências: capturas, CSV sanitizado, impressões/PDF quando aplicável, logs mínimos, requisições/respostas, eventos e consultas, sem dados sensíveis.
6. Relação de arquivos de código alterados e motivo.
7. Comandos executados e resultados exatos.
8. Contagem final de aprovados, aprovados após correção, reprovados, bloqueados e não aplicáveis.
9. Riscos residuais e itens que a Sessão 08 deve retestar.
10. Lista separada de melhorias não implementadas, priorizadas por benefício, esforço e risco.
11. Confirmação da limpeza ou inventário exato dos resíduos com IDs, tabelas, valores e caminhos.

## Formato da resposta final

Comece pelo resultado real, não pelo processo. Informe:

- status da sessão: **APROVADA**, **APROVADA COM RESSALVAS** ou **REPROVADA**;
- cobertura obtida em números;
- defeitos encontrados por gravidade e quantos foram corrigidos;
- pendências, bloqueios e itens não aplicáveis;
- valores reconciliados de receita contratada, recebida, pendente e atrasada; despesas lançadas, pagas e atrasadas; resultado de caixa; parcelas e saldos;
- testes executados e resultados exatos;
- confirmação de persistência, atomicidade, eventos, auditoria e limpeza;
- links para relatório, matriz, achados, reconciliação e evidências;
- recomendação objetiva sobre iniciar ou não a **Sessão 08 — Agenda — Calendário**.

Não use frases vagas como “parece funcionar”, “em geral está bom” ou “a maioria foi testada”. Use fatos, números, IDs, datas, fórmulas e evidências.
