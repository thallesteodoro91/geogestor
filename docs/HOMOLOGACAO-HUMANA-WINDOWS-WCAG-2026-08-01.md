# Homologação humana — Windows, recuperação e WCAG 2.2 AA

Data de atualização técnica: 13/08/2026
Versão comercial de referência: 1.0 (versão técnica 1.0.0)
Candidato final: **NÃO GERADO — WORKTREE DIRTY**

Testes automatizados de código, Axe, teclado e reflow fornecem evidência parcial, mas não aprovam instalação real, leitor de tela, escalas físicas, alto contraste real ou interrupção elétrica. Todos os itens abaixo começam como `PENDENTE DE HOMOLOGAÇÃO HUMANA`.

| Área | Ensaio humano obrigatório | Evidência a registrar | Status |
|---|---|---|---|
| Instalação | Instalar em Windows 10 e 11 limpos, como usuário comum, em caminho padrão e caminho com espaços/acentos. | Vídeo, versão do Windows, logs sanitizados. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Atualização | Atualizar uma versão anterior suportada com banco/documentos sintéticos; comparar contagens e hashes lógicos. | Matriz antes/depois e backup usado. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Desinstalação | Validar menu Iniciar, atalhos, desinstalação e preservação/remoção conforme a política aprovada. | Capturas e inventário de arquivos. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| SmartScreen | Observar aviso real do instalador sem Authenticode; confirmar que nenhum material declara editor verificado. | Captura do Windows. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Leitor de tela | Percorrer setup, desbloqueio, busca, alertas, cadastros, modais e erros com NVDA e Narrador. | Registro de anúncios, nomes, estados e landmarks. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Teclado | Repetir jornadas somente com Tab, Shift+Tab, Enter, Espaço e Esc; validar retorno de foco. | Vídeo contínuo por jornada. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Ordem e retorno de foco | Abrir e fechar páginas, modais, menus e comboboxes; confirmar ordem lógica, foco inicial, contenção e retorno ao acionador. | Vídeo e identificação do elemento focado em cada transição. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Escala e zoom | Windows 125%, 150% e 200%; zoom 200%; reflow equivalente a 320 CSS px. | Capturas por rota/tema. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Resoluções pequenas | Repetir as jornadas principais em 800×600, 1024×768 e na menor resolução suportada definida pelo produto. | Capturas por rota, resolução e tema. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Alto contraste | Ativar temas reais de contraste do Windows e validar controles, foco e gráficos. | Capturas e lista de barreiras. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Conteúdo e mensagens | Revisar textos longos/curtos, estados vazios, carregamento, sucesso e mensagens de erro, confirmando orientação acionável e ausência de corte. | Capturas e lista de textos/estados avaliados. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Operação offline | Iniciar e usar os fluxos locais sem rede; validar abertura, dados locais, mapas-base indisponíveis, integrações opcionais, PDFs, backup e mensagens de recuperação. | Vídeo, estado de rede e logs sanitizados. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Monitores | Alternar entre monitores com DPI distintos; abrir/fechar diálogos. | Vídeo e DPI de cada monitor. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Suspensão | Suspender/retomar com sessão aberta e bloqueada; validar token, relógio e persistência. | Linha do tempo e logs sanitizados. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Uso prolongado | Executar ciclos comerciais, mapas, PDFs e backups por período definido pelo homologador. | CPU, memória e incidentes. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Migração/interrupção | Interromper cópia, substituição e verificação em instalações sintéticas descartáveis. | Matriz de pontos de falha e rollback. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Backup/restauração | Criar, corromper, restaurar e recusar schema futuro pela interface instalada. | Manifestos, contagens e hashes. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Recuperação | Recuperar em outro perfil e equipamento com kit sintético protegido. | Procedimento, resultado e resíduos. | PENDENTE DE HOMOLOGAÇÃO HUMANA |
| Revisão visual final | Revisar todas as rotas, temas, gráficos, mapas, PDFs e diálogos no candidato final, incluindo alinhamento, hierarquia, contraste e consistência da cópia. | Matriz de rotas/temas e capturas aprovadas pelo homologador. | PENDENTE DE HOMOLOGAÇÃO HUMANA |

## Registro mínimo por ensaio

Versão/commit/hash do instalador; estado `dirty`; versão e build do Windows; escala; tema; hardware relevante; responsável; data/hora; dados sintéticos usados; resultado observado; evidências; defeitos abertos e decisão de reteste.

## Critério de encerramento

Somente marcar um item como aprovado após executar a ação no instalador final correspondente ao hash registrado. Falha deve gerar reprodução, impacto, correção e nova execução. A ausência de Authenticode é um risco residual aceito, mas o comportamento real do SmartScreen continua pendente.
