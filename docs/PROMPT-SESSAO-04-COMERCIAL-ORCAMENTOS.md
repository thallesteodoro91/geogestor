# Prompt de auditoria — Sessão 04: Comercial — Orçamentos

Você atuará como engenheiro sênior de QA full stack, especialista em aplicações desktop, propostas comerciais, cálculos financeiros, UX, acessibilidade, integridade de dados e segurança. Sua tarefa é **AUDITAR, CORRIGIR E RETESTAR** somente a Sessão 04 do GeoGestor até obter evidências suficientes sobre tudo o que pertence ao escopo.

## Configuração da sessão

- Sessão atual: **04 — Comercial — Orçamentos**.
- Módulo/menu: **Comercial > Orçamentos**.
- Rotas principais: **`/orcamentos`**, **`/orcamentos/novo`** e **`/orcamentos/:id/editar`**.
- Estados navegáveis da listagem: parâmetros `budgetId`, `highlightId`, `page`, `query`, `status`, `clientId`, `projectId`, `property`, `municipality`, `serviceType`, `technicalLead`, `issueFrom`, `issueTo`, `validFrom`, `validTo`, `minValueCents`, `maxValueCents`, `propertyType` e `linkedProject`.
- Integrações permitidas: acessar detalhes de Cliente, CRM/Oportunidade, Projeto, Financeiro, Visão Geral e Relatórios somente para provar efeitos iniciados por um orçamento. Não auditar integralmente esses módulos.
- Foco especial: listagem, busca, filtros, paginação, indicadores, análise comercial, editor completo, cálculos, itens, custos, impostos, perfis tributários, parâmetros de precificação, pagamento, modelos, PDF, estados, visualização, duplicação, aprovação, cancelamento, rejeição, expiração, revisão, versionamento, exclusão permitida, projetos e contas a receber gerados.
- Relatórios anteriores obrigatórios:
  - `docs/auditorias/2026-09-07-visao-geral/RELATORIO.md`
  - `docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md`
  - `docs/auditorias/2026-09-08-comercial-crm-funil/RELATORIO.md`
- Implementar correções comprovadas: **SIM**.
- Implementar novas funcionalidades ou mudanças de produto: **NÃO, sem aprovação expressa**.
- Diretório dos entregáveis: `docs/auditorias/[AAAA-MM-DD]-comercial-orcamentos/`.

## Objetivo

Validar de ponta a ponta cada tela, seção, cartão, indicador, tabela, filtro, campo, seletor, item, custo, imposto, parcela, modal, menu, botão, link, PDF e ação disponível no módulo de Orçamentos. Não aprove uma função porque o código parece correto ou porque a API respondeu HTTP 200. Comprove o resultado na interface real, no contrato da API, no banco e, quando aplicável, no PDF, na trilha de auditoria, no projeto e nas contas a receber resultantes.

Recalcule os valores de forma independente, usando valores conhecidos em centavos. Corrija somente defeitos reproduzidos e pertencentes ao escopo. Após cada correção, execute teste automatizado focado, reteste manual integrado e regressão proporcional ao risco.

## Dados mínimos obrigatórios

Crie tudo somente em banco e diretórios descartáveis, com prefixo único `QA-AUDIT-S04-[DATA-HORA]-`:

1. Um cliente sintético com CPF ou CNPJ válido para o fluxo normal.
2. Um segundo cliente sintético para testar isolamento de vínculos e rejeição de projeto pertencente a outro cliente.
3. Uma propriedade rural e uma urbana, vinculadas ao cliente principal, com município, UF, área e matrícula conhecidos.
4. Um projeto existente do cliente principal e outro projeto pertencente ao segundo cliente.
5. Uma oportunidade sintética vinculável ao orçamento, apenas para comprovar a integração imediata com o CRM.
6. Um rascunho mínimo válido e outro rascunho completo.
7. No rascunho completo, itens conhecidos que cubram `servico`, `despesa` e `taxa_repassada`, além de um item opcional.
8. Itens com quantidade inteira e decimal, preço e custo unitários, desconto fixo, desconto percentual, acréscimo fixo e acréscimo percentual.
9. Custos classificados como `custo_proprio`, `despesa_reembolsavel` e `taxa_repassada`, incluindo casos tributável e não tributável.
10. Impostos conhecidos que cubram bases `tributavel`, `servicos`, `taxas` e `total`, imposto incluso, imposto por fora, cumulativo e ajuste manual justificado.
11. Uma condição à vista e outra parcelada, com percentuais ou valores conhecidos e arredondamento residual na última parcela.
12. Um modelo de itens, um perfil tributário e um parâmetro de precificação sintéticos.
13. Orçamentos que percorram, quando permitido, `rascunho`, `emitido`, `enviado`, `em_negociacao`, `aprovado`, `rejeitado`, `expirado`, `cancelado` e `substituido`.
14. Um orçamento aprovado mediante vínculo a projeto existente e outro mediante criação de projeto novo, se ambos puderem ser exercitados sem contaminar o mesmo cenário.
15. Uma revisão formal de orçamento aprovado, com valor maior ou igual ao já recebido; inclua o cenário de bloqueio quando a revisão for inferior ao recebido, usando somente dados sintéticos.
16. PDFs de rascunho e de orçamento emitido para validar marca-d’água, conteúdo, paginação e nome do arquivo.
17. Estados de zero dados, dados parciais, texto longo, acentos, espaços nas bordas, datas-limite e valores monetários extremos ainda seguros.

Defina antes da execução uma planilha ou tabela de resultados esperados, incluindo totais por item, subtotais, impostos, honorários, custos, lucro, margem, markup e parcelas. Não derive o valor esperado usando a mesma função de produção que está sendo testada.

## Regras de escopo e conduta

1. Leia integralmente todos os `AGENTS.md` aplicáveis e siga as Web Interface Guidelines do projeto.
2. Leia integralmente os três relatórios anteriores. Reteste somente integrações ou riscos que afetem diretamente Orçamentos.
3. Trabalhe somente nesta sessão. Abra outros módulos apenas para verificar consequências criadas pelo orçamento e registre o motivo.
4. Não pare após planejar ou ler o código. Use a aplicação real e confronte interface, rede, API, banco, PDF e logs.
5. Todo item inventariado deve terminar como `APROVADO`, `APROVADO APÓS CORREÇÃO`, `REPROVADO`, `BLOQUEADO` ou `NÃO APLICÁVEL`, com evidência.
6. Preserve alterações preexistentes. Registre o estado inicial do Git e não reverta trabalho de terceiros.
7. Corrija a causa raiz com a menor alteração coerente. Não redesenhe o produto nem crie recursos novos.
8. Melhorias não corretivas devem ser separadas por benefício, esforço e risco e não podem ser implementadas sem aprovação.
9. Mocks podem apoiar testes unitários, mas a comprovação final deve usar frontend, API e SQLite integrados sempre que o ambiente permitir.
10. Envie atualizações curtas ao concluir inventário, cálculos, ciclo de status, backend, correções e reteste.

## Segurança dos dados de teste

1. Identifique o banco e os diretórios realmente usados pelo processo em execução. Não presuma que o banco empacotado ou o banco de desenvolvimento é o ativo.
2. Detecte dados reais antes de mutar. Use preferencialmente banco, perfil, diretório de dados e arquivos temporários isolados.
3. Antes de qualquer mutação, produza backup ou snapshot verificável e registre caminho, tamanho, data e SHA-256 quando aplicável.
4. Nunca edite ou exclua registros preexistentes. Transições, cancelamentos, revisões, pagamentos, estornos e exclusões devem usar somente registros desta sessão.
5. Antes de excluir ou cancelar, confira na interface e no banco o ID, código, versão, cliente e prefixo exatos.
6. Não aprove orçamento real nem gere projeto, parcela, despesa, viagem, nota fiscal ou evento financeiro em dados do usuário.
7. Ao final, remova apenas os dados sintéticos e confirme a ausência de itens, custos, impostos, parcelas, recebimentos, vínculos, versões, históricos, auditorias e arquivos órfãos.
8. Se a limpeza for bloqueada, não use exclusão ampla. Registre cada resíduo com tabela, ID, caminho e dependências.

## Fase 1 — Preparação e linha de base

1. Identifique Electron, frontend React/Vite, API Fastify, Drizzle/SQLite, portas, processos, comandos e suítes aplicáveis.
2. Verifique Git, processos ativos, logs recentes e saúde da aplicação sem encerrar processos não identificados.
3. Confirme que frontend, API e banco pertencem à mesma instância isolada.
4. Registre versão do aplicativo, commit, estado do worktree, sistema operacional, viewport, zoom, tema, banco e diretório de downloads.
5. Capture a linha de base das tabelas `orcamentos`, `orcamento_itens`, `orcamento_despesas`, `orcamento_impostos`, `orcamento_condicoes_pagamento`, `orcamento_status_historico`, `orcamento_versoes`, `orcamento_modelos`, `orcamento_projetos`, `perfis_tributarios`, `tributos`, `parametros_precificacao`, `parcelas`, `recebimentos`, `projetos`, `oportunidades` e `audit_logs` ou equivalentes.
6. Registre contagens e indicadores iniciais, erros no console, falhas de rede e mensagens dos logs.
7. Crie `docs/auditorias/[AAAA-MM-DD]-comercial-orcamentos/` para relatório, matriz e evidências sanitizadas.

## Fase 2 — Inventário obrigatório

Antes de testar, crie uma matriz com:

- ID do item;
- rota, parâmetro, tela, seção ou modal;
- controle ou fluxo;
- ação e resultado esperado;
- componente do frontend;
- endpoint e método;
- tabelas, relacionamentos e efeito em arquivos;
- cenários positivo, negativo, vazio, carregamento, lentidão, erro e recuperação;
- situação e evidência.

Varra a interface e o código para localizar elementos condicionais: ações exclusivas por status, detalhes via `budgetId`, destaque via `highlightId`, filtros avançados, chips, paginação, estados terminais, modais de motivo, confirmação de aprovação, confirmação do PDF de rascunho, ações de linha, modelos, perfis, parâmetros, alertas de margem e conteúdo que só aparece após aprovação ou revisão.

## Fase 3 — Listagem, filtros e indicadores

### Navegação e estado

1. Abra `/orcamentos` pelo menu, por URL direta e por retorno de Cliente, CRM ou Projeto.
2. Abra `/orcamentos/novo` e `/orcamentos/:id/editar` diretamente; teste ID inexistente, UUID inválido, rascunho, não rascunho e orçamento removido.
3. Abra e feche detalhes por `budgetId`; valide histórico, voltar/avançar, recarga, deep link, retorno de foco e remoção correta do parâmetro.
4. Valide `highlightId` após criar, editar e duplicar, inclusive quando o registro estiver fora dos filtros atuais.
5. Teste perda de conexão, resposta lenta, HTTP 500 e recuperação sem recarregamento indevido.

### Busca, filtros e paginação

1. Teste busca por número, cliente, imóvel e descrição, com maiúsculas/minúsculas, acentos, espaços e termo inexistente.
2. Teste isoladamente e em combinação: cliente, tipo de serviço, município, imóvel, responsável técnico, rural/urbano, com/sem projeto, emissão inicial/final, validade inicial/final, valor mínimo/máximo e status.
3. Teste intervalos nas bordas, datas invertidas, mínimo maior que máximo, zero e valores decimais.
4. Confirme que filtros aparecem na URL, sobrevivem a recarga e voltar/avançar e retornam à página 1 quando alterados.
5. Remova cada chip individualmente e use “Limpar filtros”. Confirme URL, contagem, indicadores e tabela.
6. Teste todos os estados e o contador de cada aba: Rascunho, Emitido, Enviado, Em negociação, Aprovado, Rejeitado, Expirado, Cancelado e Substituído.
7. Teste paginação com mais de 25 registros sintéticos quando viável, sem alterar dados reais. Valide limites, última página, página vazia e estabilidade após mutação.

### Tabela e análise comercial

1. Confira número/versão, cliente/imóvel, serviço/projeto, emissão/validade, status, visualização, valor, margem e ações.
2. Teste textos longos, truncamento acessível, rolagem horizontal contida, cabeçalho e colunas fixas.
3. Valide estados carregando, vazio global, vazio filtrado, parcial e erro.
4. Recalcule e confronte os indicadores filtrados:
   - Valor aprovado;
   - Recebido;
   - A receber;
   - Taxa de conversão;
   - Total orçado;
   - Honorários líquidos;
   - Impostos previstos;
   - Ticket médio aprovado;
   - Total de orçamentos;
   - Visualizados;
   - Conversão por tipo de serviço.
5. Confirme as regras: versões substituídas não entram no valor aprovado; recebido representa liquidação; a receber representa saldo aberto; conversão usa aprovados sobre aprovados, rejeitados e expirados elegíveis.
6. Confirme que filtros afetam lista e indicadores no mesmo escopo e que mutações invalidam ambas as consultas imediatamente.

## Fase 4 — Editor completo

Teste abrir, recolher, navegar por teclado, acompanhar progresso e validar/focar erros em todas as 12 seções:

1. **Cabeçalho:** título, emissão, validade, responsável técnico, origem e prazo previsto.
2. **Cliente e imóvel:** cliente obrigatório, imóvel cadastrado ou manual, projeto existente e cadastro rápido PF/PJ.
3. **Caracterização:** serviço, rural/urbano, imóvel, município, UF, área, vértices, confrontantes, distância, complexidade, método, pontos de apoio físicos, estação base eletrônica GNSS, equipamentos, metodologia, entregáveis e logística.
4. **Itens:** modelo, adicionar, editar, duplicar, reordenar, remover e expandir a precificação.
5. **Custos internos:** categorias, descrição, valor, classificação, tributação, salvar parâmetro e remover.
6. **Impostos:** perfil, nome, sigla, alíquota, base, incluso/por fora, cumulativo, ajuste manual, justificativa, adicionar e remover.
7. **Honorários e margem:** desconto e acréscimo globais, honorários brutos/líquidos, impostos, custos, lucro, margem e alertas.
8. **Pagamento:** forma, meio visível, conta financeira interna, descrição, juros, multa, desconto por antecipação e parcelas.
9. **Resumo financeiro:** serviços, despesas cobradas, taxas, base tributável, impostos, reembolsáveis e total.
10. **Observações:** internas e visíveis ao cliente; confirme que não se confundem.
11. **Documento final:** termos e condições e conteúdo destinado ao cliente.
12. **Resumo lateral/compacto:** cliente, serviço, imóvel, prazo, validade, total e estado de completude de cada seção.

Para todos os campos, teste vazio, obrigatório, mínimo/máximo, negativos, zero, excesso, decimal com ponto e vírgula, caracteres especiais, acentos, espaços nas bordas, texto longo, paste, preenchimento automático e valor semanticamente incompatível. Confirme validação no frontend e no servidor.

Teste cancelar e fechar com e sem alterações, Escape, botão voltar, navegação para outra rota, aviso de descarte, salvar em andamento, dupla submissão e recuperação após falha. Após salvar, recarregue e reinicie o serviço quando relevante para provar persistência.

### Itens, modelos e parâmetros

1. Para cada item, teste código, grupo, etapa, categoria, descrição, unidade, quantidade, custo unitário, preço unitário, desconto, acréscimo, componente financeiro, opcional, tributável, obrigatório, notas e ordem quando disponíveis.
2. Confirme que item opcional aparece no documento mas não entra no investimento total, custo, impostos ou margem.
3. Confirme que duplicação cria ID distinto e que reordenação persiste no banco e no PDF.
4. Salve e reaplique um modelo; confirme conteúdo e ausência de compartilhamento acidental de IDs.
5. Crie/atualize parâmetro de precificação com chave única; valide conflito, normalização, valor em centavos e decimal.
6. Verifique se desativação/alteração de modelo ou perfil já usado não modifica retroativamente orçamento emitido.

## Fase 5 — Cálculos financeiros independentes

Recalcule fora do código de produção e compare cada valor na prévia, payload, banco, detalhes e PDF:

1. Subtotal do item = quantidade × preço unitário, com arredondamento em centavos.
2. Total do item = subtotal − desconto + acréscimo.
3. Custos estimados dos itens = quantidade × custo unitário.
4. Subtotais separados de serviços, despesas cobradas e taxas repassadas.
5. Desconto e acréscimo globais, fixos e percentuais, rateados corretamente na base tributável e nos serviços.
6. Custos próprios, despesas reembolsáveis e taxas repassadas sem dupla contagem.
7. Base tributável para itens e custos aplicáveis, respeitando valores opcionais e não tributáveis.
8. Imposto incluso pela fórmula `base × alíquota / (100 + alíquota)` e imposto por fora por `base × alíquota / 100`, com arredondamento em centavos.
9. Imposto cumulativo alterando somente a base cumulativa subsequente conforme a ordem.
10. Ajuste manual positivo e negativo, bloqueio sem justificativa e piso de imposto em zero.
11. Total = faturável ajustado + impostos por fora.
12. Honorários brutos, honorários líquidos, receita considerada, custo estimado, lucro, margem e markup.
13. Alertas de total não positivo, margem negativa, preço abaixo do custo e base tributável sem imposto.
14. Percentuais de 0%, 100%, casas decimais e limites acima de 100% onde forem proibidos.
15. Valores próximos ao limite seguro de inteiro, overflow e rejeição uniforme no frontend e backend.

Teste as unidades disponíveis, incluindo serviço, hora técnica, diária, hectare, metro, quilômetro, vértice, marco, ponto, confrontante, prancha, documento, deslocamento, hospedagem e unidade personalizada.

## Fase 6 — Pagamento, emissão e ciclo de status

### Condições e parcelas

1. Teste à vista, entrada + saldo, etapas e parcelas.
2. Teste uma a 60 parcelas pela interface e os limites do contrato do domínio.
3. Valide distribuição igual, valor explícito, percentual, vencimento explícito e dias após aprovação.
4. Confirme que a última parcela absorve exatamente o resíduo de arredondamento e que a soma é igual ao total financiável.
5. Rejeite soma diferente do total, parcela negativa, sem valor/percentual, data inválida e quantidade fora do limite.
6. Confirme que juros, multa e desconto por antecipação persistem em pontos-base e não alteram indevidamente o total contratado.

### Estados e transições

1. Teste somente as transições permitidas pelo contrato:
   - Rascunho → Emitido ou Cancelado;
   - Emitido → Enviado, Em negociação, Aprovado, Rejeitado, Expirado ou Cancelado;
   - Enviado → Em negociação, Aprovado, Rejeitado, Expirado ou Cancelado;
   - Em negociação → Enviado, Aprovado, Rejeitado, Expirado ou Cancelado;
   - Aprovado → Cancelado ou Substituído apenas pelo fluxo previsto;
   - Rejeitado, Expirado, Cancelado e Substituído como estados terminais.
2. Tente transições proibidas pela UI e diretamente pela API.
3. Exija motivo não vazio para rejeição e cancelamento; teste cancelar o modal sem efeito.
4. Emita somente orçamento válido. Confirme código sequencial, data, validade padrão quando aplicável, snapshot imutável de cliente/imóvel, histórico, versão e auditoria.
5. Marque como enviado, em negociação e visualizado; confirme timestamps idempotentes e indicadores.
6. Teste expiração automática na borda da validade, considerando fuso horário e sem expirar aprovados ou estados terminais.
7. Confirme que apenas rascunho pode ser excluído e que a exclusão é lógica. Tente excluir emitido e aprovado pela API.
8. Duplique rascunho e orçamento terminal; confirme novo grupo/versão inicial, estado Rascunho, IDs novos e nenhum efeito financeiro herdado.

## Fase 7 — Aprovação, revisão e integrações imediatas

### Aprovação

1. Abra a confirmação e valide cliente, total, honorários líquidos, impostos, parcelas e conta financeira.
2. Aprove vinculando projeto existente do mesmo cliente.
3. Aprove criando projeto novo com nome válido.
4. Tente vincular projeto inexistente e projeto de outro cliente; a API deve rejeitar sem efeito parcial.
5. Confirme atomicamente:
   - status Aprovado e data de aprovação;
   - vínculo em `orcamento_projetos` e no orçamento;
   - criação ou atualização correta do projeto;
   - criação das parcelas previstas;
   - nenhum recebimento, receita realizada ou entrada de caixa antes da liquidação;
   - histórico de status, snapshot de versão e auditoria;
   - oportunidade vinculada movida para Ganho, com projeto e histórico coerentes;
   - atualização dos KPIs, Cliente, Projeto, Financeiro, Visão Geral e Relatórios imediatamente afetados.
6. Envie duas aprovações rápidas com a mesma chave de idempotência e depois com chaves diferentes. Não podem surgir projetos, parcelas, vínculos ou eventos duplicados.
7. Simule falha intermediária controlada em banco descartável e comprove rollback total.
8. Cancele orçamento aprovado e confirme cancelamento somente das parcelas futuras em aberto, preservação de recebimentos existentes, histórico e coerência dos indicadores.

### Revisão e versionamento

1. Crie revisão somente de orçamento aprovado e com motivo de ao menos três caracteres.
2. Confirme mesmo grupo, versão incremental, novo ID, estado Rascunho e cópia independente de itens, custos, impostos e pagamento.
3. Confirme que a versão anterior continua vigente até a aprovação da revisão.
4. Aprove a revisão e confirme que a anterior vira Substituída, parcelas futuras anteriores são canceladas e valores já recebidos são preservados.
5. Confirme que somente o saldo financiável da revisão gera novas parcelas e que impostos proporcionais não são duplicados.
6. Bloqueie revisão cujo total seja inferior ao recebido, sem alterar qualquer tabela.
7. Verifique número, versão, histórico e navegação entre versões nos detalhes e no PDF.

## Fase 8 — PDF e documento destinado ao cliente

1. Gere PDF pela linha da tabela e pelos detalhes.
2. Em rascunho, teste cancelar e confirmar a exportação e verifique a marca-d’água `RASCUNHO — NÃO ENVIAR` em todas as páginas.
3. Confira A4, margens, cabeçalho, logotipo e dados da empresa, número, versão, status, emissão, validade, cliente, imóvel, escopo, metodologia, entregáveis, itens, opcionais separados, totais, pagamento, observações do cliente, termos, assinaturas, rodapé e `página X de Y`.
4. Confirme que observações internas, custos internos, custo unitário, margem e lucro não aparecem no documento do cliente.
5. Valide nomes com acento e texto longo, múltiplas páginas, quebra de tabela, cabeçalho repetido e ausência de sobreposição/corte.
6. Confira nome de arquivo sanitizado, extensão `.pdf`, download único sob clique duplo e abertura por leitor real.
7. Compare visualmente o PDF com a pré-visualização e confronte todos os valores com API e banco.
8. Confirme que orçamento emitido usa snapshots históricos: alterações posteriores no cliente ou imóvel não podem modificar retroativamente o PDF/versionamento já emitido.

## Fase 9 — Backend, banco, desempenho e segurança

Inventarie e teste ao menos:

- `GET /api/orcamentos` nos modos paginado e legado;
- `GET /api/orcamentos/kpis`;
- `GET /api/orcamentos/options`;
- `GET /api/orcamentos/filter-options`;
- `POST /api/orcamentos`;
- `GET /api/orcamentos/:id`;
- `PATCH /api/orcamentos/:id`;
- `POST /api/orcamentos/:id/emit`;
- `POST /api/orcamentos/:id/transitions`;
- `POST /api/orcamentos/:id/approve`;
- `POST /api/orcamentos/:id/viewed`;
- `POST /api/orcamentos/:id/duplicate`;
- `POST /api/orcamentos/:id/revisions`;
- `DELETE /api/orcamentos/:id`;
- `POST /api/orcamentos/templates`;
- `PATCH /api/orcamentos/templates/:id`;
- `POST /api/orcamentos/tax-profiles`;
- `POST /api/orcamentos/pricing-parameters`;
- endpoints imediatamente envolvidos de clientes, oportunidades, projetos, parcelas, recebimentos, financeiro e relatórios.

Para cada endpoint, registre método, URL, parâmetros, payload sanitizado, resposta e efeito esperado. Teste válido, inválido, ausente, campo extra, UUID malformado, ID inexistente, referência cruzada, duplicidade, limites e concorrência. Confirme códigos HTTP, tipos, mensagens uniformes e ausência de stack trace ou segredo.

Verifique transações, chaves estrangeiras, unicidade de grupo/versão e chave de aprovação, timestamps, soft delete, cascatas, referências compartilhadas, snapshots JSON e trilha de auditoria. Faça consultas de contagem antes/depois para provar que falhas não deixam gravações parciais.

Teste, de forma segura, autorização/autenticação disponível, manipulação de IDs, mass assignment, SQL injection, XSS persistente/refletido em textos e termos, CSV/formula injection onde aplicável, nomes hostis no PDF, JSON excessivo e negação de serviço apenas com limites moderados. Não use payload destrutivo nem saia do ambiente autorizado.

Meça tempos perceptíveis da lista, filtros, cálculo enquanto edita, abertura de detalhes e geração de PDF com volume representativo. Procure consultas N+1, recálculos desnecessários, travamento do editor e uso excessivo de memória.

## Fase 10 — UX, responsividade e acessibilidade

1. Teste tema claro e escuro em aproximadamente 360, 768, 1024 e 1440 px, zoom de 200%, reflow, orientação estreita e textos longos.
2. Confirme ausência de rolagem horizontal da página; tabelas e navegação horizontal devem conter sua própria rolagem.
3. Percorra tudo apenas com teclado: Tab, Shift+Tab, Enter, Espaço, setas e Escape.
4. Confirme foco visível, ordem lógica, abertura/fechamento das seções, foco no primeiro erro, contenção e retorno de foco nos modais.
5. Verifique headings, landmarks, tabelas, fieldsets, legends, labels, nomes de botões por ícone, `aria-expanded`, `aria-controls`, `aria-pressed`, `aria-busy`, `aria-live` e associação dos erros.
6. Confirme que estados financeiros e de orçamento não dependem apenas de cor e que textos e gráficos/tabelas possuem contraste WCAG 2.2 AA.
7. Teste leitor de tela pela árvore de acessibilidade e, quando disponível, com leitor real. Verifique anúncio de total recalculado, validações, salvamento, geração de PDF e mudança de status.
8. Verifique alvos de toque, hover, active, disabled, loading, redução de movimento e ausência dos antipadrões do `AGENTS.md`.
9. Avalie clareza da distinção entre pontos de apoio físicos no terreno e estação base eletrônica GNSS.
10. Revise português, uso de `…`, `Intl` pt-BR, moeda, percentuais, datas e números tabulares.

## Fase 11 — Correção, reteste e regressão

1. Reproduza cada defeito e determine a causa raiz antes de editar.
2. Adicione ou atualize teste automatizado que falhe antes da correção sempre que razoável.
3. Faça a menor correção coerente, sem afrouxar validação ou criar exceção exclusiva para teste.
4. Rode testes focados de contrato, domínio, API, componentes e E2E; execute lint e typecheck relevantes.
5. Repita manualmente o fluxo real corrigido e atualize as evidências.
6. Execute regressão de listagem, editor, cálculo, PDF, transições, aprovação, revisão e exclusão.
7. Reteste as integrações imediatas com Cliente, CRM, Projeto, Financeiro, Visão Geral e Relatórios.
8. Revise o Git diff e confirme que não há alterações alheias ao escopo.
9. Se a correção exigir decisão comercial, contábil, fiscal ou arquitetural, documente a proposta e aguarde aprovação.

## Critério de encerramento

Não encerre enquanto houver item inventariado sem situação. Para concluir:

- todos os fluxos aplicáveis foram exercitados ou possuem bloqueio reproduzível;
- todos os cálculos do conjunto conhecido coincidem entre cálculo independente, UI, API, banco e PDF;
- transições, aprovação, revisão, idempotência e rollback foram comprovados;
- correções passaram em teste automatizado e na interface integrada;
- nenhum erro novo relevante aparece no console, rede ou logs;
- dados e arquivos sintéticos foram removidos, com limpeza comprovada;
- o diff foi revisado e não contém mudanças fora do escopo;
- limitações de leitor de tela, zoom, impressão ou concorrência foram declaradas com honestidade.

## Classificação dos achados

- P0 — perda/corrupção de dados, aprovação financeira duplicada, cálculo monetário materialmente errado, falha grave de segurança ou aplicativo inutilizável.
- P1 — fluxo principal quebrado, PDF comercial incorreto, transição indevida, efeito parcial, projeto/parcela duplicado ou bloqueio grave de acessibilidade.
- P2 — função secundária incorreta, filtro/KPI inconsistente, validação ausente, versionamento incompleto ou UX bastante prejudicada.
- P3 — problema visual, textual ou melhoria menor.

## Entregáveis obrigatórios

1. Relatório Markdown com resumo executivo.
2. Matriz completa de cobertura.
3. Lista de achados com ID, gravidade, camada, rota, pré-condição, passos, esperado, obtido, evidência, causa raiz, arquivos/endpoints, correção e reteste.
4. Tabela dos cálculos independentes e comparação UI/API/banco/PDF.
5. Evidências visuais de lista vazia/populada, filtros, editor, erros, detalhes, estados, aprovação, revisão e PDFs.
6. Requisições/respostas sanitizadas, logs mínimos e consultas de verificação.
7. Relação dos arquivos alterados e motivo.
8. Comandos de teste e resultados exatos.
9. Contagem final de aprovados, aprovados após correção, reprovados, bloqueados e não aplicáveis.
10. Riscos residuais e itens que a Sessão 05 deve retestar.
11. Melhorias não implementadas, priorizadas por benefício, esforço e risco.
12. Confirmação da limpeza ou inventário exato dos resíduos.

## Formato da resposta final

Comece pelo resultado real e informe:

- status: `APROVADA`, `APROVADA COM RESSALVAS` ou `REPROVADA`;
- cobertura em números;
- quantidade e gravidade dos defeitos encontrados e corrigidos;
- cálculos e efeitos financeiros comprovados;
- pendências e bloqueios;
- testes executados e resultados exatos;
- links para relatório, matriz, cálculos e evidências;
- confirmação da limpeza;
- recomendação objetiva sobre iniciar ou não a Sessão 05.

Não use “parece funcionar”, “em geral está bom” ou “a maioria foi testada”. Use fatos, IDs, números, valores e evidências.
