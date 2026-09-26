# Levantamento consolidado de ressalvas — GeoGestor

Data da consolidação: 19/09/2026  
Base documental: sessões 01 a 15 e auditorias especiais de backup/recuperação e relatórios financeiros/orçamentos.  
Referência do repositório registrada nas auditorias: branch `main`, HEAD `a16551a8b63e73f42d826297df893488e5ab88ca`, com worktree amplamente modificado e ainda não consolidado.

## 1. Objetivo e critério

Este documento reúne as ressalvas, bloqueios, riscos residuais e lacunas de comprovação registrados nas auditorias do GeoGestor. Itens repetidos entre sessões foram consolidados, mas permanecem rastreáveis na seção por sessão.

Os estados usados aqui são:

- **PENDENTE — CÓDIGO/TESTE:** pode exigir correção no produto, no executor de testes ou nova cobertura automatizada.
- **PENDENTE — HOMOLOGAÇÃO:** o comportamento não foi comprovado em ambiente físico ou assistivo real; não significa defeito confirmado.
- **PENDENTE — DECISÃO DE PRODUTO:** não deve ser implementado sem escolha explícita de regra funcional.
- **PENDENTE — EXTERNO:** depende de credencial, conta, hardware, parecer jurídico ou outro recurso externo.
- **RESOLVIDO:** uma auditoria posterior produziu evidência suficiente de encerramento.
- **SUPERADO:** a pendência antiga deixou de descrever o estado atual, mas foi substituída por um gate mais recente.
- **MELHORIA:** evolução recomendada, não defeito comprovado.

## 2. Parecer consolidado

O núcleo funcional das sessões 01 a 14 foi aprovado, em geral com ressalvas e sem P0/P1 funcional conhecido remanescente nos respectivos módulos. Isso não equivale à aprovação do produto para publicação.

O estado global mais recente é:

| Área | Situação consolidada |
|---|---|
| Funções das sessões 01–14 | Aprovadas ou aprovadas com ressalvas; lacunas de ambiente e cobertura permanecem. |
| Sessão 15 — Ajuda, rotas e pesquisa global | Aprovada com ressalvas. |
| Produto integrado | **Reprovado para release**: E2E integral terminou em 56 aprovados, 13 falhas e 21 não executados; não houve nova execução integral depois dos ajustes. |
| Candidato instalável | **Bloqueado**: origem amplamente modificada, sem candidato final limpo identificado por hash. |
| Recuperação de desastre | **Reprovada**: faltam restauração/reinício físico no Dispositivo A e recuperação real em outro perfil/equipamento B. |
| Relatórios financeiros, projetos e propostas PDF | Aprovados com ressalvas; cálculos reconciliados, mas sem PDF/UA, impressão física e leitor de tela real. |
| Publicação | Não autorizada nem executada. |

## 3. Pendências consolidadas sem duplicação

### R01 — Isolamento e confiabilidade do E2E integral

**Estado:** PENDENTE — CÓDIGO/TESTE.  
**Origem:** Sessão 15.

- A suíte integral compartilha banco entre specs.
- Casos que esperam estado vazio, contagens fixas ou datas absolutas sofrem contaminação de execuções anteriores.
- É necessário isolar por spec, aplicar reset transacional ou usar fixtures idempotentes e datas relativas.
- Depois da correção, os 90 casos precisam ser reexecutados, sem falhas e sem bloqueios injustificados.
- Os diretórios de execuções vermelhas foram preservados e devem ser tratados como evidência, não como resultado aprovado.

### R02 — Concorrência, versionamento e lock SQLite

**Estado:** PENDENTE — DECISÃO DE PRODUTO e CÓDIGO/TESTE.  
**Origem:** sessões 01, 02, 03, 05, 06, 07, 08, 10, 11, 12, 13 e 14.

- Não existe política otimista completa com versão/ETag para reorder do CRM, catálogos auxiliares e propriedades.
- Duas edições válidas podem adotar silenciosamente a última gravação.
- Permanecem sem prova suficiente: dois processos reais, lock prolongado, leitura durante escrita, mutação durante snapshot, reatribuição concorrente com exclusão e ativação exclusiva multiprocesso.
- A política desejada precisa ser escolhida: última gravação vence, bloqueio pessimista, versão/ETag com conflito explícito ou merge de campos.
- Depois da decisão, implementar testes multiprocesso e mensagens de conflito recuperáveis na interface.

### R03 — Homologação nativa de acessibilidade e matriz visual

**Estado:** PENDENTE — HOMOLOGAÇÃO.  
**Origem:** transversal a praticamente todas as sessões.

- NVDA, JAWS ou Narrador não foram usados nas jornadas completas.
- Alto contraste real do Windows, escalas 125/150/200%, zoom nativo de 200%, reflow em 320 CSS px e monitores com DPIs distintos continuam pendentes.
- A matriz física 360/768/1024/1440, 800×600, 1024×768, tema claro/escuro e reduced motion não foi concluída de ponta a ponta.
- Permanecem pendentes ordem, contenção e retorno de foco em fluxos reais, além de drag-and-drop com mouse e touch.
- Axe, árvore semântica e teclado automatizado são evidências úteis, mas não substituem tecnologia assistiva real.

### R04 — Rede, relógio, suspensão e falhas físicas

**Estado:** PENDENTE — HOMOLOGAÇÃO.  
**Origem:** sessões 01, 02, 04, 06, 07, 08, 10, 13, 14 e 15.

- Queda e reconexão reais durante leitura e mutação não foram executadas sistematicamente.
- Respostas lentas, retry e falhas parciais têm cobertura desigual entre módulos.
- Virada real da meia-noite e bordas de fuso não foram comprovadas com relógio controlado no aplicativo em execução.
- Suspensão/retomada do Windows, sessão bloqueada e encerramento do sistema permanecem pendentes.
- Mapas-base offline/lentos e recuperação de tiles precisam de ensaio real.

### R05 — Volume, desempenho e uso prolongado

**Estado:** PENDENTE — CÓDIGO/TESTE e HOMOLOGAÇÃO.  
**Origem:** sessões 04, 06, 07, 09, 10, 15 e auditorias especiais.

- Faltam benchmarks representativos de bases produtivas para listas, histórico topográfico, pesquisa global, licenças, documentos e backups.
- A pesquisa global ainda lê coleções amplas antes de filtrar e limitar; falta benchmark de alta cardinalidade e, se necessário, consulta paginada/limitada no banco.
- Licenças ambientais não possuem paginação; milhares de registros não foram exercitados.
- Tarefas paginam em 100; virtualização é melhoria condicional se o produto vier a exibir mais cartões simultaneamente.
- PDFs de 100 itens passaram estruturalmente, mas faltam repetição, mediana/SLA e jornada extensa integral pela interface.
- Backup com milhares de arquivos, handles e carga prolongada não foi medido.
- Uso prolongado e consumo de CPU/memória fazem parte da homologação humana pendente.

### R06 — Arquivos, impressão, downloads e documentos acessíveis

**Estado:** PENDENTE — CÓDIGO/TESTE e HOMOLOGAÇÃO.  
**Origem:** sessões 02, 04, 05, 06, 10, 11, 15 e auditoria especial de documentos.

- Permanecem jornadas não exauridas para arquivo vazio, duplicado, nome longo/Unicode, MIME hostil, falha de leitura/armazenamento, download correto, remoção, pasta nativa e persistência após reinício.
- Cancelamento ou bloqueio de download pelo SO e diálogo nativo de impressão não foram exercitados.
- Impressão física, múltiplos drivers e spooler real não foram validados.
- Os PDFs atuais são legíveis e extraíveis, mas não possuem tags estruturais, `/Lang` e título; não há conformidade PDF/UA comprovada.
- PDF longo/extremo, loader do PDF com falha e recuperação ainda possuem lacunas fora da campanha especializada.

### R07 — Google Agenda e política de sincronização

**Estado:** PENDENTE — EXTERNO e DECISÃO DE PRODUTO.  
**Origem:** sessões 08 e 14.

- Faltam conta e calendário exclusivos de QA para OAuth real, cancelamento, revogação, token expirado/inválido e respostas 401/403/429/5xx.
- Não existe política formal para conflito local/remoto, exclusão bidirecional e retries idempotentes.
- O fluxo atual é local-primeiro; mudar essa regra exige decisão do proprietário.
- O “Desfazer” de exclusão recria o compromisso com novo ID e não preserva `googleEventId`; decidir se a identidade original deve ser restaurada.

### R08 — Backup e recuperação de desastre

**Estado:** PENDENTE — HOMOLOGAÇÃO; prontidão geral REPROVADA.  
**Origem:** Sessão 14 e auditoria especial de 19/09.

- O aplicativo instalado não foi restaurado e reiniciado fisicamente no Dispositivo A.
- A recuperação não foi executada em outro perfil, VM ou equipamento B pelo kit real e após reinício.
- Faltam mídia removível/rede reais, corrida de espaço, arquivo bloqueado/permissão negada, queda de energia, disco cheio, remoção de unidade e atualização malsucedida.
- Faltam aviso real de encerramento do Windows, carga prolongada e matriz completa de nomes/extensões/Unicode.
- Instalação, atualização e desinstalação precisam usar exatamente o mesmo candidato identificado por hash.
- Até esses ensaios, o produto não deve ser anunciado como recuperável fora deste computador.

### R09 — Release, candidato e ciclo de instalação

**Estado:** PENDENTE — CÓDIGO/TESTE e HOMOLOGAÇÃO.  
**Origem:** sessões 10–15.

- O problema histórico de manifesto divergente foi **SUPERADO**, não promovido a aprovado: os instaladores existentes passaram a ser tratados como artefatos históricos.
- O bloqueio atual é não haver origem consolidada/limpa nem candidato final correspondente ao código auditado.
- É necessário gerar novo candidato, SBOM e hashes; executar smoke empacotado, instalação limpa, atualização preservando dados e desinstalação.
- O instalador final deve ser homologado pelos 19 ensaios humanos com registro de commit, versão e SHA-256.
- Authenticode não está implementado por decisão do proprietário; o risco foi aceito, mas o comportamento do SmartScreen ainda deve ser homologado.
- Publicação, tag, push e distribuição continuam fora do escopo e exigem autorização futura explícita.

### R10 — Governança e dívida estrutural

**Estado:** PENDENTE — CÓDIGO/TESTE ou MELHORIA.  
**Origem:** Sessão 15.

- Restam 60 links internos literais cobertos pela baseline de governança.
- Há 28 ativos visuais inconclusivos, endpoints repetidos e a área histórica `temp-lovable`.
- A baseline impede regressão, mas não elimina a dívida existente.
- Antes da publicação, ainda são necessárias revisão de licenças/transitivos e revisão jurídica dos documentos comerciais.

### R11 — Lacunas específicas de módulos

**Estado:** PENDENTE — CÓDIGO/TESTE ou MELHORIA.

- **Orçamentos:** permanecem 27 itens originais sem travessia visual completa, detalhados em S04 abaixo. A auditoria especial posterior comprovou cálculos e PDFs principais, mas não encerrou toda a matriz de UI e estados terminais.
- **Projetos:** reativação após decisão, ciclo completo de arquivos e concorrência de reatribuição/exclusão ainda não foram exauridos.
- **Tarefas:** drag-and-drop real com mouse/touch e leitor de tela; persistência de filtros na URL é melhoria de produto.
- **Topografia:** deep-link/voltar-avançar, restart nativo, clipboard negado, quatro modos salvos, exclusões visuais, mapa extremo, gestures, arquivos físicos, downloads bloqueados, PDF extremo, histórico degradado, payload enorme e volume produtivo continuam sem evidência integral.
- **Planejamento:** concorrência, exclusões pela UI/API, matriz completa de limites matemáticos, interleaving de fontes, governança legada e acessibilidade integral continuam bloqueados.
- **Ambiental:** paginação/virtualização de licenças, relógio injetável, detalhamento de cálculo salvo, memória CAR exportável, comprovante estruturado de condicionante e PDF semântico estão documentados como melhorias, não como defeitos abertos.
- **Relatórios/orçamentos PDF:** nem todas as bordas temporais, status, legados, estornos e identidades inválidas foram novamente materializados em PDFs na campanha especial.

## 4. Ressalvas por sessão

### S01 — Visão Geral e tarefas

Parecer: funcionalmente aprovada, sem defeito conhecido pendente.

1. Offline/latência/reconexão durante o painel.
2. Duas escritas concorrentes na mesma tarefa e política de conflito.
3. Leitor de tela real.
4. Zoom nativo 200% e viewports intermediários.

Consolidação: R02, R03 e R04.

### S02 — Comercial — Clientes

Parecer: aprovada com quatro bloqueios, sem P0/P1/P2 pendente.

1. Leitor de tela real.
2. Tema escuro, 360/768/1024/1440 e zoom 200%.
3. Offline, lentidão, reconexão e dois escritores concorrentes.
4. Arquivo vazio, duplicado, nome muito longo e matriz de MIME hostis.

Consolidação: R02, R03, R04 e R06.

### S03 — Comercial — CRM e Funil

Parecer: apta para encerramento; matriz sem bloqueio formal, com riscos residuais.

1. Reorder concorrente sem versão otimista/ETag; prevalece a última resposta.
2. Leitor de tela real e zoom nativo de 200%.
3. Runs antigos de `scratch/commercial-e2e` foram preservados e não devem ser atribuídos automaticamente a uma campanha nova.

Consolidação: R02 e R03.

### S04 — Comercial — Orçamentos

Parecer original: aprovada com 27 itens bloqueados por insuficiência de evidência. A auditoria especializada de 19/09 aprovou cálculos, downloads e PDFs principais com ressalvas, sem encerrar automaticamente os itens abaixo.

1. `N02`: criação completa por `/orcamentos/novo`.
2. `N04`: UUID inválido, orçamento não rascunho e removido.
3. `N08`: voltar/avançar e retorno de foco em toda navegação.
4. `N10`: resposta lenta injetada.
5. `L04`: todas as combinações visuais de serviço, imóvel, responsável e datas.
6. `L06`: remover individualmente chips e limpar filtros.
7. `L07`: nove abas e todos os contadores.
8. `L08`: paginação visual com mais de 25 propostas.
9. `E04`: cadastro rápido PF/PJ.
10. `E05`: matriz de mínimo, máximo, paste e autofill em todos os campos.
11. `E06`: editar, duplicar, ordenar e remover itens pela UI.
12. `E15`: travessia das doze seções e resumo lateral.
13. `E16`: descarte, Escape, dupla submissão e falha ao salvar.
14. `E17`: persistência após reinício do serviço.
15. `C11`: todos os alertas de margem, total, custo e base.
16. `C15`: todas as unidades e unidade personalizada.
17. `S04`: expiração na borda de data/fuso com passagem real do relógio.
18. `S09`: projeto inexistente ou de outro cliente no fluxo cruzado UI/API.
19. `S12`: revisão inferior ao valor já recebido.
20. `S13`: excluir emitido/aprovado e duplicar estado terminal.
21. `PDF02`: cancelamento da confirmação de PDF em rascunho.
22. `PDF06`: clique duplo e leitor externo do PDF.
23. `PDF07`: snapshot após alteração posterior de cliente/imóvel.
24. `PDF08`: impressão física.
25. `UX02`: zoom 200% e reflow nativo.
26. `UX04`: teclado exaustivo nas doze seções.
27. `UX05`: leitor de tela real.

Consolidação: R03, R04, R05, R06 e R11.

### S05 — Projetos

Parecer: núcleo aprovado; doze bloqueios na matriz original.

1. Reativação após decisão preservando histórico.
2. Política de nomes duplicados em arquivos.
3. Download do conteúdo correto.
4. Remoção e confirmação de arquivo.
5. Abrir pasta no desktop.
6. Falha de armazenamento.
7. Persistência de arquivo após reinício.
8. Concorrência entre reatribuição e exclusão.
9. Leitor de tela real.
10. Zoom do sistema a 200%.
11. Tema escuro em toda a matriz de viewports.
12. Jornada instalada completa.

A Configuração Inicial, que bloqueava dois desses percursos, foi posteriormente aprovada. As jornadas específicas de arquivos/reinício, entretanto, não foram automaticamente reexecutadas e continuam sem prova final.

Consolidação: R02, R03, R06, R09 e R11.

### S06 — Ambiental

Parecer mais recente: reauditoria aprovada, 0 reprovados e 9 bloqueios.

1. Desconexão/reconexão nativa.
2. Impressão física.
3. Milhares de licenças sem paginação.
4. Concorrência multiprocesso.
5. Virada real da meia-noite.
6. Leitor de tela real.
7. Matriz visual completa, zoom e tema escuro.
8. Stress de lock SQLite.
9. Upgrade sobre instalação anterior.

Melhorias separadas: paginação/virtualização, relógio injetável, reabertura detalhada de cálculo, memória CAR exportável, comprovante estruturado de condicionante e PDF com tags semânticas.

Consolidação: R02 a R06, R09 e R11.

### S07 — Financeiro

Parecer: núcleo aprovado, sem P0/P1 ou reprovação aberta; nove bloqueios na matriz.

1. Leitor de tela real.
2. Alto contraste nativo.
3. Viewports 768/1024/1440.
4. Zoom nativo 200%.
5. Queda de rede e reconexão durante mutação.
6. Virada real da meia-noite.
7. Volume equivalente à base produtiva.
8. Dois processos disputando lock SQLite.
9. Upgrade sobre instalação anterior preservando o perfil.

Consolidação: R02 a R05 e R09.

### S08 — Agenda — Calendário

Parecer: aprovado com ressalvas para calendário local; 13 bloqueios na matriz.

1. OAuth real/autorização.
2. Cancelamento/revogação real.
3. Access token expirado.
4. Refresh token inválido.
5. Falhas reais 401/403/429/5xx.
6. Conflito simultâneo local/remoto.
7. Exclusão bidirecional.
8. Duplicidade em retry remoto.
9. Leitor de tela real.
10. Zoom nativo 200% e alto contraste.
11. Matriz de dispositivos físicos.
12. Concorrência multiprocesso SQLite.
13. Upgrade sobre instalação antiga.

Ressalva adicional: o Desfazer recria com novo ID e não preserva `googleEventId`.

Consolidação: R02, R03, R04, R07 e R09.

### S09 — Agenda — Tarefas

Parecer: sem P0/P1/P2 conhecido no fluxo automatizado.

1. Drag-and-drop com mouse e touch reais.
2. NVDA no fluxo de arrastar e soltar.
3. Persistir filtros na URL, se esse estado for considerado compartilhável.
4. Considerar virtualização se mais de 100 cartões simultâneos forem exigidos.

Os itens 3 e 4 são melhorias condicionais, não defeitos confirmados.

Consolidação: R03, R05 e R11.

### S10 — Topografia

Parecer funcional: apta para seguir, com 21 bloqueios e um gate de manifesto reprovado na época. O manifesto antigo foi posteriormente classificado como histórico; o gate atual está em R09.

1. Voltar/avançar e deep-link de aba/modo/SRC.
2. Reinício nativo do Electron preservando estado.
3. Clipboard negado e fallback manual.
4. Salvar/reabrir separadamente os quatro modos do conversor.
5. Cancelar/confirmar exclusão e limpar todos pela UI.
6. Geometria extensa, antimeridiana e fora do Brasil no mapa.
7. Tile lento/HTTP, offline→online e retry.
8. Clique e arraste reais de origem, destino e vértice.
9. Seleção física CSV/TXT, nomes/MIME e falha de leitura.
10. Download cancelado/bloqueado.
11. PDF vazio/extremo, texto/tabela longa e croqui degenerado.
12. Falha do loader do PDF e recuperação.
13. Histórico vazio/loading/erro/retry/lento.
14. Recarregar e reiniciar API/Electron.
15. Payload muito grande, profundo ou não serializável.
16. Concorrência SQLite multiprocesso/leitura durante escrita.
17. Volume produtivo e memória prolongada.
18. Leitor de tela real.
19. Touch e arraste real.
20. Matriz 360–1440, zoom 200%, temas, alto contraste e reduced motion.
21. Upgrade sobre instalação antiga.

Consolidação: R02 a R06, R09 e R11.

### S11 — Relatórios

Parecer: aprovada com ressalvas; 12 defeitos do módulo foram corrigidos.

Bloqueios ainda aplicáveis:

1. Leitor de tela real.
2. Alto contraste e zoom nativo de 200%.
3. Tema escuro completo.
4. Cancelamento no diálogo nativo de impressão.
5. Contenção/busy SQLite deliberada.
6. Leituras simultâneas e deduplicação.
7. Mutações concorrentes durante snapshot.
8. UI empacotada completa, reinício e upgrade.

Itens históricos encerrados ou superados:

- Falha `financial-removal-scenarios`: **RESOLVIDA**; API passou 190/190 na Sessão 15 e 192/192 na auditoria especial posterior.
- Manifesto 1.0.2/1.0.3/1.0.4 divergente: **SUPERADO** por artefatos históricos; ainda não existe candidato final limpo.

Consolidação: R02, R03, R06 e R09.

### S12 — Planejamento estratégico

Parecer: módulo aprovado; oito bloqueios de evidência.

1. Ativação exclusiva sob requisições concorrentes multiprocesso.
2. Cancelar/confirmar exclusões pela UI em todas as oito entidades.
3. Exclusão lógica tabela a tabela para pilar, objetivo, KR, decisão e risco.
4. Matriz completa de limites matemáticos: clamp, igualdade, negativos, decimais, NaN/infinito.
5. Alteração operacional concorrente durante leitura.
6. Todos os contadores de transição e JSON legado inválido.
7. Axe em quatro abas e todos os modais/estados.
8. Leitor de tela, alto contraste e zoom 200% reais.

A falha financeira herdada foi resolvida depois; o bloqueio de release foi substituído por R09.

Consolidação: R02, R03, R09 e R11.

### S13 — Cadastros e Propriedades

Parecer: módulo aprovado; seis bloqueios na época.

Ainda aplicáveis:

1. Duas janelas editando a mesma versão de catálogo.
2. Duas edições do mesmo registro sem perda silenciosa.
3. Leitor de tela real.
4. Offline/reconexão, lock, reinício instalado, zoom e alto contraste.

Encerrados/superados:

- Regressão API financeira: **RESOLVIDA**.
- Manifesto herdado: **SUPERADO** pelo gate atual de candidato limpo.

Consolidação: R02 a R04 e R09.

### S14 — Configurações e Administração

Parecer: aprovada com ressalvas; oito bloqueios na época.

Ainda aplicáveis:

1. Entrega nativa de alertas pelo sistema operacional.
2. Autenticação/sincronização Google externa.
3. Recuperação e reinício do aplicativo instalado.
4. Narrador, alto contraste e zoom 200% reais.
5. Offline/reconexão e lock SQLite reais.
6. Candidato de release.
7. Concorrência otimista de catálogos/propriedades.

Encerrado:

- Regressão financeira herdada: **RESOLVIDA**.

A lacuna documental do relatório da Sessão 11 também foi encerrada em 17/09.

Consolidação: R02 a R04 e R07 a R09.

### S15 — Ajuda, navegação global, homologação e release

Parecer funcional: aprovado com ressalvas. Produto integrado: reprovado para release.

1. Isolamento do estado E2E e fixtures dependentes de data.
2. Reexecução integral dos 90 casos.
3. Benchmark de alta cardinalidade da pesquisa global.
4. 60 links internos literais na baseline.
5. 28 ativos visuais inconclusivos.
6. Endpoints repetidos.
7. Área histórica `temp-lovable`.
8. Dezenove ensaios de homologação humana.
9. Revisão jurídica de documentos comerciais.
10. Revisão de licenças e dependências transitivas.
11. Origem limpa, candidato, SBOM, hashes, smoke, instalação, atualização e desinstalação.
12. Authenticode ausente por decisão do proprietário; validar SmartScreen e registrar o risco aceito.

Consolidação: R01, R03 a R06, R09 e R10.

### AE01 — Backup, restauração e recuperação de desastre

Parecer: criação de backup aprovada; prontidão geral reprovada; 12 bloqueios.

1. CSV/histórico completo em todos os estados e lentidão.
2. Unidade removível, rede e sincronizador reais.
3. Corrida de espaço entre preflight e execução.
4. Arquivo mudando, bloqueado ou com permissão negada no Windows real.
5. Matriz de arquivos grandes, Unicode, extensões e nomes longos.
6. Aviso real de encerramento e fechamento do Windows.
7. Restauração e reinício do aplicativo instalado A.
8. Outro perfil/equipamento B por código e kit.
9. Energia, disco cheio, remoção e update malsucedido.
10. NVDA, Narrador e alto contraste.
11. Carga prolongada, milhares de arquivos e handles.
12. Instalação, atualização e desinstalação do mesmo hash.

Consolidação: R03 a R06, R08 e R09.

### AE02 — Relatórios financeiros, projetos e propostas em PDF

Parecer: aprovado com ressalvas; 203/203 Web, 192/192 API e 18/18 Desktop na campanha.

1. Períodos/filtros: nem todas as bordas temporais foram materializadas em PDF.
2. Orçamentos: nem todos os status aceitos viraram evidência PDF.
3. Impressão física e múltiplos drivers: bloqueados.
4. Acessibilidade documental: PDFs sem tags, idioma e título; leitor de tela real não executado.
5. Desempenho: sem repetições, mediana e SLA formal da geração.
6. Documento de 100 itens exercitado pelo gerador real, não por todos os cliques da UI.
7. Legados, múltiplos estornos/exclusões, identidade ausente/corrompida, logos inválidos, dupla geração, offline e todas as bordas não foram novamente materializados em documentos nesta campanha.

Consolidação: R03 a R06 e R11.

## 5. Itens resolvidos ou superados

Não devem ser incluídos como defeitos ativos em um prompt de correção:

1. **Falha financeira global em `financial-removal-scenarios`: RESOLVIDA.** A Sessão 15 registrou API 190/190 e a auditoria especial posterior, 192/192.
2. **Ausência do relatório final da Sessão 11: RESOLVIDA.** O relatório foi criado em 17/09.
3. **Bloqueio antigo da Configuração Inicial: RESOLVIDO como pré-condição.** A Sessão 14 aprovou a configuração inicial em ambiente descartável; jornadas específicas que dependiam dela ainda precisam de reteste próprio.
4. **Manifesto divergente dos instaladores antigos: SUPERADO.** Os arquivos foram reclassificados como históricos. O gate atual é produzir um novo candidato limpo, não consertar os hashes antigos.
5. **Defeitos funcionais explicitamente corrigidos em cada sessão:** não devem ser reabertos sem regressão reproduzível. Devem entrar apenas como testes de regressão.

## 6. Dezenove ensaios humanos obrigatórios

1. Instalação no Windows 10/11, usuário comum e caminhos com espaços/acentos.
2. Atualização de versão anterior preservando banco/documentos sintéticos.
3. Desinstalação e política de preservação/remoção.
4. SmartScreen no instalador sem Authenticode.
5. NVDA e Narrador em setup, busca, alertas, cadastros, modais e erros.
6. Jornadas somente por teclado.
7. Ordem, contenção e retorno de foco.
8. Escalas 125/150/200%, zoom 200% e reflow 320 CSS px.
9. 800×600, 1024×768 e menor resolução suportada.
10. Alto contraste real do Windows.
11. Textos, cortes e estados vazio/loading/sucesso/erro.
12. Operação offline, mapas-base, PDFs e backup.
13. Monitores com DPIs distintos.
14. Suspensão e retomada com sessão aberta/bloqueada.
15. Uso prolongado e consumo de recursos.
16. Interrupção de migração/cópia/verificação e rollback.
17. Backup, corrupção, restauração e recusa de schema futuro.
18. Recuperação em outro perfil/equipamento.
19. Revisão visual final de rotas, temas, gráficos, mapas, PDFs e diálogos.

Cada ensaio deve registrar versão, commit, SHA-256, Windows/build, escala, tema, hardware, responsável, data/hora, dados sintéticos, resultado, evidência, defeitos e reteste.

## 7. Ordem recomendada para os prompts de correção

1. **Lote A — estabilização automatizada:** R01 e testes multiprocesso controlados de R02.
2. **Lote B — decisões de produto:** política de concorrência/ETag, sincronização Google, exclusão bidirecional e identidade no Desfazer.
3. **Lote C — lacunas específicas por módulo:** S04, S05, S10, S12 e os fluxos documentais ainda parciais.
4. **Lote D — desempenho e acessibilidade documental:** pesquisa global, listas volumosas, PDF/UA e benchmarks.
5. **Lote E — recuperação de desastre:** protocolo físico A/B em VM ou equipamentos descartáveis.
6. **Lote F — homologação humana:** os 19 ensaios no candidato final.
7. **Lote G — release:** origem consolidada, gates verdes, candidato, SBOM/hashes, instalação/upgrade/desinstalação e decisão explícita de publicação.

Um único prompt não deve declarar concluídos itens que dependem de conta Google, impressora, leitor de tela, VM/equipamento B, revisão jurídica ou autorização de release. Esses itens precisam de protocolos próprios e evidência humana ou externa.

## 8. Fontes principais

- [Sessão 01](./2026-09-07-visao-geral/RELATORIO.md)
- [Sessão 02](./2026-09-07-comercial-clientes/RELATORIO.md)
- [Sessão 03](./2026-09-08-comercial-crm-funil/RELATORIO.md)
- [Sessão 04](./2026-09-10-comercial-orcamentos/RELATORIO.md)
- [Sessão 05](./2026-09-11-projetos/RELATORIO.md)
- [Sessão 06 — reauditoria mais recente](./2026-09-14-ambiental/RELATORIO.md)
- [Sessão 07](./2026-09-12-financeiro/RELATORIO.md)
- [Sessão 08](./2026-09-12-agenda-calendario/RELATORIO.md)
- [Sessão 09](./2026-09-13-agenda-tarefas/RELATORIO.md)
- [Sessão 10](./2026-09-13-topografia/RELATORIO.md)
- [Sessão 11](./2026-09-17-relatorios/RELATORIO.md)
- [Sessão 12](./2026-09-14-planejamento/RELATORIO.md)
- [Sessão 13](./2026-09-15-cadastros-propriedades/RELATORIO.md)
- [Sessão 14](./2026-09-16-configuracoes-administracao/RELATORIO.md)
- [Sessão 15](./2026-09-18-ajuda-regressao-release/RELATORIO.md)
- [Auditoria especial de backup e recuperação](./2026-09-19-backup-recuperacao-desastre/RELATORIO.md)
- [Auditoria especial de relatórios financeiros e orçamentos](./2026-09-19-relatorios-financeiro-orcamentos/RELATORIO.md)

