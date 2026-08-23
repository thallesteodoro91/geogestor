# Polimento técnico e consolidação de qualidade — 2026-08-11

> **REGISTRO HISTÓRICO SUPERADO EM 2026-08-13:** este documento preserva o estado observado em 11/08. A fonte técnica canônica atual é o `package.json` da raiz, hoje em `1.0.0` e apresentada comercialmente como GeoGestor 1.0; evidências históricas abaixo não autorizam build ou publicação.

## Resumo executivo

Esta etapa corrigiu as causas comprovadas das pendências E2E, preservou o título `Financeiro` e todas as suas áreas internas — inclusive `Visão geral` —, melhorou a acessibilidade de regiões roláveis e acrescentou um destaque discreto ao deep link de tarefas. Nenhum menu foi unificado ou reorganizado.

A linha final ficou em 87/87 testes do frontend, 107/107 da API, 15/15 do Electron e 45/45 E2E. Antes desta etapa, o E2E havia terminado com 11 aprovações, 6 falhas e 25 cenários não executados. Nenhum teste foi removido para obter aprovação.

O pacote descompactado existente passou no smoke da API com banco temporário criptografado, mas o instalador não passou no gate de integridade: tamanho e SHA-256 do `GeoGestor Setup 1.1.3.exe` divergem do manifesto. Ele não deve ser publicado como candidato final.

## Diagnóstico inicial e itens preservados

- O relatório `AUDITORIA-ROTAS-E-RESIDUOS-2026-08-11.md` foi usado como linha de base.
- O worktree já continha a limpeza anterior e uma alteração preexistente em `financeConsolidation.test.ts`; tudo foi preservado.
- Não foram refeitas exclusões da auditoria anterior.
- Bancos, backups, migrações oficiais, `data`, `scratch` e `temp-lovable` não foram removidos ou modificados por limpeza.
- Endpoints, aliases, contratos e campos depreciados foram mantidos.
- Não houve commit, branch, push ou pull request.
- Durante a análise, `package.json`, `apps/desktop/package.json` e a versão mínima da Ajuda passaram de `1.1.3` para `1.0.0`. O responsável pelo produto confirmou que essa é a nomenclatura intencional da versão atual; portanto, ela foi preservada.
- Durante a validação final, também surgiram alterações externas de logotipo da aplicação em `Sidebar.tsx`, `Configuracoes.tsx` e `companyTemplate.ts`. Elas foram preservadas, não foram atribuídas a esta etapa e passaram novamente pela tipagem, pelos 87 testes do frontend e pelo E2E completo.

## Correções realizadas

### Isolamento e cobertura E2E

- A primeira configuração passou a ter projeto Playwright próprio (`configuracao-inicial`).
- O restante da aplicação depende explicitamente dessa preparação, sempre em banco temporário exclusivo.
- Suítes sem dependência real deixaram de ser seriais; jornadas que compartilham dados continuam seriais.
- Expectativas antigas de `Gestão financeira 360` foram atualizadas somente nos testes para `Financeiro`.
- A Central de Ajuda agora é aguardada por URL/título e os artigos são localizados por nome acessível específico.
- O seletor de período dos relatórios é testado como popover: rótulo atual, `aria-expanded`, opção selecionada, datas e URL.
- Os seletores de clientes passaram a usar o nome acessível estável, sem depender de um placeholder com codificação antiga.
- O teste do gráfico financeiro foi alinhado ao modo compacto real: barras com valores exatos; o treemap ampliado continua coberto pelo teste unitário.
- O runner da API limita a concorrência a quatro arquivos, evitando encerramento de workers por saturação da máquina.

### Acessibilidade e responsividade

- Históricos roláveis de backup e manutenção receberam região nomeada, foco por teclado e foco visível.
- A tabela mensal de relatórios recebeu uma região horizontal nomeada e alcançável por teclado.
- O contraste das abas de relatórios no tema claro foi corrigido sem alterar a identidade do tema escuro.
- A largura das abas e do conteúdo de relatórios foi contida no viewport móvel.
- O teste de altura dos filtros deixou de tratar os botões internos do campo numérico como controles primários independentes.
- A auditoria Axe revelou contrastes insuficientes no tema escuro de Cadastros: placeholder, filtro de situação, botão secundário e seletor personalizado. Foram reforçados os textos e usado fundo opaco somente no seletor escuro, eliminando a variação causada por superfícies translúcidas.

### Links de alertas

Os deep links de parcela, despesa, condicionante e oportunidade já selecionavam a área correta, abriam o registro, preservavam parâmetros persistentes e tratavam ausência com mensagem não intrusiva. Não foi adicionada uma segunda animação sobre esses modais.

O deep link de tarefa passou a:

- localizar a tarefa solicitada;
- rolar até o cartão, quando necessário;
- aplicar destaque temporário discreto;
- respeitar `prefers-reduced-motion`;
- remover somente `tarefaId`, preservando os demais parâmetros;
- avisar sem bloquear quando o registro não existe.

## Arquivos modificados nesta etapa

Principais arquivos desta etapa, além dos arquivos já alterados pela auditoria anterior:

- `playwright.config.ts`;
- `scripts/run-api-tests.mjs`;
- `tests/e2e/setup-initial.spec.ts`;
- `tests/e2e/commercial-critical.spec.ts`;
- `tests/e2e/cadastros-properties.spec.ts`;
- `tests/e2e/header-standardization.spec.ts`;
- `tests/e2e/help-center.spec.ts`;
- `tests/e2e/layout-persistence.spec.ts`;
- `tests/e2e/reports-managerial.spec.ts`;
- `tests/e2e/settings-audit.spec.ts`;
- `apps/web/src/components/BackupPolicyPanel.tsx`;
- `apps/web/src/index.css`;
- `apps/web/src/pages/Configuracoes.tsx`;
- `apps/web/src/pages/Cadastros.tsx`;
- `apps/web/src/pages/Relatorios/ReportTabs.tsx`;
- `apps/web/src/pages/Relatorios/Relatorios.tsx`;
- `apps/web/src/pages/Tarefas/Tarefas.tsx`;
- `apps/web/src/utils/filterStyles.ts`.

As mudanças de logotipo em `Sidebar.tsx`, `Configuracoes.tsx` e `companyTemplate.ts` pertencem ao trabalho paralelo observado durante a execução; a única alteração desta etapa em `Configuracoes.tsx` foi a acessibilidade das regiões roláveis.

## Matriz de compatibilidade e depreciação

“Versão mínima” indica a menor versão comprovada pelas evidências disponíveis, não uma promessa de retirada. Quando o histórico não pôde ser comprovado, a data permanece indefinida.

| Recurso antigo | Substituto canônico | Consumidores/testes atuais | Risco | Compatibilidade mínima comprovada | Condição para retirada |
| --- | --- | --- | --- | --- | --- |
| `/api/financeiro/orcamentos` | `/api/orcamentos` | sem consumidor de produção; `full-spreadsheet-import`, `financeiro-reports` e contrato paginado | alto | presente no código auditado e no pacote 1.1.3 | telemetria/varredura sem consumidores, migração dos testes legados e janela anunciada; sem data definida |
| `/faturas` | `/financeiro?tab=faturas` | favoritos/alertas persistidos; E2E e `financeConsolidation` | alto | presente no pacote 1.1.3 | confirmar ausência de links persistidos em versões suportadas; sem data definida |
| `/despesas` | `/financeiro?tab=pagar` | favoritos/alertas persistidos; teste de aliases | alto | presente no pacote 1.1.3 | mesma condição dos alertas financeiros; sem data definida |
| `/gestao-financeira` | `/financeiro?tab=auxiliares` | favoritos antigos; teste de aliases | médio | presente no pacote 1.1.3 | inventário de favoritos/documentação antigos e ciclo de aviso; sem data definida |
| `/dashboard-financeiro` | `/financeiro` | atalhos antigos; teste de aliases | médio | presente no pacote 1.1.3 | ausência comprovada de atalhos externos; sem data definida |
| `/relatorio-executivo` | `/relatorios?tipo=executivo` | documentos/favoritos; teste de aliases | alto | presente no pacote 1.1.3 | migração dos documentos e favoritos suportados; sem data definida |
| `ReportAlert.title` e `description` | `code` e parâmetros estruturados | fallback em `reportAlertCopy`; serviço ainda preenche os campos | médio | contrato atual | remover fallback somente após o backend deixar de emitir e PDFs antigos serem testados; sem data definida |
| `projetosPorStatus`, `projetosPorTipo`, `areaTotal` | `operational.byStatus`, `byType`, `kpis.activeAreaHa` | backend ainda materializa; sem consumidor direto encontrado | médio | contrato atual | duas versões sem consumidor e teste explícito de exportações; sem data definida |
| `orcamentosStats`, `parcelasStats`, `despesasPorCategoria`, `historicoMensal` | estruturas `financial` | backend ainda materializa; sem consumidor direto encontrado | médio | contrato atual | verificar PDFs/exportações de versões antigas e anunciar retirada; sem data definida |
| `financeiro` legado do relatório | `financial.kpis` | testes `orcamentos.integration` e `reports.integration` | alto | contrato atual | migrar testes/consumidores e manter janela de leitura; sem data definida |
| tipo `DRE` | `MonthlyCashFlowSummary` | nenhum consumidor direto encontrado | baixo/médio | contrato atual | confirmar pacote externo inexistente; sem data definida |
| `/api/financeiro/dre` | `/api/financeiro/resumo-mensal` | `project-financial-polish.integration.test.ts` compara os dois contratos | médio | contrato atual | retirar somente depois de uma versão com aviso e sem consumidor; sem data definida |
| `DELETE /api/sistema/reset` | `POST /api/sistema/reset-dados` | teste de bloqueio/compatibilidade; interface usa o canônico | alto | presente no pacote 1.1.3 | comprovar que nenhuma instalação antiga chama o alias e manter as mesmas barreiras; sem data definida |

## Recursos visuais

Foram cruzados nome completo, imports, CSS, carregamento por `import.meta.glob`/URL, documentação e SHA-256. Nenhum dos 26 arquivos tem consumidor estático ou dinâmico encontrado e nenhum possui hash duplicado. Todos pertencem ao conjunto visual alterado no release de 2026-08-11; por isso a ausência de referência não prova abandono.

Classificação individual: **inconclusivo — manter até decisão visual**.

| Arquivo | Classificação |
| --- | --- |
| `adress-book_4962039.svg` | inconclusivo |
| `auditor_5807551.svg` | inconclusivo |
| `eye-tracking_8052980.svg` | inconclusivo |
| `feedback_3237455.svg` | inconclusivo |
| `good-review_4820567.svg` | inconclusivo |
| `iterative_6309861.png` | inconclusivo |
| `landing-page_5130064.png` | inconclusivo |
| `layers_2899306.svg` | inconclusivo |
| `network_4406473.svg` | inconclusivo |
| `p2p_5809574.svg` | inconclusivo |
| `right-arrow_3227597.svg` | inconclusivo |
| `robot_5809616.svg` | inconclusivo |
| `satisfaction_5156818.svg` | inconclusivo |
| `search_3314590.png` | inconclusivo |
| `search_3670842.png` | inconclusivo |
| `settings_5154937.svg` | inconclusivo |
| `slalom_6027609.png` | inconclusivo |
| `stakeholder_5807756.svg` | inconclusivo |
| `talent-search_8457045.svg` | inconclusivo |
| `target_9757861.svg` | inconclusivo |
| `tools_8392740.png` | inconclusivo |
| `transfer_7839027.svg` | inconclusivo |
| `trees_5026999.png` | inconclusivo |
| `up-arrow_5184141.svg` | inconclusivo |
| `upload_5406245.svg` | inconclusivo |
| `warning-sign_11318030.svg` | inconclusivo |

Nenhum recurso visual foi excluído nesta etapa.

## Pastas temporárias e segurança

| Pasta | Observação desta etapa | Decisão |
| --- | --- | --- |
| `scratch` | 3.448 itens diretamente na raiz durante a inspeção; predominam 3.026 pastas de testes, PNG e logs; novas evidências E2E foram preservadas | não excluir automaticamente |
| `temp-lovable` | 28 itens na raiz, incluindo cópia antiga, dependências e 1 arquivo `.env`; valores não foram lidos/expostos | manter; invalidar/rotacionar credenciais históricas antes de qualquer descarte |
| `work` | contém somente a pasta `smoke` na raiz | manter até confirmar o dono do artefato |
| `data` | banco, WAL/SHM, backups e metadados operacionais | protegida; não mover, compactar, alterar ou excluir |

Política proposta para `scratch`:

1. preservar execuções recentes e todas as execuções com falha;
2. identificar bancos temporários por raiz E2E comprovada;
3. aceitar limpeza somente dentro de `scratch/commercial-e2e/run-*` após resolver e validar o caminho absoluto;
4. recusar raiz vazia, `scratch`, repositório ou caminho externo;
5. mostrar previamente arquivos, quantidade, tamanho e idade;
6. exigir autorização explícita antes da remoção;
7. nunca incluir `data`, backups reais ou `temp-lovable` nessa rotina.

Nenhuma rotina de exclusão foi implementada.

## Desempenho e tamanho do frontend

| Bloco | Antes | Depois | Avaliação |
| --- | ---: | ---: | --- |
| PDFMake | 1.827,54 kB; gzip 814,82 kB | igual | chunk próprio e importação dinâmica em `loadPdfMake`; só é solicitado ao gerar PDF |
| React core | 631,95 kB; gzip 159,23 kB | igual | núcleo compartilhado da aplicação; não há divisão segura evidente |
| Gráficos | 414,91 kB; gzip 120,62 kB | igual | chunk próprio; páginas são lazy, mas o Dashboard usa gráficos na rota inicial autenticada |

As rotas principais usam `React.lazy`, PDFMake já usa `import()` e o `vite.config.ts` mantém chunks específicos para PDF, gráficos, mapas, drag-and-drop, movimento, consultas e Excel. Não foi encontrada duplicação relevante que justificasse mudança. Nenhuma micro-otimização foi aplicada sem ganho mensurável.

## Aplicativo empacotado

Validações seguras executadas sem instalar ou substituir o aplicativo:

- API do pacote `win-unpacked` iniciou em pasta temporária;
- configuração inicial e desbloqueio foram concluídos;
- acesso antes da configuração permaneceu bloqueado;
- clientes, projetos e orçamentos iniciaram vazios;
- auditoria da configuração foi criada sem senha ou tokens;
- banco temporário permaneceu criptografado;
- cópia de banco preparada para simular versão antiga migrou com sucesso e de forma idempotente.

Limitações e falhas:

- o gate do pacote detectou tamanho e SHA-256 divergentes para `GeoGestor Setup 1.1.3.exe`;
- o pacote foi gerado com worktree sujo e não é candidato reproduzível;
- abertura interativa do executável, instalador e restauração visual não foram feitas para não alterar o sistema instalado;
- os fluxos funcionais equivalentes — cliente, projeto, pasta segura, alertas, financeiro, orçamento, licença/condicionante, compromisso, CRM, backup e restauração — foram cobertos pelos testes de API, Electron e E2E temporários, mas não devem ser apresentados como teste interativo do instalador.

## Validações finais

| Verificação | Resultado |
| --- | --- |
| Tipagem frontend | aprovada |
| Tipagem API | aprovada |
| Frontend | 87/87 |
| API | 107/107 |
| Electron | 15/15 |
| Links de alertas | contratos, emissão pela API e jornadas E2E aprovados |
| Rotas e aliases | testes unitários, integração e E2E aprovados |
| E2E comercial crítico | 15/15 |
| E2E cadastros | 9/9 |
| E2E completo final | 45/45 em 3,8 min |
| Build de produção do frontend | aprovado durante o E2E; 5.966 módulos transformados |
| Smoke da API empacotada | aprovado |
| Migração de cópia preparada | aprovada |
| Gate de integridade do instalador existente | reprovado por divergência de tamanho/SHA-256 |
| `git diff --check` | aprovado; somente avisos informativos de conversão LF/CRLF |

Uma execução integral anterior terminou em 44/45 por uma confirmação de descarte que não apareceu uma vez. Depois da estabilização do foco, a auditoria Axe alcançou estados adicionais e encontrou contrastes reais no tema escuro; eles foram corrigidos em produção. O grupo completo de cadastros passou 9/9 e a repetição integral final passou 45/45. Nenhum teste foi removido ou relaxado para mascarar falhas.

## Build integrado e status da versão

O build integrado havia sido aprovado na auditoria imediatamente anterior. A versão atual foi confirmada como `1.0.0` e já está alinhada na raiz, no desktop e na Ajuda. Um novo instalador não foi gerado porque o produto ainda passará por outra rodada de testes e não deve ser publicado nesta etapa.

O instalador `1.1.3` existente deve ser tratado apenas como artefato histórico de validação: além de não representar a nomenclatura atual, seu tamanho e SHA-256 divergem do manifesto. Depois da próxima rodada, o instalador `GeoGestor Setup 1.0.exe` e seu novo manifesto deverão ser gerados juntos a partir do código aprovado.

## Riscos restantes e recomendações

1. Concluir a rodada adicional de testes sobre o código atual, identificado como `1.0.0`.
2. Depois da aprovação, gerar o instalador `GeoGestor Setup 1.0.exe` e o manifesto no mesmo build limpo; não publicar o artefato `1.1.3` existente.
3. Repetir o gate, assinatura e smoke do pacote regenerado.
4. Fazer uma rodada manual do executável regenerado em perfil Windows isolado, incluindo backup/restauração.
5. Manter aliases e campos legados até existir janela formal de compatibilidade.
6. Revisar os 26 ícones com a decisão visual da próxima versão; nomes sem referência não bastam para excluir.
7. Tratar o `.env` histórico de `temp-lovable` como possível segredo: rotacionar/inutilizar credenciais, sem expor valores.
8. Se o aviso não bloqueante do scheduler E2E sobre uma pasta temporária de backup voltar a ocorrer, desligar tarefas agendadas no ambiente E2E ou aguardar encerramento gracioso; ele não afetou os 45 testes.

## Garantias desta entrega

- Dados, bancos, WAL/SHM, backups e migrações oficiais foram preservados.
- `scratch`, `temp-lovable`, `work` e `data` não foram limpos.
- O título `Financeiro`, a aba `Visão geral` e os menus financeiros foram preservados.
- Nenhum endpoint, alias ou campo antigo foi removido.
- Nenhum commit, branch, push ou pull request foi realizado.
