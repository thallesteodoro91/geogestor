# Matriz de cobertura — Sessão 05: Projetos

Legenda: **APROVADO** = comportamento comprovado; **APROVADO APÓS CORREÇÃO** = defeito reproduzido, corrigido e retestado; **BLOQUEADO** = ambiente/evidência insuficiente, com motivo; **N/A** = capacidade não existe no módulo atual.

| ID | Área | Critério auditado | Evidência principal | Situação |
|---|---|---|---|---|
| ROT-01 | Rotas | `/projetos` abre a lista canônica | E2E | APROVADO |
| ROT-02 | Rotas | `/projetos/:id` abre detalhe válido | E2E | APROVADO |
| ROT-03 | Rotas | `/operacional` redireciona para estatísticas | E2E | APROVADO |
| ROT-04 | Rotas | ID sintaticamente inválido apresenta erro recuperável | E2E | APROVADO |
| ROT-05 | Rotas | Aba inválida retorna ao checklist e normaliza URL | E2E | APROVADO |
| ROT-06 | Rotas | Voltar e breadcrumb preservam destino de projetos | inspeção + web tests | APROVADO |
| ROT-07 | Rotas | Query adversarial não dispara consultas inválidas | reprodução + E2E | APROVADO APÓS CORREÇÃO |
| LIS-01 | Lista | Estado de carregamento é explícito | inspeção + web tests | APROVADO |
| LIS-02 | Lista | Estado vazio tem orientação e ação | E2E + captura 01 | APROVADO |
| LIS-03 | Lista | Falha de API não vira vazio silencioso | E2E interceptado | APROVADO |
| LIS-04 | Lista | Botão “Tentar novamente” recupera a consulta | E2E | APROVADO |
| LIS-05 | Lista | Modo lista renderiza projeto/cliente/status/prazo | E2E | APROVADO |
| LIS-06 | Lista | Modo grade renderiza os registros | E2E | APROVADO |
| LIS-07 | Lista | Busca por nome com acento | E2E | APROVADO |
| LIS-08 | Lista | Filtros de status/tipo/cliente/período chegam à API | integração + inspeção | APROVADO |
| LIS-09 | Lista | Ordenação aceita somente chaves conhecidas | contratos/API | APROVADO APÓS CORREÇÃO |
| LIS-10 | Lista | Paginação 12/24/48 e segunda página | E2E com 15 registros | APROVADO |
| LIS-11 | Lista | Página/limite exigem inteiro positivo | integração S05 | APROVADO APÓS CORREÇÃO |
| LIS-12 | Lista | Estado importante permanece na URL | E2E | APROVADO |
| LIS-13 | Lista | Estatísticas e gráficos têm fonte real | API overview + E2E | APROVADO |
| LIS-14 | Lista | Legenda de status não colide em card estreito | captura 02 | APROVADO APÓS CORREÇÃO |
| LIS-15 | Lista | 1.000 projetos respeitam P95 local < 200 ms | teste de integração existente | APROVADO |
| STA-01 | Estatísticas | Total de 15 projetos | E2E + cálculo independente | APROVADO |
| STA-02 | Estatísticas | Produtividade 3/15 = 20% | E2E + `CALCULOS.md` | APROVADO |
| STA-03 | Estatísticas | Tempo médio (10+20+30)/3 = 20 dias | E2E + `CALCULOS.md` | APROVADO |
| STA-04 | Estatísticas | Ticket médio (100+200)/2 = R$ 150 | E2E + `CALCULOS.md` | APROVADO |
| STA-05 | Estatísticas | Distribuição 3/4/3/5 | captura 02 + API | APROVADO |
| STA-06 | Estatísticas | Textos auxiliares cumprem contraste AA | Axe | APROVADO APÓS CORREÇÃO |
| FOR-01 | Formulário | Criação válida persiste projeto | integração/API existente | APROVADO |
| FOR-02 | Formulário | Edição parcial preserva dados não enviados | integração/API | APROVADO |
| FOR-03 | Formulário | Nome e cliente são obrigatórios | contratos + UI | APROVADO |
| FOR-04 | Formulário | Cliente precisa existir e estar ativo | integração S05 | APROVADO APÓS CORREÇÃO |
| FOR-05 | Formulário | Propriedade precisa pertencer ao cliente | integração S05 | APROVADO APÓS CORREÇÃO |
| FOR-06 | Formulário | Datas impossíveis são recusadas | integração S05 | APROVADO APÓS CORREÇÃO |
| FOR-07 | Formulário | Entrega anterior ao início é recusada | integração S05 | APROVADO APÓS CORREÇÃO |
| FOR-08 | Formulário | Latitude/longitude exigem par e ranges reais | integração + web unit | APROVADO APÓS CORREÇÃO |
| FOR-09 | Formulário | Área m² converte para hectares sem perda indevida | web unit | APROVADO APÓS CORREÇÃO |
| FOR-10 | Formulário | Payload recusa chaves extras | integração S05 | APROVADO APÓS CORREÇÃO |
| FOR-11 | Formulário | Status e tipos usam enum canônico + legado suportado | contratos/API | APROVADO APÓS CORREÇÃO |
| FOR-12 | Especialização | Rural preserva matrícula/CAR/CCIR/ITR/memorial | teste especializado | APROVADO |
| FOR-13 | Especialização | Urbano/comercial/industrial preservam campos comuns | teste especializado | APROVADO |
| FOR-14 | Especialização | Ambiental preserva metadados ambientais | teste especializado | APROVADO |
| FOR-15 | Especialização | Licenciamento exige emissão e valida vencimento | web unit + contratos | APROVADO APÓS CORREÇÃO |
| FOR-16 | Especialização | Perícia aceita somente finalidade conhecida | contratos | APROVADO APÓS CORREÇÃO |
| FOR-17 | Formulário | Troca destrutiva de tipo exige confirmação/bloqueio | teste especializado existente | APROVADO |
| STAUS-01 | Status | Alteração normal de status persiste | integração/API | APROVADO |
| STAUS-02 | Status | Cancelamento abre decisão financeira pendente | integração S05 | APROVADO APÓS CORREÇÃO |
| STAUS-03 | Status | Suspensão abre decisão financeira pendente | integração S05 | APROVADO APÓS CORREÇÃO |
| STAUS-04 | Status | Projeto ativo não aceita decisão financeira | integração S05 | APROVADO APÓS CORREÇÃO |
| STAUS-05 | Status | Reativação após decisão preserva histórico | sem cenário integral desta sessão | BLOQUEADO |
| TAR-01 | Tarefas | Criar tarefa vinculada ao projeto | E2E + banco isolado | APROVADO |
| TAR-02 | Tarefas | Prioridade alta persiste | E2E + banco isolado | APROVADO |
| TAR-03 | Tarefas | Data vencida recebe sinalização “Atrasada” | E2E | APROVADO |
| TAR-04 | Tarefas | Conclusão por teclado persiste | E2E + banco isolado | APROVADO |
| TAR-05 | Tarefas | Contador do checklist é atualizado | E2E | APROVADO |
| TAR-06 | Tarefas | Reordenação manual | não há reordenação no detalhe atual | N/A |
| TAR-07 | Tarefas | Operação em massa | não há ação em massa no detalhe atual | N/A |
| ARQ-01 | Arquivos | Upload PDF com nome acentuado | E2E + banco/pasta isolados | APROVADO |
| ARQ-02 | Arquivos | Contador e listagem atualizam após upload | E2E | APROVADO |
| ARQ-03 | Arquivos | Política de nomes duplicados | não coberta sem risco nesta sessão | BLOQUEADO |
| ARQ-04 | Arquivos | Download abre o conteúdo correto | não coberto no E2E S05 | BLOQUEADO |
| ARQ-05 | Arquivos | Remoção e confirmação | não coberto no E2E S05 | BLOQUEADO |
| ARQ-06 | Arquivos | Abrir pasta no desktop | exige jornada GUI instalada | BLOQUEADO |
| ARQ-07 | Arquivos | Falha de armazenamento | não injetada nesta sessão | BLOQUEADO |
| ARQ-08 | Arquivos | Persistência após reinício | pacote bloqueado por Configuração Inicial | BLOQUEADO |
| FIN-01 | Financeiro | Orçado/contratado = R$ 100 | E2E + cálculo | APROVADO |
| FIN-02 | Financeiro | Faturado = R$ 70 | E2E + cálculo | APROVADO |
| FIN-03 | Financeiro | Recebido = R$ 30 | E2E + cálculo | APROVADO |
| FIN-04 | Financeiro | Saldo aberto = R$ 70 | E2E + cálculo | APROVADO |
| FIN-05 | Financeiro | Custo previsto = R$ 40 | E2E + cálculo | APROVADO |
| FIN-06 | Financeiro | Custo realizado exclui cancelados/estornados | reprodução + E2E | APROVADO APÓS CORREÇÃO |
| FIN-07 | Financeiro | Desvio = −R$ 15 e consumo = 62,5% | E2E + cálculo | APROVADO |
| FIN-08 | Financeiro | Cancelamento atinge somente parcela futura em aberto | integração S05 | APROVADO APÓS CORREÇÃO |
| FIN-09 | Financeiro | Parcela vencida é preservada | integração S05 | APROVADO APÓS CORREÇÃO |
| FIN-10 | Financeiro | Parcela vencendo hoje é preservada | integração S05 | APROVADO APÓS CORREÇÃO |
| FIN-11 | Financeiro | Parcela paga/parcial é preservada | integração S05 | APROVADO APÓS CORREÇÃO |
| FIN-12 | Financeiro | Percentual/valor não podem exceder contrato | integração S05 | APROVADO APÓS CORREÇÃO |
| FIN-13 | Financeiro | Payload conflitante é recusado | integração S05 | APROVADO APÓS CORREÇÃO |
| FIN-14 | Financeiro | Replay idêntico não duplica evento | integração S05 | APROVADO APÓS CORREÇÃO |
| FIN-15 | Financeiro | Timeline preserva eventos financeiros | integração/API + UI | APROVADO |
| EXC-01 | Exclusão | Projeto sem dependências retorna 204 | integração S05 | APROVADO APÓS CORREÇÃO |
| EXC-02 | Exclusão | Dependências ativas bloqueiam com 409 | integração S05 | APROVADO APÓS CORREÇÃO |
| EXC-03 | Exclusão | Resposta informa resumo das dependências | integração S05 | APROVADO APÓS CORREÇÃO |
| EXC-04 | Exclusão | Segunda exclusão retorna 404 | integração S05 | APROVADO APÓS CORREÇÃO |
| EXC-05 | Exclusão | Dependências já excluídas logicamente são ignoradas | serviço + integração | APROVADO APÓS CORREÇÃO |
| EXC-06 | Reatribuição | Prévia distingue vínculos incompatíveis | teste de integridade existente | APROVADO |
| EXC-07 | Reatribuição | Concorrência entre reatribuição e exclusão | requer teste concorrente dedicado | BLOQUEADO |
| MAS-01 | Massa | Edição em massa de projetos | recurso ausente | N/A |
| MAS-02 | Massa | Exclusão em massa de projetos | recurso ausente | N/A |
| QUA-01 | Acessibilidade | Axe WCAG 2 A/AA/2.1/2.2 na lista/vazio | E2E | APROVADO |
| QUA-02 | Acessibilidade | Axe nas estatísticas | E2E | APROVADO APÓS CORREÇÃO |
| QUA-03 | Acessibilidade | Axe no detalhe financeiro | E2E | APROVADO APÓS CORREÇÃO |
| QUA-04 | Acessibilidade | Controles nativos/rótulos/foco visível | inspeção + E2E teclado | APROVADO |
| QUA-05 | Responsividade | 360 px sem overflow horizontal | E2E + captura 03 | APROVADO |
| QUA-06 | Responsividade | Desktop 1120 px sem overflow/colisão | E2E + capturas 02/04 | APROVADO APÓS CORREÇÃO |
| QUA-07 | Acessibilidade | Leitor de tela real | ferramenta assistiva não disponível | BLOQUEADO |
| QUA-08 | Acessibilidade | Zoom do sistema a 200% | automação atual não controla zoom nativo com confiabilidade | BLOQUEADO |
| QUA-09 | Visual | Tema escuro em toda a matriz de viewports | matriz visual completa não executada | BLOQUEADO |
| QUA-10 | Segurança | UUIDs, enums, limites, payload estrito e vínculos | integração S05 | APROVADO APÓS CORREÇÃO |
| QUA-11 | Compatibilidade | Smoke da API empacotada em DB temporário | `/api/projetos` passou; bloqueio posterior externo | APROVADO |
| QUA-12 | Compatibilidade | Jornada instalada completa | bloqueada pelo log ausente da Configuração Inicial | BLOQUEADO |

## Totais

Os totais desta matriz são calculados pela situação da última coluna e reproduzidos no relatório principal.
