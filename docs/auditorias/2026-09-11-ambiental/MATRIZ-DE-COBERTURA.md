# Matriz de cobertura — Sessão 06: Ambiental

Legenda: **APROVADO** = comportamento comprovado; **APROVADO APÓS CORREÇÃO** = defeito reproduzido, corrigido e retestado; **REPROVADO** = defeito aberto; **BLOQUEADO** = ambiente/evidência insuficiente, com motivo registrado; **NÃO APLICÁVEL** = capacidade ausente ou fora do produto atual.

| ID | Área / rota | Controle ou fluxo | Componente / API | Persistência / efeito | Cenário e evidência | Situação |
|---|---|---|---|---|---|---|
| PRE-01 | Preparação | Stack Electron + React/Vite + Fastify + Drizzle/libSQL identificada | `App.tsx`, `server.ts`, `schema.ts` | banco local | inspeção e build | APROVADO |
| PRE-02 | Preparação | Commit, branch e worktree sujo registrados sem reversão | Git | árvore compartilhada | `a16551a`, `main`, status inicial | APROVADO |
| PRE-03 | Preparação | Banco real identificado e protegido | `data/geogestor.db` | 1.990.656 bytes | SHA-256 antes/depois idêntico | APROVADO |
| PRE-04 | Preparação | Banco, perfil, API e downloads isolados | runner comercial | diretório temporário | E2E 5/5 e limpeza | APROVADO |
| PRE-05 | Preparação | Versões, SO, fuso e app registrados | Node/pnpm/Windows | n/a | comandos de ambiente | APROVADO |
| PRE-06 | Preparação | Linha de base e massa sintética conhecida | setup E2E/API | tabelas ambientais | seed determinístico | APROVADO |
| NAV-01 | `/ambiental` | Entrada canônica pelo menu e URL | `ListagemAmbiental` | nenhuma mutação | E2E | APROVADO |
| NAV-02 | `tab=ambiental` | Clique, URL e recarga | tabs principais | query string | E2E | APROVADO |
| NAV-03 | `tab=licenciamento` | Clique, URL e recarga | tabs principais | query string | E2E | APROVADO |
| NAV-04 | `tab=car` | Clique, URL e recarga | tabs principais | query string | E2E | APROVADO |
| NAV-05 | Aba inválida/ausente | Fallback e URL canônica, sem ação oculta | `ListagemAmbiental` | query normalizada | teste web + E2E | APROVADO APÓS CORREÇÃO |
| NAV-06 | Abas principais | Setas, Home e End | tablist ARIA | foco/URL | E2E e inspeção | APROVADO |
| NAV-07 | `/licenciamento` | Redirect legado sem loop | router | destino canônico | E2E | APROVADO |
| NAV-08 | `/calculadora-ambiental` | Redirect legado sem loop | router | destino canônico | E2E | APROVADO |
| NAV-09 | Detalhes | UUID válido, inexistente e inválido | rotas de detalhe | leitura isolada | API + estados de erro | APROVADO |
| NAV-10 | Reconexão/offline real | Queda e retorno de rede nativa | shell Electron | conexão | exige manipulação manual de rede | BLOQUEADO |
| DEM-01 | `GET /api/ambiental` | Somente Ambiental/Perícia não excluídos | `ambiental.routes` | projetos/especializações | integração | APROVADO |
| DEM-02 | Lista | Busca por nome, cliente e metadados especializados | lista/API | leitura | integração + E2E | APROVADO |
| DEM-03 | Lista | Busca com acento, caixa, espaço, parcial e sem resultado | lista/API | leitura | E2E/contrato | APROVADO |
| DEM-04 | Lista | Filtros tipo/status/período combináveis | lista/API | leitura | inspeção + API | APROVADO |
| DEM-05 | API | `clienteId`, `orgao`, `tipoDemanda` | `GET /api/ambiental` | leitura | integração | APROVADO |
| DEM-06 | API | Página 0, decimal e `limit>100` recusados | Zod query | nenhuma escrita | RED/GREEN S06 | APROVADO APÓS CORREÇÃO |
| DEM-07 | API | Datas impossíveis/invertidas recusadas | contrato de datas | nenhuma escrita | integração S06 | APROVADO APÓS CORREÇÃO |
| DEM-08 | Lista | Ordenação por prazo, desempate e nulos | SQL | tarefas/projetos | integração S06 | APROVADO APÓS CORREÇÃO |
| DEM-09 | Cartão | Próxima ação ignora concluída/excluída | `EnvironmentalDemandCard` | tarefas | integração | APROVADO |
| DEM-10 | Cartão | Tarefa sem prazo não oculta atrasada | SQL da listagem | tarefas | RED reproduzido + GREEN | APROVADO APÓS CORREÇÃO |
| DEM-11 | Cartão | Sem tarefa/órgão/protocolo/prazo | cartão | leitura | estados parciais | APROVADO |
| DEM-12 | Cartão | Prazo vencido/7+ dias contém texto e não só cor | cartão | leitura | inspeção + Axe | APROVADO |
| DEM-13 | Perícia | Identidade e processo; fase ambiental indisponível | detalhe/API | perícias | integração 404 | APROVADO |
| DEM-14 | Cadastro | `action=new` usa formulário de Projeto contextual | `ProjectFormModal` | projeto + especialização | amostra integrada S05/S06 | APROVADO |
| DEM-15 | Cadastro | Cliente ativo e propriedade do cliente | integridade relacional | clientes/propriedades | integração | APROVADO APÓS CORREÇÃO |
| DEM-16 | Cadastro | Projeto e uma única especialização atômicos | projeto routes | projeto/ambiental/perícia | regressão API | APROVADO |
| DEM-17 | Detalhe | Cabeçalho, vínculos, datas, descrição e status | `AmbientalDetalhes` | leitura | E2E | APROVADO |
| DEM-18 | Detalhe | Atalhos levam ao projeto correto | links semânticos | tarefas/documentos/projeto | inspeção + E2E | APROVADO |
| DEM-19 | Fase | Enum canônico e payload estrito | `PATCH .../fase` | ambiental/projeto/audit | integração S06 | APROVADO APÓS CORREÇÃO |
| DEM-20 | Fase | Alteração persiste e cria histórico/auditoria atomicamente | `PATCH .../fase` | ambiental/interações/audit | E2E + banco | APROVADO |
| DEM-21 | Andamento | Título/descrição/data/categoria e limites | `POST .../andamentos` | interações/audit | integração + E2E | APROVADO APÓS CORREÇÃO |
| DEM-22 | Andamento | HTML/JavaScript permanece texto inerte | React + API | interações | contrato/escape React | APROVADO |
| DEM-23 | Histórico | Projeto correto, ordem e ausência de duplicidade | detalhe/API | interações | E2E | APROVADO |
| DEM-24 | Conclusão/exclusão | Fluxo real permanece em Projetos | integração permitida | projeto/especialização | regressão S05 | APROVADO |
| PDF-01 | Modal laudo | Abre/fecha, Escape, foco e bloqueio durante geração | `GeradorLaudoModal` | nenhuma escrita | E2E/inspeção | APROVADO APÓS CORREÇÃO |
| PDF-02 | Modal laudo | Labels, nomes, autocomplete e limites | `GeradorLaudoModal` | formulário | lint/E2E | APROVADO APÓS CORREÇÃO |
| PDF-03 | Vistoria | PDF válido e não vazio | pdfmake | download isolado | 22.659 bytes | APROVADO |
| PDF-04 | Fauna | PDF válido e não vazio | pdfmake | download isolado | 22.857 bytes | APROVADO |
| PDF-05 | Flora | PDF válido e não vazio | pdfmake | download isolado | 22.706 bytes | APROVADO |
| PDF-06 | Genérico | PDF válido e não vazio | pdfmake | download isolado | 22.627 bytes | APROVADO |
| PDF-07 | Nome de arquivo | Caracteres reservados Windows sanitizados | `laudoPdfGenerator` | nome do download | unit + E2E | APROVADO APÓS CORREÇÃO |
| PDF-08 | Conteúdo | Datas pt-BR, acentos, texto longo e identidade sem pessoa real | gerador PDF | documento | unit + quatro downloads | APROVADO APÓS CORREÇÃO |
| PDF-09 | Conteúdo | Documento é laudo técnico, não licença oficial | cópia PDF | documento | inspeção | APROVADO |
| PDF-10 | Impressão física | Impressora, margens e spooler reais | SO/impressora | saída física | hardware não disponível | BLOQUEADO |
| LIC-01 | `GET /api/licencas` | Lista exclui projeto/licença removidos | `licencas.routes` | projetos/licenças | integração S06 | APROVADO APÓS CORREÇÃO |
| LIC-02 | Lista | Busca e filtros por tipo/status/vencimento | `Licenciamento` | leitura | E2E/API | APROVADO |
| LIC-03 | Filtro prazo | Vencida, 30, 60, 90 e 120 dias | API | licenças | contagens independentes | APROVADO |
| LIC-04 | Filtro prazo | Hoje incluído; 121 excluído | API | licenças | E2E de fronteira | APROVADO |
| LIC-05 | Lista | Tabela desktop e cartões móveis sem duplicação funcional | `Licenciamento` | leitura | E2E 1120/360 | APROVADO |
| LIC-06 | Status | Registrado e efetivo diferenciados | serializer/UI | licenças | integração/E2E | APROVADO |
| LIC-07 | Status | Data passada vence válida/análise/renovação | serializer | licenças | API de fronteira | APROVADO |
| LIC-08 | Status | Suspensa/Encerrada preservadas | serializer | licenças | unit/inspeção | APROVADO |
| LIC-09 | Status legado | Valor desconhecido não é mascarado | serializer/UI | licenças | E2E | APROVADO APÓS CORREÇÃO |
| LIC-10 | Resumo | Válidas, vencidas, até 120 e renovação | `Licenciamento` | conjunto completo | cálculo externo/API | APROVADO |
| LIC-11 | Resumo | Condicionantes pendentes/vencidas sem dispensadas | API/resumo | condicionantes | integração | APROVADO |
| LIC-12 | Cadastro | Projeto válido deriva cliente | `LicenseFormModal`, POST | licenças/audit | integração | APROVADO APÓS CORREÇÃO |
| LIC-13 | Cadastro | Campos, limites, datas reais e payload extra | contrato Zod | licenças | integração S06 | APROVADO APÓS CORREÇÃO |
| LIC-14 | Edição | PUT completo e PATCH parcial preserva omitidos | PUT/PATCH licença | licenças/audit | integração S06 | APROVADO APÓS CORREÇÃO |
| LIC-15 | Edição | Projeto não pode ser reatribuído pela API | PATCH licença | vínculos | 409 sem mutação | APROVADO APÓS CORREÇÃO |
| LIC-16 | Volume amplo | Renderização sem paginação com milhares de licenças | lista completa | memória/UI | massa representativa ampla não executada | BLOQUEADO |
| LIC-17 | Renovação | Estado, resumo, mensagem e auditoria | PATCH licença | licenças/alertas/audit | contrato + regressão | APROVADO |
| LIC-18 | Exclusão | Confirmação e soft delete transacional | DELETE licença | licenças/audit | integração | APROVADO |
| LIC-19 | Exclusão | Condicionantes filhas removidas logicamente | DELETE licença | condicionantes | integração S06 | APROVADO APÓS CORREÇÃO |
| LIC-20 | Exclusão | Detalhe 404 e listas/alertas sem órfãos | GET/lista/alertas | licenças/condicionantes | integração S06 | APROVADO APÓS CORREÇÃO |
| LIC-21 | Duplicidade | Número/protocolo seguem contrato atual sem unicidade nova | POST licença | licenças | inspeção/contrato | APROVADO |
| LIC-22 | Emissão oficial | Protocolo/transmissão/emissão por órgão ambiental | produto atual | serviço externo | recurso inexistente | NÃO APLICÁVEL |
| CON-01 | Detalhe licença | Abas overview/conditions/documents/history | `LicencaDetalhes` | query string | E2E | APROVADO |
| CON-02 | Detalhe licença | Aba inválida retorna à visão geral | `LicencaDetalhes` | query normalizada | inspeção | APROVADO |
| CON-03 | Visão geral | Mensagens de vencida/hoje/N dias/longa validade | detalhe | licenças | cálculo de datas | APROVADO |
| CON-04 | Documentos | Explicação e link para projeto correto | tab documents | projeto/documentos | inspeção | APROVADO |
| CON-05 | Histórico | Apenas interações do projeto e ordem correta | tab history | interações | inspeção/E2E | APROVADO |
| CON-06 | CRUD | Criar condicionante em licença existente | POST condicionante | condicionantes/audit | integração | APROVADO |
| CON-07 | CRUD | Licença pai ausente/removida retorna 404 | GET/POST condicionantes | nenhuma escrita | integração S06 | APROVADO APÓS CORREÇÃO |
| CON-08 | CRUD | `conditionId` deve pertencer à licença da URL | PATCH/DELETE condicionante | nenhuma mutação cruzada | integração/consulta restrita | APROVADO APÓS CORREÇÃO |
| CON-09 | Contrato | Limites, data real, status e payload extra | Zod | condicionantes | integração S06 | APROVADO APÓS CORREÇÃO |
| CON-10 | Cumprimento | Cumprida exige data local; atalho persiste | PATCH condicionante | condicionantes/audit | E2E + banco | APROVADO APÓS CORREÇÃO |
| CON-11 | PATCH | Campos omitidos preservados; data removida ao reabrir | PATCH merge | condicionantes | integração | APROVADO APÓS CORREÇÃO |
| CON-12 | Status efetivo | Pendente vencida é exibida Vencida sem sobrescrever registro | serializer | condicionantes | E2E + banco | APROVADO |
| CON-13 | Exclusão | Soft delete retira de contadores/alertas e mantém auditoria | DELETE condicionante | condicionantes/audit | integração | APROVADO |
| CON-14 | Concorrência nativa | Duplo cumprir/excluir em processos distintos | Electron/API | transação | ambiente monoexecução | BLOQUEADO |
| CON-15 | Comprovante | Referência textual até 1.000 caracteres | modal/API | condicionantes | contrato | APROVADO |
| CON-16 | Upload direto | Arquivo do comprovante no detalhe da licença | produto atual | documentos | controle inexistente | NÃO APLICÁVEL |
| CON-17 | Deep link | `condicionante=` abre aba, destaca e foca | detalhe licença | URL/foco | E2E captura 04 | APROVADO APÓS CORREÇÃO |
| CON-18 | Deep link | Parâmetro consumido sem remover parâmetros alheios | `useSearchParams` | URL | inspeção/E2E | APROVADO |
| ALT-01 | Alertas | Licença vencida, hoje e dentro da antecedência | deadline service | ocorrências | API/E2E | APROVADO |
| ALT-02 | Alertas | Licença fora da janela não aparece | deadline service | ocorrências | fronteira 121 | APROVADO |
| ALT-03 | Alertas | Condicionante vencida/futura respeita status | deadline service | ocorrências | integração | APROVADO |
| ALT-04 | Alertas | Cumprida/Dispensada não gera ocorrência | deadline service | ocorrências | integração | APROVADO |
| ALT-05 | Alertas | Licença/projeto/condicionante removido não gera órfão | joins/filters | ocorrências | integração S06 | APROVADO APÓS CORREÇÃO |
| ALT-06 | Alertas | Licença encerrada não gera alerta ativo | deadline service | ocorrências | integração | APROVADO APÓS CORREÇÃO |
| ALT-07 | Alertas | Link aponta à licença e condicionante corretas | app navigation | URL | E2E deep link | APROVADO |
| ALT-08 | Fuso | Virada real de meia-noite com app aberto | relógio do SO | datas/alertas | relógio real não alterado | BLOQUEADO |
| CAR-01 | `tab=car` | Regra geral Demais regiões = 20 ha/100 ha | cálculo puro/UI | resultado | unit independente | APROVADO |
| CAR-02 | `tab=car` | Amazônia floresta = 80 ha/100 ha | cálculo puro | resultado | unit independente | APROVADO |
| CAR-03 | `tab=car` | Amazônia cerrado = 35 ha/100 ha | cálculo puro | resultado | unit independente | APROVADO |
| CAR-04 | `tab=car` | Amazônia campos gerais = 20 ha/100 ha | cálculo puro | resultado | unit independente | APROVADO |
| CAR-05 | Entradas | Vírgula e ponto decimal | `NumericInput`, parser | cálculo | unit + E2E | APROVADO APÓS CORREÇÃO |
| CAR-06 | Entradas | Texto, científica, NaN, infinito e negativos recusados | parser/validação | nenhuma gravação | unit/E2E | APROVADO APÓS CORREÇÃO |
| CAR-07 | Entradas | APP/vegetação/remanescente não superam total | cálculo puro | resultado | unit | APROVADO APÓS CORREÇÃO |
| CAR-08 | Entradas | APP + vegetação não supera total | cálculo puro | resultado | unit | APROVADO APÓS CORREÇÃO |
| CAR-09 | Entradas | Módulos, remanescente e visibilidade do art. 67 | calculadora | resultado | unit/E2E | APROVADO |
| CAR-10 | Art. 15 | Sem condições, APP computável = 0 | cálculo puro | resultado | 15 ha; déficit 5 ha | APROVADO |
| CAR-11 | Art. 15 | Condições parciais não computam APP | cálculo puro | resultado | matriz independente | APROVADO |
| CAR-12 | Art. 15 | Três condições computam APP | cálculo puro/UI | resultado | 25 ha; excedente 5 ha | APROVADO |
| CAR-13 | Art. 67 | Até 4 MF + existente em 22/07/2008 exige remanescente | cálculo puro/UI | resultado | unit/E2E | APROVADO |
| CAR-14 | Art. 67 | Remanescente menor reduz referência | cálculo puro | resultado | referência 10 ha | APROVADO |
| CAR-15 | Art. 67 | Remanescente igual/superior não reduz referência geral | cálculo puro | resultado | unit | APROVADO |
| CAR-16 | Art. 68 | Marca gera aviso documental, não aprovação automática | UI | resultado | E2E | APROVADO |
| CAR-17 | Precisão | Igualdade, déficit/excedente de 0,01 ha | cálculo puro | resultado | unit | APROVADO |
| CAR-18 | Memória | Fórmulas, hectares e pt-BR sem conclusão jurídica | calculadora | resultado | E2E/inspeção | APROVADO |
| CAR-19 | Limites | Geometria, sobreposição, ZEE, PRA e legislação estadual declarados | cópia UI | informação | inspeção | APROVADO |
| CAR-20 | Análise espacial | Geometria e localização aprovada da RL | produto atual | camada espacial | recurso inexistente | NÃO APLICÁVEL |
| HIS-01 | Histórico CAR | Salvar desabilitado sem análise válida | calculadora | nenhuma escrita | inspeção | APROVADO |
| HIS-02 | Histórico CAR | Nome, observação, unidade, método e data validados | POST cálculos | cálculos/audit | integração | APROVADO APÓS CORREÇÃO |
| HIS-03 | Histórico CAR | Sem vínculo e somente cliente | POST cálculos | cálculos | integração/contrato | APROVADO |
| HIS-04 | Histórico CAR | Projeto precisa ser Ambiental e compatível com cliente | integridade relacional | cálculos/projetos | 409 sem escrita | APROVADO APÓS CORREÇÃO |
| HIS-05 | Histórico CAR | Cliente precisa existir e estar ativo | integridade relacional | clientes/cálculos | integração | APROVADO APÓS CORREÇÃO |
| HIS-06 | Histórico CAR | JSON legado inválido não derruba lista | `CalculationHistory` | leitura resiliente | E2E | APROVADO APÓS CORREÇÃO |
| HIS-07 | Histórico CAR | Ordem e limite visual dos 20 recentes | API/componente | cálculos | inspeção | APROVADO |
| HIS-08 | Histórico CAR | Editar/excluir cálculo salvo | produto atual | cálculos | controles inexistentes | NÃO APLICÁVEL |
| SEC-01 | Contratos | UUIDs inválidos e IDs ausentes produzem erro seguro | API | nenhuma escrita | integração | APROVADO |
| SEC-02 | Contratos | Objetos estritos bloqueiam mass assignment | Zod `.strict()` | nenhuma escrita | integração S06 | APROVADO APÓS CORREÇÃO |
| SEC-03 | Contratos | Datas verificam calendário real | contratos | nenhuma escrita inválida | integração S06 | APROVADO APÓS CORREÇÃO |
| SEC-04 | Integridade | Projeto-cliente-propriedade coerentes | relationship service | tabelas vinculadas | integração | APROVADO APÓS CORREÇÃO |
| SEC-05 | Atomicidade | Fase/histórico/audit e CRUD/audit em transação | Drizzle transactions | múltiplas tabelas | injeção/regressão API | APROVADO |
| SEC-06 | Exclusão lógica | Consultas e alertas filtram `deletedAt` | API/services | registros lógicos | integração | APROVADO APÓS CORREÇÃO |
| SEC-07 | XSS/injeção | Texto adversarial permanece dado; consultas parametrizadas | React/Drizzle | dados sintéticos | inspeção/contrato | APROVADO |
| SEC-08 | Auditoria | Ação/entidade/antes/depois sem senha/token | AuditLogService | audit_logs | E2E/smoke | APROVADO |
| SEC-09 | Protocolo eletrônico | Envio ao órgão externo | produto atual | integração externa | recurso inexistente | NÃO APLICÁVEL |
| SEC-10 | Performance concorrente | Stress multiprocesso e lock prolongado | SQLite nativo | banco | não executado neste ambiente | BLOQUEADO |
| UX-01 | WCAG | Axe WCAG 2.2 A/AA nas jornadas principais | Playwright+Axe | n/a | zero violações após correção | APROVADO APÓS CORREÇÃO |
| UX-02 | Contraste | Datas e metadados de histórico/condicionantes | CSS | n/a | falha 2,56:1 corrigida | APROVADO APÓS CORREÇÃO |
| UX-03 | Leitor de tela | NVDA/JAWS com anúncios e ordem real | tecnologia assistiva | n/a | software/interação manual indisponível | BLOQUEADO |
| UX-04 | Teclado | Abas, caixas, modal e ações nativas | UI | foco | E2E/inspeção | APROVADO |
| UX-05 | Matriz visual | 768/1024/1440, 200% e tema escuro completos | navegador/Electron | n/a | amostra limitada a 360/1120 e tema claro | BLOQUEADO |
| UX-06 | Responsividade | 360 px sem overflow horizontal | Ambiental/CAR | n/a | E2E + captura 05 | APROVADO |
| UX-07 | Semântica | Labels, `aria-label`, ícones decorativos e links | componentes | n/a | lint/Axe/inspeção | APROVADO APÓS CORREÇÃO |
| UX-08 | Movimento | Sem `transition: all`; foco visível | CSS/componentes | n/a | inspeção | APROVADO |
| REG-01 | API completa | Todas as suítes de backend | Node test | bancos temporários | 163/163 | APROVADO |
| REG-02 | Web completa | Todas as suítes de frontend | Node test | n/a | 179/179 | APROVADO |
| REG-03 | Electron | Main/preload/restore | Node test | n/a | 18/18 | APROVADO |
| REG-04 | E2E S06 | Cinco jornadas integradas | Playwright | SQLite temporário/PDF | 5/5 | APROVADO |
| REG-05 | Qualidade | Lint, typecheck e diff check | ESLint/TypeScript/Git | n/a | aprovados | APROVADO |
| REG-06 | Build | Web, API, Electron e instalador 1.0.4 | `pnpm build` | artefato assinado | aprovado | APROVADO |
| REG-07 | Smoke pacote | Setup, rotas, bloqueio e criptografia | pacote/API | banco temporário | aprovado após adaptar paginação audit | APROVADO APÓS CORREÇÃO |
| REG-08 | Upgrade instalado | Atualização sobre instalação real anterior | instalador Windows | perfil real | instalação destrutiva não autorizada | BLOQUEADO |

## Totais

Os totais desta matriz são calculados no fechamento do relatório e devem coincidir com `RELATORIO.md`.
