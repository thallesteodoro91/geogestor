# Prompt de auditoria — Sessão 10: Topografia

Você atuará como engenheiro sênior de QA full stack, especialista em topografia, geodésia, cartografia, sistemas de referência, aplicações desktop, UX, acessibilidade, integridade numérica, persistência e segurança. Sua tarefa é **AUDITAR, CORRIGIR E RETESTAR** somente a Sessão 10 do GeoGestor até obter evidências suficientes sobre tudo o que pertence ao escopo.

## Configuração da sessão

- Sessão atual: **10 — Topografia**.
- Módulo/menu: **Topografia**.
- Rota principal: **`/topografia`**.
- Ferramentas principais atuais:
  - **Conversor GMS / Decimal**;
  - **Distância e azimute**;
  - **Área e perímetro**.
- Modos do conversor:
  - GMS → decimal;
  - decimal → GMS;
  - latitude/longitude → X/Y;
  - X/Y → latitude/longitude.
- Modos de distância e polígono: coordenadas geográficas e coordenadas projetadas.
- Recursos transversais: seleção de SRC/EPSG, datum, fuso e hemisfério; favoritos e recentes; mapas; edição e histórico local de vértices; importação CSV/TXT; exportação CSV, GeoJSON, KML e DXF; relatório PDF; salvamento e reabertura de cálculos.
- Rotas de integração permitidas: opções de Clientes e Projetos apenas no modal de salvar cálculo e Auditoria apenas para comprovar persistência. Não reauditar esses módulos integralmente.
- Foco especial: exatidão dos cálculos, unidades, sinais, hemisférios, limites angulares, datum, projeção UTM, transformação de SRC, precisão, arredondamento, estabilidade numérica, geometria inválida, importação/exportação, mapas, histórico, persistência e acessibilidade.
- Relatórios anteriores obrigatórios:
  - `docs/auditorias/2026-09-07-visao-geral/RELATORIO.md`;
  - `docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md`;
  - `docs/auditorias/2026-09-08-comercial-crm-funil/RELATORIO.md`;
  - `docs/auditorias/2026-09-10-comercial-orcamentos/RELATORIO.md`;
  - `docs/auditorias/2026-09-11-projetos/RELATORIO.md`;
  - `docs/auditorias/2026-09-11-ambiental/RELATORIO.md`;
  - `docs/auditorias/2026-09-12-financeiro/RELATORIO.md`;
  - `docs/auditorias/2026-09-12-agenda-calendario/RELATORIO.md`;
  - `docs/auditorias/2026-09-13-agenda-tarefas/RELATORIO.md`.
- Implementar correções comprovadas: **SIM**.
- Implementar novas funcionalidades, novos métodos de cálculo ou mudanças de produto: **NÃO, sem aprovação expressa**.
- Diretório dos entregáveis: `docs/auditorias/[AAAA-MM-DD]-topografia/`.

## Objetivo

Validar de ponta a ponta cada aba, modo, campo, seletor, resultado, unidade, aviso técnico, mapa, vértice, modal, botão, atalho, importação, exportação, relatório e registro de histórico disponível em Topografia. Não aprove um cálculo porque o resultado parece plausível, porque o código usa uma biblioteca reconhecida ou porque a API respondeu HTTP 200. Compare cada família de resultado com um oráculo independente e rastreável, usando entradas conhecidas, tolerância declarada e precisão superior à apresentação da interface.

Comprove separadamente: interpretação da entrada, cálculo interno sem arredondamento prematuro, formatação pt-BR, unidade exibida, metadados do método/SRC, conteúdo exportado, persistência e reabertura. Corrija somente defeitos reproduzidos e pertencentes ao escopo. Depois de cada correção, execute teste automatizado focado, reteste manual integrado e regressão proporcional ao risco técnico.

## Limites funcionais e de integração

1. Os cálculos topográficos atuais são executados no frontend. O backend persiste o histórico, mas não recalcula nem certifica o resultado. Não atribua validação matemática ao servidor se ela não existir.
2. A ferramenta é apoio para conferência e memória de cálculo. Não altere textos para prometer validade registral, certificação ou substituição de responsabilidade técnica.
3. Não presuma cálculo de desnível, nivelamento, poligonal, irradiação, estação livre, fechamento angular/linear, compensação, volume, azimute astronômico, redução ao plano topográfico local ou fator combinado se essas ferramentas não existirem. Registre-as como `NÃO APLICÁVEL` ou melhoria não implementada.
4. Diferencie sempre distância geodésica/elipsoidal, distância de quadrícula/plana e distância horizontal no terreno. Não trate uma como equivalente à outra.
5. Diferencie azimute geodésico inicial em relação ao norte verdadeiro de azimute plano/de quadrícula. Convergência meridiana e fator de escala devem permanecer identificados.
6. A transformação entre SRC deve preservar a posição física. A opção **reinterpretar valores** deliberadamente mantém números e muda seu significado; ela precisa de aviso explícito e nunca deve ser confundida com transformação.
7. Os mapas-base dependem de tiles externos, mas os cálculos e a geometria local devem continuar utilizáveis offline. Não use indisponibilidade do mapa-base como prova de falha matemática.
8. DXF está disponível para X/Y projetado. GeoJSON e KML devem sair em coordenadas geográficas compatíveis com seus contratos atuais. Não habilite formatos incompatíveis sem decisão técnica.
9. O histórico atual permite salvar e reabrir, mas não oferece edição/exclusão pela interface. Marque essas ações como `NÃO APLICÁVEL` se continuarem ausentes.
10. Não adicione novos EPSG, formatos ou algoritmos sem aprovação. Se a cobertura atual for insuficiente, documente benefício, norma, esforço e risco.

## Invariantes matemáticos, geodésicos e de dados

Antes da execução, produza oráculos independentes com entradas e saídas em precisão completa. No mínimo, comprove:

- latitude válida está entre −90° e 90°; longitude válida está entre −180° e 180°;
- em ±90° de latitude e ±180° de longitude, minutos e segundos devem ser zero;
- minutos são inteiros entre 0 e 59 e segundos pertencem a `[0, 60)`;
- hemisférios N/E geram sinal positivo e S/W sinal negativo, inclusive no tratamento explícito de zero;
- sinal numérico e hemisfério textual contraditórios são rejeitados, não conciliados silenciosamente;
- GMS → decimal → GMS preserva o valor dentro da tolerância definida e normaliza eventual arredondamento de 60 segundos;
- troca entre latitude e longitude aplica limites e hemisférios corretos;
- transformação geográfica ↔ projetada faz round-trip sem trocar eixos e dentro da tolerância declarada;
- EPSG, datum, zona e hemisfério utilizados no cálculo são os mesmos apresentados e exportados;
- sugestão UTM corresponde à longitude, latitude, datum e hemisfério informados, inclusive em bordas de fuso;
- distância A→B é não negativa e igual a B→A dentro da tolerância; os azimutes não precisam ser iguais;
- pontos coincidentes produzem distância zero e azimute explicitamente indeterminado;
- azimute é normalizado no intervalo `[0°, 360°)` e atende aos quatro quadrantes e eixos cardeais;
- distância geodésica continua finita perto do antípoda e do antimeridiano;
- área e perímetro são invariantes à orientação da lista de vértices;
- área plana usa Gauss/Shoelace e perímetro plano usa distância euclidiana no SRC projetado;
- área geográfica e perímetro usam o elipsoide do datum indicado, sem projeção local oculta;
- `1 ha = 10.000 m²` e `1 km² = 1.000.000 m²`; `1 km = 1.000 m`;
- nenhum valor intermediário é arredondado antes do resultado final;
- menos de três vértices, vértice duplicado, auto-interseção, geometria degenerada ou erro espacial bloqueante não geram área/exportação como se fossem válidos;
- editar, mover, importar, reordenar ou excluir vértice recalcula mapa e métricas de forma determinística;
- desfazer/refazer restaura o estado completo correto e uma nova edição após desfazer elimina a pilha de refazer;
- exportações fecham o anel uma única vez quando o formato exigir e preservam ordem, eixos, SRC de origem e unidade;
- salvar e reabrir restaura entradas, modo e SRC, sem confiar no resultado salvo para recalcular a interface;
- cliente direto e cliente derivado de projeto não podem divergir no histórico;
- JSON legado inválido é identificado e não quebra a tela nem é reaberto como cálculo válido;
- preferências inválidas no `localStorage` retornam a um SRC seguro e conhecido.

Não use as funções de produção como único oráculo. Para cada caso, registre fonte independente, versão, método, datum/elipsoide, EPSG, ordem dos eixos, unidades, casas calculadas, tolerância absoluta/relativa e justificativa.

## Oráculos independentes obrigatórios

Use pelo menos duas referências independentes quando o resultado tiver impacto técnico. Exemplos adequados: GeographicLib/PROJ em versão registrada, QGIS configurado com o mesmo SRC, fórmulas reproduzidas em planilha de alta precisão, pontos de controle oficiais ou cálculo manual simples para figuras planas.

O oráculo deve incluir, no mínimo:

1. Conversões angulares triviais calculadas manualmente.
2. Ponto conhecido em Florianópolis no SIRGAS 2000 / UTM 22S (`EPSG:31982`) e round-trip.
3. Um ponto no hemisfério Norte brasileiro e um no Sul.
4. Pontos nos limites de dois fusos UTM e próximos ao Equador.
5. Distância/azimute São Paulo–Rio e um segmento curto conhecido.
6. Pontos coincidentes, quase coincidentes, quase antípodas e atravessando o antimeridiano.
7. Quadrado plano 10 m × 10 m, retângulo, triângulo e polígono irregular.
8. Polígono geográfico pequeno conhecido, mesma geometria invertida e geometria cruzando fuso/antimeridiano.
9. Convergência meridiana e fator de escala em ponto conhecido.
10. Conteúdo esperado de um arquivo em cada formato de exportação.

Não adote tolerância única para tudo. Defina tolerâncias coerentes com o método e separe tolerância computacional de arredondamento visual.

## Dados mínimos obrigatórios

Crie tudo somente em perfil, banco e diretórios descartáveis, com prefixo único `QA-AUDIT-S10-[DATA-HORA]-`:

1. Entradas GMS e decimais em N, S, E e W, incluindo zero, limites ±90/±180 e valores imediatamente dentro/fora.
2. Segundos fracionários com vírgula e ponto, muitos decimais e valores que arredondam perto de 60.
3. Textos de coordenada em decimal e GMS, com símbolos, espaços, letras O/W, caixa variada e contradições de sinal.
4. Pares geográficos/projetados conhecidos em SIRGAS 2000 e WGS 84, zonas UTM 18 a 25 quando aplicável e hemisférios N/S.
5. Pares de distância coincidentes, curtos, longos, cardeais, diagonais, quase antípodas e antimeridianos.
6. Polígonos plano/geográfico: triângulo, quadrado, retângulo, irregular, invertido, côncavo, duplicado, degenerado, auto-intersectante, outlier e cruzando fuso.
7. Vértices com metadados: código, descrição, altitude positiva/negativa, precisão e observações.
8. Arquivos CSV/TXT com `;`, `,` e tabulação; decimal com vírgula/ponto; com/sem cabeçalho; colunas extras/reordenadas; linhas válidas/inválidas/duplicadas.
9. Arquivos vazios, extensão maiúscula, nome longo/acentuado, tipo não permitido, acima de 2 MB, mais de 10.000 linhas e mais de 50 colunas.
10. Geometrias válidas para exportar em CSV, GeoJSON, KML e DXF e gerar relatório PDF.
11. Cliente e projetos sintéticos coerentes e divergentes para salvar histórico.
12. Um cálculo salvo de cada aba/modo, mais registros com JSON legado inválido, texto longo e datas de borda.
13. Estados de mapa online/offline, tile com falha, clipboard permitido/negado, download permitido/bloqueado, histórico vazio/lento/erro e `localStorage` válido/corrompido.
14. Volume de 10.000 linhas na importação, 100 linhas na prévia, mais de 20 cálculos no histórico e quantidade de vértices suficiente para medir responsividade, somente em ambiente descartável.

Não use coordenadas, clientes, projetos ou arquivos profissionais reais. Metadados de QA devem ser inequivocamente sintéticos.

## Regras de escopo e conduta

1. Leia integralmente todos os `AGENTS.md` aplicáveis e siga as Web Interface Guidelines do projeto.
2. Leia integralmente os nove relatórios anteriores. Reteste somente correções, integrações e riscos que afetem diretamente Topografia.
3. Da Sessão 09, mantenha como riscos herdados relevantes: leitor de tela real, gesto real de mapa/arraste, zoom/matriz visual, offline/reconexão, volume produtivo, concorrência multiprocesso SQLite e upgrade de instalação antiga.
4. Trabalhe somente nesta sessão. Abra Clientes, Projetos ou Auditoria apenas para criar opções sintéticas ou comprovar o registro salvo.
5. Não pare após planejar ou ler o código. Use a aplicação real e confronte interface, oráculo, arquivos gerados, API, SQLite e logs.
6. Todo item inventariado deve terminar como `APROVADO`, `APROVADO APÓS CORREÇÃO`, `REPROVADO`, `BLOQUEADO` ou `NÃO APLICÁVEL`, com justificativa e evidência.
7. Um teste unitário comprova a função isolada; não substitui a conferência da unidade, arredondamento, rótulo e arquivo na interface real.
8. Não altere método, datum ou tolerância apenas para coincidir com o oráculo. Primeiro determine qual contrato técnico a interface afirma executar.
9. Preserve alterações preexistentes. Registre o estado inicial do Git e não reverta trabalho de terceiros.
10. Faça correções mínimas ligadas à causa raiz. Mudança de algoritmo, cobertura EPSG ou finalidade profissional exige aprovação.
11. Melhorias não corretivas devem ser listadas separadamente por benefício, esforço e risco e não podem ser implementadas sem aprovação.
12. Envie atualizações curtas ao concluir inventário, oráculos, conversões, distância/azimute, polígonos, importação/exportação, histórico, acessibilidade, correções e regressão.

## Segurança dos dados de teste

1. Identifique banco, perfil Electron, diretório de downloads, `localStorage`, API e frontend realmente usados.
2. Detecte dados reais antes de mutar e use banco/perfil totalmente isolados.
3. Antes da primeira gravação, produza backup/snapshot verificável e registre caminho, tamanho, data e SHA-256 quando aplicável.
4. Nunca associe cálculo de teste a cliente ou projeto preexistente do usuário.
5. Arquivos de importação/exportação devem permanecer em pasta temporária exclusiva e com nomes prefixados.
6. Antes de abrir ou interpretar arquivo, valide extensão, tamanho e origem. Não execute conteúdo importado.
7. Não inclua coordenadas reais sensíveis em captura, log, fixture versionada, PDF ou relatório.
8. Ao final, remova somente cálculos, arquivos, preferências e registros sintéticos da sessão e confirme ausência de órfãos.
9. Se um defeito impedir a limpeza, não faça exclusão ampla. Registre cada resíduo, ID, tabela e caminho.

## Fase 1 — Preparação e linha de base

1. Identifique Electron, React/Vite, Leaflet, proj4, GeographicLib, pdfmake, APIs de download/clipboard, Fastify, Drizzle/SQLite e suítes aplicáveis.
2. Registre versões reais das bibliotecas matemáticas/geoespaciais e dos oráculos independentes.
3. Verifique Git, processos ativos, logs recentes e saúde da aplicação sem encerrar processos não identificados.
4. Confirme que frontend, API, SQLite, perfil Electron e pasta de downloads pertencem ao ambiente isolado.
5. Registre commit, worktree, sistema operacional, locale, fuso, viewport, zoom, tema, conectividade e SRC inicial.
6. Capture linha de base de `calculos_salvos`, `audit_logs`, Clientes/Projetos sintéticos, preferências de SRC/favoritos/recentes e arquivos temporários.
7. Crie `docs/auditorias/[AAAA-MM-DD]-topografia/` para relatório, matriz, caderno de oráculos, evidências, arquivos sanitizados e protocolo de limpeza.

## Fase 2 — Inventário obrigatório

Antes de testar, produza uma matriz contendo:

- ID do item;
- aba, modo, campo, controle, resultado, mapa, modal ou arquivo;
- entrada, unidade, método, datum, EPSG, eixo e resultado esperado;
- componente/função do frontend;
- endpoint, método, query, payload e resposta quando houver persistência;
- `localStorage`, SQLite, download, clipboard e efeitos colaterais;
- cenários positivo, negativo, limite, vazio, lento, erro, precisão e recuperação;
- tolerância e fonte do oráculo;
- situação e evidência.

Varra interface e código para localizar elementos condicionais: quatro modos do conversor, dois modos de distância/polígono, aviso de pontos coincidentes, metadados UTM, erro espacial, favoritos/recentes, sugestão de SRC, transformação/reinterpretação, marcador selecionado, editor de vértice, histórico de desfazer/refazer, prévia de importação, exportações habilitadas por modo, modal de PDF, mapa-base indisponível e cálculo legado inválido.

Inventarie, se existirem na versão auditada, pelo menos estes contratos:

- `GET /api/dados-operacionais/calculos?tipo=topografico`;
- `POST /api/dados-operacionais/calculos`;
- `GET /api/clientes/options`;
- `GET /api/projetos/options?clienteId=`;
- escrita/leitura de `geogestor:topography:spatial-reference`;
- escrita/leitura de favoritos e SRC recentes;
- downloads CSV, GeoJSON, KML, DXF e PDF;
- acesso ao clipboard;
- carregamento e repetição do mapa-base.

## Fase 3 — Rota, abas, estado e referência espacial

1. Abra `/topografia` pelo menu e por URL direta. Teste recarregar, voltar/avançar e troca rápida entre abas.
2. Percorra as três abas por clique e teclado com setas, Home e End. Confirme `tablist`, `tab`, `tabpanel`, foco e seleção.
3. Determine o que a URL preserva. Se aba/modo/SRC não forem deep-linkáveis, classifique o impacto conforme o contrato do produto, sem criar funcionalidade automaticamente.
4. Abra o configurador de SRC e percorra busca, seleção, favoritos, recentes e estado vazio.
5. Teste busca por nome, EPSG, datum, zona e hemisfério com acentos, caixa e espaços.
6. Selecione cada família disponível: SIRGAS 2000 geográfico/projetado, WGS 84 geográfico/projetado, hemisférios N/S e zonas limítrofes.
7. Confirme que preferência, favoritos e até cinco recentes persistem após recarregar/reiniciar o aplicativo e que conteúdo corrompido se recupera com segurança.
8. Troque SRC sem vértices e com vértices geográficos/projetados. Teste cancelar, transformar e reinterpretar.
9. Na transformação, compare cada vértice antes/depois com oráculo. Na reinterpretação, confirme números idênticos e aviso claro de mudança semântica.
10. Teste sugestão automática de UTM dentro/fora do Brasil, no Equador e na borda de fusos.
11. Confirme avisos para eixo invertido, Este implausível, Norte inválido, fuso/hemisfério incompatível, posição externa, múltiplos fusos e outlier.
12. Erro bloqueante deve impedir resultado/exportação; advertência deve permanecer visível sem impedir uso legítimo quando o contrato permitir.

## Fase 4 — Conversor GMS / Decimal

### GMS → decimal

1. Teste latitude e longitude nos quatro hemisférios e confirme sinal, rótulo e precisão.
2. Teste graus 0, 90 e 180 conforme o tipo; minutos 0/59; segundos 0, fracionários e imediatamente abaixo de 60.
3. Rejeite graus fracionários, minutos fracionários, negativos, 60 e vazios; segundos negativos, 60, infinitos, exponenciais indevidos e texto.
4. Em 90°/180°, minutos e segundos não zero devem ser rejeitados.
5. Troque tipo após preencher e confirme revalidação imediata e hemisfério compatível.
6. Copie o resultado e compare clipboard com valor numérico completo, não apenas o texto arredondado.

### Decimal → GMS

1. Teste sinais, zero, −0 quando representável, limites e valores imediatamente dentro/fora.
2. Verifique graus, minutos, segundos e hemisfério; faça o round-trip completo.
3. Teste vírgula/ponto decimal, espaços, muitas casas, notação científica conforme política e conteúdo inválido.
4. Use valores que arredondam segundos para 60; a apresentação deve carregar para minuto/grau em vez de exibir GMS impossível.

### Latitude/longitude ↔ X/Y

1. Teste entrada decimal e GMS com N/S/E/W/O, símbolos opcionais, espaços e caixa variada.
2. Teste contradição sinal–hemisfério, hemisfério incompatível com latitude/longitude, eixo invertido e campo parcial.
3. Compare conversão nos datums/SRC selecionados com PROJ/QGIS e execute round-trip.
4. Confira X/Este e Y/Norte, ordem dos eixos, metros, três casas exibidas e valor interno sem arredondamento prematuro.
5. Com SRC geográfico selecionado, confirme bloqueio e orientação para escolher SRC projetado.
6. Teste botão **Inverter campos**; valores trocados devem ser revalidados, não reinterpretados como válidos silenciosamente.
7. Teste **Copiar X/Y** e **Copiar latitude/longitude**, inclusive falha de permissão e fallback manual.
8. Salve e reabra um cálculo de cada um dos quatro modos e confira restauração integral.

## Fase 5 — Distância e azimute

1. Teste modo latitude/longitude com pontos conhecidos, nos dois sentidos e nos quatro quadrantes.
2. Compare distância elipsoidal e azimute geodésico inicial pelo mesmo datum em GeographicLib independente.
3. Teste pontos coincidentes, quase coincidentes, segmento curto, longa distância, quase antípoda e antimeridiano.
4. Confirme distância em metros e quilômetros, azimute em graus, arredondamentos e método apresentado.
5. Inverta origem/destino e verifique campos, alvo do mapa, distância e novo azimute.
6. Teste modo X/Y com quadrado simples, eixos cardeais, diagonais e coordenadas negativas/altas finitas.
7. Compare distância de quadrícula e azimute plano por cálculo manual independente.
8. Com SRC UTM válido, confira coordenadas geográficas derivadas, distância elipsoidal, diferença quadrícula − elipsoide, convergência em origem/destino e fatores de escala.
9. Não apresente diferença quadrícula–elipsoide como correção de terreno ou redução ao plano topográfico local.
10. Teste SRC geográfico no modo X/Y, fuso errado, hemisfério errado, X/Y invertido e Norte fora de 0–10.000.000 m.
11. No mapa, selecione alvo origem/destino, clique para posicionar, arraste marcadores e confirme atualização bidirecional dos campos/resultados.
12. Faça falhar o mapa-base e recupere-o. Campos e cálculos devem continuar funcionando offline.
13. Salve e reabra cálculo geográfico e projetado, verificando modo, pontos, SRC e resultados recalculados.

## Fase 6 — Área, perímetro e edição de vértices

1. Alterne entre latitude/longitude e X/Y; cada modo deve manter sua própria lista sem misturar unidades ou eixos.
2. Adicione vértices manualmente e pelo mapa. Teste campos vazios, limites, texto, NaN/Infinity, vírgula/ponto e valores extremos seguros.
3. Confira mínimo de três vértices, fechamento automático Vn→V1 e ausência de vértice final duplicado no estado interno.
4. Calcule triângulo, quadrado, retângulo, côncavo e irregular nos dois modos; compare área e perímetro com oráculos.
5. Inverta a orientação e altere o vértice inicial. Área absoluta e perímetro devem permanecer iguais.
6. Teste duplicidade exata e dentro/fora da tolerância, três pontos colineares, auto-interseção, arestas sobrepostas e outlier.
7. Confira bloqueio, mensagem e ação recomendada para cada geometria inválida.
8. Edite coordenadas e metadados do vértice: código, descrição, altitude, precisão e observações.
9. Teste altitude zero, negativa, decimal e inválida; textos vazios, longos, acentuados e HTML inerte.
10. Reordene vértices para cima/baixo, localize no mapa, selecione e arraste marcador. Confira índice, cor/rótulo, geometria e resultado.
11. Exclua um vértice, primeiro cancelando e depois confirmando. Faça o mesmo com **Limpar todos os vértices**.
12. Use botões e `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` para desfazer/refazer adição, edição, reordenação, importação, arraste, exclusão e limpeza.
13. Confirme limite atual de 40 estados, ausência de captura do atalho dentro de input/textarea/select e limpeza de refazer após nova alteração.
14. Compare área em m², ha e km² e perímetro em m/km, inclusive singularidade de zero e valores muito grandes/pequenos.
15. Salve e reabra polígonos geográficos/projetados com metadados e SRC.

## Fase 7 — Mapas e operação offline

1. Valide carregamento, enquadramento, zoom, pan, clique, marcadores, tooltips, linha/polígono e destaque do vértice.
2. Confirme que a transformação para visualização em WGS 84 não altera os valores originais nem o cálculo no SRC de origem.
3. Compare posição de marcador com coordenada conhecida e verifique ordem latitude/longitude.
4. Teste um ponto, dois, três, muitos pontos, geometria muito pequena, extensa, antimeridiana e fora do Brasil.
5. Teste tile lento, erro HTTP, ausência de rede, evento offline/online e botão de repetição.
6. O mapa-base indisponível deve mostrar aviso, preservar overlays e não apagar entradas.
7. Arrastar marcador é uma conveniência; todos os resultados precisam ser alcançáveis por campos e controles de teclado.
8. Verifique atribuição do provedor, contraste, foco dos controles Leaflet e ausência de armadilha de teclado.
9. Teste desmontagem/troca rápida de aba e confirme ausência de mapas, listeners, objetos URL ou callbacks órfãos.

## Fase 8 — Importação CSV/TXT

1. Importe por texto colado e por arquivo selecionado nos modos geográfico e projetado.
2. Teste detecção automática e seleção manual de `;`, `,` e tabulação.
3. Teste decimal automático, vírgula e ponto, inclusive separador de milhar ambíguo. Não aceite interpretação silenciosa incorreta.
4. Teste com/sem cabeçalho, nomes reconhecidos, cabeçalho desconhecido, colunas extras, ordem trocada e seleção manual das colunas.
5. Confira linha original, número da linha, total, válidas/inválidas, primeiras 100 exibidas e mensagens específicas.
6. Teste linhas vazias, espaços, aspas, campos ausentes, texto, coordenada fora de limite, eixo invertido e duplicidade.
7. A primeira duplicata válida deve ser preservada e as seguintes marcadas conforme tolerância documentada.
8. Teste arquivo vazio, `.CSV`/`.TXT`, nome acentuado/longo, MIME divergente, extensão indevida e falha de leitura.
9. Valide limites de 2 MB, 10.000 linhas e 50 colunas exatamente no limite e logo acima, sem congelamento.
10. Teste **Acrescentar válidas**, **Substituir pelos válidos** e **Cancelar**. Confirme que linhas inválidas nunca entram escondidas.
11. Antes de aplicar, confira incompatibilidades de SRC, fuso, hemisfério, eixos e outliers.
12. Após aplicar, confira vértices, mapa, métricas, histórico desfazer/refazer e ausência de duplicação por duplo clique.

## Fase 9 — Exportações e relatório PDF

1. Gere CSV geográfico e projetado. Confira BOM/encoding quando aplicável, CRLF, cabeçalho, ordem, precisão, separador, datum, EPSG, SRC de origem, fuso, hemisfério, unidade e timestamp.
2. Gere GeoJSON e valide JSON, `Feature`, `Polygon`, ordem longitude/latitude, anel fechado uma vez, CRS efetivo WGS 84 e metadados do SRC de origem.
3. Gere KML e valide XML, namespace, ordem longitude/latitude/altitude, fechamento do anel, caracteres especiais e metadados.
4. Gere DXF projetado e valide estrutura, `POLYLINE`, flag fechada, `VERTEX`, layer, X/Y/Z, `SEQEND`, `EOF` e metadados.
5. Confirme que DXF geográfico é bloqueado e que KML/GeoJSON projetados são transformados corretamente antes de exportar.
6. Teste nome/extensão, MIME, download cancelado/bloqueado, geração repetida e revogação do objeto URL.
7. Abra cada arquivo em ferramenta independente adequada e compare geometria, área aproximada, posição, SRC e contagem de vértices.
8. No relatório PDF, preencha título, cliente, projeto, responsável e campos opcionais; teste vazios, limites, acentos e textos longos.
9. Confira PDF: título, data, SRC, datum, fuso/hemisfério, método, coordenadas, metadados, área, perímetro, unidades, advertências, croqui e assinatura.
10. Inspecione visualmente todas as páginas: quebras, margens, texto cortado, cabeçalhos, tabela longa e croqui degenerado.
11. Extraia texto e valide valores contra o oráculo e a interface. Não aceite diferença causada por arredondamento inconsistente.
12. Simule falha no carregamento do gerador PDF e confirme mensagem/recuperação sem perder vértices ou campos.

## Fase 10 — Salvar e reabrir cálculos

1. Abra o modal em cada aba/modo e confira nome sugerido, resultado, unidade e método corretos.
2. Salve com nome obrigatório, observações opcionais, sem vínculo, somente cliente, somente projeto e ambos coerentes.
3. Teste cliente/projeto divergentes, inexistentes, removidos e UUID inválido diretamente na API.
4. Não imponha projeto do tipo Topografia se o contrato atual aceitar outro tipo; documente a regra real e eventual melhoria.
5. Teste nome/observações vazios, limites 200/4.000, espaços, acentos, emoji, HTML inerte e campos extras.
6. Teste data civil válida, inválida, 29/02, bordas e mudança de dia em `America/Sao_Paulo`.
7. Faça duas submissões rápidas e simultâneas. A interface deve evitar duplicação acidental ou declarar política explícita.
8. Confira resposta 201, SQLite, JSON de entradas/resultado, unidade, método, vínculos, timestamps e auditoria transacional.
9. Reabra cálculo de cada modo e compare todas as entradas, SRC, modo, vértices/metadados e resultado recalculado.
10. Altere a versão/shape da fixture salva e teste campos ausentes, adicionais, tipo errado e EPSG desconhecido sem quebrar a tela.
11. Insira JSON inválido em banco descartável. O item deve indicar **Dados legados inválidos** e impedir reabertura insegura.
12. Teste histórico vazio, loading, erro/repetição, mais de 20 itens, ordenação por `dataCalculo`/`createdAt` e dois itens empatados.
13. Confirme se a UI mostra apenas 20 enquanto a API retorna todos; meça impacto e não chame truncamento visual de exclusão de dados.
14. Recarregue e reinicie API/Electron para provar persistência.
15. Como não há edição/exclusão do histórico na interface atual, inventarie essas ações como `NÃO APLICÁVEL`, salvo se existirem na versão executada.

## Fase 11 — Backend, persistência, segurança e desempenho

1. Registre método, query, payload, resposta e efeito de cada endpoint usado.
2. Teste `tipo=topografico`, tipo ausente, ambiental, desconhecido, duplicado e campo extra na query.
3. No POST, teste schema estrito, tipos errados, campos extras, UUID, data real, limites e JSON nulo/primitivo/array/objeto.
4. Verifique limite efetivo do corpo e comportamento com JSON muito grande, profundo ou não serializável; não cause indisponibilidade fora do ambiente descartável.
5. Confirme validação de vínculo no servidor e derivação do cliente pelo projeto.
6. Prove atomicidade entre cálculo salvo e auditoria forçando falha transacional.
7. Confirme que `deletedAt` é respeitado na leitura e que registros legados inválidos não causam 500.
8. Verifique ordenação determinística e desempenho do GET com volume alto; a API atualmente não pagina, então não aceite travamento ou consumo ilimitado sem registrar risco.
9. Teste concorrência e lock SQLite com segurança, inclusive duas gravações e leitura durante gravação.
10. Faça testes seguros de XSS persistente, injeção em texto/JSON e manipulação de ID. Conteúdo deve permanecer inerte na UI, PDF e exportações.
11. Verifique logs e auditoria: ação, entidade, ID, resultado e ausência de coordenada sensível desnecessária.
12. Meça tempo/memória de conversão, distância, polígono com muitos vértices, importação 10.000 linhas, exportação, PDF e reabertura.
13. Procure `NaN`, `Infinity`, `-0`, overflow, cancelamento catastrófico, congelamento da UI e diferenças entre desenvolvimento/empacotado.

## Fase 12 — Usabilidade, acessibilidade e consistência visual

1. Percorra todo o módulo apenas com teclado: Tab, Shift+Tab, Enter, Espaço, setas, Home, End, Escape e atalhos de desfazer/refazer.
2. Confirme foco visível, ordem lógica, retorno após modais, contenção de foco e foco no primeiro erro.
3. Verifique nomes acessíveis, labels, instruções, unidade associada, erro por campo, `aria-live` para resultado/clipboard/importação e `aria-busy` em operações lentas.
4. Resultados e avisos não podem depender apenas de cor. SRC incompatível, geometria inválida e marcador selecionado precisam de alternativa textual.
5. Mapas e arraste devem ter alternativa por formulário/botão; imagem cartográfica não pode ser o único meio de compreender coordenadas/resultados.
6. Teste tema claro/escuro, 360, 768, 1024 e 1440 px, zoom 200%, redução de movimento, alto contraste quando disponível e textos longos.
7. Verifique rolagem horizontal controlada, corte do seletor SRC, abas, mapas, tabelas, modais, resultados, alvos de toque e estados disabled.
8. Confira contraste WCAG 2.2 AA, inclusive tons de cyan, violeta, âmbar, vermelho, texto secundário e mapa-base.
9. Confira português, símbolos ° ′ ″, sinal de menos verdadeiro quando usado, `…`, decimal pt-BR, tabular numbers e unidades SI.
10. Não use arredondamento formatado como dado de entrada ao copiar/exportar sem informar a precisão.
11. Sinalize os antipadrões do `AGENTS.md`: `transition: all`, `outline-none` sem substituto, elemento não semântico clicável, campo sem label, botão-ícone sem nome, formato fixo e `autoFocus` injustificado.
12. Execute Axe WCAG 2.2 A/AA nas três abas, configurador SRC, editor, importação, PDF, confirmação e histórico; complemente com árvore de acessibilidade e navegação manual.
13. Leitor de tela real, gesto real de arrastar marcador e comportamento de touch devem ser marcados `BLOQUEADO` se não forem efetivamente operados.

## Fase 13 — Correção e regressão

1. Antes de corrigir, reproduza o defeito e determine a causa raiz.
2. Para defeito numérico, crie teste com entrada, resultado independente, tolerância e justificativa antes da correção.
3. Adicione ou atualize teste automatizado para UI, importação, exportação, histórico ou API conforme a camada.
4. Faça a menor alteração coerente. Não troque algoritmo ou datum para mascarar erro de eixo, unidade, sinal ou formatação.
5. Não silencie advertências espaciais, não enfraqueça limites e não insira fixture especial no código de produção.
6. Rode testes focados, lint e typecheck; depois regressão de web, API, Electron, build e smoke empacotado.
7. Repita manualmente o fluxo corrigido e reconcilie interface, oráculo, arquivo, API, SQLite e auditoria.
8. Mudança de método, precisão oficial, cobertura territorial, EPSG, formato ou finalidade profissional exige aprovação expressa.

## Critério de encerramento

Não encerre enquanto houver item do inventário sem situação. Para concluir:

- três abas e todos os modos foram exercitados com entradas normais, limites e inválidas;
- cada resultado foi comparado com oráculo independente e tolerância documentada;
- SRC, datum, fuso, hemisfério, eixos, unidades e arredondamentos foram reconciliados;
- mapas, vértices, edição, reordenação, exclusão, desfazer/refazer e operação offline foram testados;
- importação CSV/TXT e quatro exportações foram abertas/validadas fora do gerador;
- relatório PDF foi inspecionado visualmente e por extração de conteúdo;
- salvamento, histórico, reabertura, vínculo, persistência e auditoria foram comprovados;
- correções foram retestadas automaticamente e na interface real;
- nenhum erro novo relevante aparece no console, rede, API ou logs;
- dados/arquivos sintéticos foram removidos e a limpeza foi comprovada;
- o diff foi revisado e não contém alterações alheias atribuídas à sessão;
- o relatório declara exatamente tudo o que ficou bloqueado ou não aplicável.

## Classificação dos achados

- **P0** — resultado técnico gravemente incorreto capaz de causar uso profissional inseguro, corrupção/perda de dados, execução de arquivo hostil ou aplicativo inutilizável.
- **P1** — erro de datum/SRC/eixo/unidade/sinal, cálculo principal fora da tolerância, exportação espacialmente incorreta, persistência corrompida ou bloqueio sério de acessibilidade.
- **P2** — validação ausente, arredondamento enganoso, aviso técnico incorreto, importação/histórico/mapa secundário quebrado ou UX bastante prejudicada.
- **P3** — problema visual/textual menor ou melhoria recomendada.

## Entregáveis obrigatórios

1. `RELATORIO.md` com resumo executivo e status real.
2. `MATRIZ-DE-COBERTURA.md` com todos os itens e situações.
3. `ACHADOS.md` com ID, gravidade, camada, rota/modo, pré-condição, passos, esperado, obtido, tolerância, evidência, causa raiz, arquivos/funções/endpoints, correção e reteste.
4. `CADERNO-DE-ORACULOS.md` com entradas, métodos, datums, EPSG, eixos, resultados independentes, tolerâncias e comparação GeoGestor.
5. `PROTOCOLO-DE-ARQUIVOS.md` com fixtures, importações, conteúdo validado de CSV/GeoJSON/KML/DXF/PDF, ferramentas usadas e limpeza.
6. Evidências: capturas, árvore de acessibilidade, logs mínimos, arquivos sanitizados, requisições/respostas e consultas, sem coordenadas sensíveis.
7. Relação de arquivos de código alterados e motivo.
8. Comandos e ferramentas de referência executados, versões e resultados exatos.
9. Contagem final de aprovados, aprovados após correção, reprovados, bloqueados e não aplicáveis.
10. Riscos residuais e itens que a Sessão 11 deve retestar.
11. Lista separada de melhorias não implementadas, priorizadas por benefício, esforço, risco e dependência normativa.
12. Confirmação da limpeza ou inventário exato dos resíduos com IDs e caminhos.

## Formato da resposta final

Comece pelo resultado real, não pelo processo. Informe:

- status da sessão: **APROVADA**, **APROVADA COM RESSALVAS** ou **REPROVADA**;
- cobertura obtida em números, por aba, modo, SRC e formato;
- defeitos encontrados por gravidade e quantos foram corrigidos;
- pendências, bloqueios e itens não aplicáveis;
- cálculos comparados, maiores desvios e tolerâncias adotadas;
- importações/exportações/PDF efetivamente validados;
- testes executados, versões dos oráculos e resultados exatos;
- confirmação de persistência, atomicidade, auditoria e limpeza;
- links para relatório, matriz, achados, caderno de oráculos, protocolo de arquivos e evidências;
- recomendação objetiva sobre iniciar ou não a **Sessão 11 — Relatórios**.

Não use frases vagas como “parece correto”, “resultado plausível”, “em geral está bom” ou “a maioria foi testada”. Use fatos, números, EPSG, datum, método, unidades, tolerâncias, IDs e evidências.
