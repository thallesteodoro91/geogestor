# Matriz de cobertura — Sessão 10

## Convenções

- `APROVADO`: evidência final passou sem correção desta sessão.
- `APROVADO APÓS CORREÇÃO`: defeito reproduzido, corrigido e retestado.
- `REPROVADO`: verificação executada continua sem atender ao contrato.
- `BLOQUEADO`: não houve instrumento/ambiente real suficiente; não representa aprovação.
- `NÃO APLICÁVEL`: recurso não existe ou está explicitamente fora do produto atual.

As linhas agrupam variações positivas, negativas e de limite quando compartilham o mesmo contrato. `UT` = teste automatizado de núcleo; `E2E` = aplicação real com build de produção e banco/perfil descartável; `OI` = oráculo independente; `VE` = validador externo de arquivo; `API` = integração Fastify/SQLite.

## Linha de base e escopo

| ID | Item/contrato e cenários | Camada/efeito | Oráculo/tolerância | Situação | Evidência/justificativa |
|---|---|---|---|---|---|
| L01 | Nove relatórios anteriores e riscos herdados lidos | Documentação | Leitura integral | APROVADO | RELATORIOs 01–09; riscos repetidos abaixo |
| L02 | Stack, versões, commit, branch, SO, locale e fuso | Repo/runtime | Metadados reais | APROVADO | `COMANDOS-E-RESULTADOS.md` |
| L03 | Banco/perfil/downloads isolados antes de gravar | API/E2E/SQLite | Hash e marcador de propriedade | APROVADO | DB real permaneceu SHA-256 idêntico |
| L04 | Linha de base de cálculo/auditoria/opções/preferências | SQLite/localStorage | Ambiente descartável vazio | APROVADO | Cada E2E cria DB novo; `beforeEach` de evidência |
| L05 | Preservação do worktree já sujo | Git | Diff restrito | APROVADO | 234 entradas existentes preservadas; sem reset/reversão |
| L06 | Processos ativos e saúde inicial sem encerrar terceiros | Windows/API | Inspeção somente leitura | APROVADO | Nenhum processo GeoGestor identificado na linha de base |

## Rota, abas, estado e SRC

| ID | Item/contrato e cenários | Camada/efeito | Oráculo/tolerância | Situação | Evidência/justificativa |
|---|---|---|---|---|---|
| R01 | `/topografia` direta, menu e recarga | React Router | Rota canônica | APROVADO | E2E abriu URL e recarregou |
| R02 | Voltar/avançar e deep-link de aba/modo/SRC | Navegação | Contrato atual | BLOQUEADO | URL não guarda esses estados; histórico do navegador não foi operado |
| R03 | 3 abas por clique, setas, Home/End; tablist/tab/tabpanel | UI/teclado | WAI-ARIA | APROVADO | E2E + árvore de acessibilidade |
| R04 | Troca rápida de abas/desmontagem | React/Leaflet | Ausência de exceção | APROVADO | E2E serial alternou abas; sem falha/órfão observável |
| R05 | Configurador: abrir/cancelar/concluir, estado vazio | Modal/SRC | Fluxo UI | APROVADO | E2E e inspeção do componente |
| R06 | Busca por nome/EPSG/datum/zona/hemisfério, acento/caixa/espaço/tokens | UI/SRC | Correspondência normalizada | APROVADO APÓS CORREÇÃO | S10-018; busca WGS 84 exercitada |
| R07 | SIRGAS/WGS84 geográfico/projetado, zonas 18–25 e N/S do catálogo | proj4/config | EPSG/PROJ | APROVADO | UT cobre catálogo e transformações N/S |
| R08 | Favoritos, até 5 recentes, persistência por reload e corrupção | localStorage | Códigos conhecidos | APROVADO | E2E favorito/reload/corrupção + UT |
| R09 | Persistência após encerramento/reinício nativo do Electron | localStorage/Electron | Reinício real | BLOQUEADO | Reload aprovado; processo Electron real não foi reiniciado |
| R10 | Troca com/sem vértices: transformar versus reinterpretar e avisos | UI/proj4 | Preservar posição versus números | APROVADO | UT de lote + revisão/E2E da transformação; textos distinguem operações |
| R11 | Sugestão UTM Brasil, fora, Equador e borda de fuso | SRC | Fórmula UTM + PROJ | APROVADO APÓS CORREÇÃO | S10-009; borda −30° corrigida |
| R12 | X/Y invertido, Este/Norte inválidos, fuso/hemisfério, outlier | Validação espacial | Faixas UTM | APROVADO | UT espacial; E2E Norte 11.000.000 bloqueado |

## Conversor GMS / Decimal e coordenadas

| ID | Item/contrato e cenários | Camada/efeito | Oráculo/tolerância | Situação | Evidência/justificativa |
|---|---|---|---|---|---|
| C01 | GMS→decimal N/S/E/W, zero e sinais | `topography.ts` | Fórmula manual, 1×10⁻¹²° | APROVADO APÓS CORREÇÃO | S10-002; UT |
| C02 | Limites 0/90/180, min 0/59, seg `[0,60)` | Parser/validação | Invariantes angulares | APROVADO | UT de borda |
| C03 | Graus/minutos fracionários, negativos, 60, vazio; NaN/Infinity/expo/texto | Parser | Política estrita | APROVADO APÓS CORREÇÃO | S10-002; 192/192 web |
| C04 | Extremos 90°/180° exigem minuto/segundo zero | Validação | Invariante angular | APROVADO | UT |
| C05 | Troca latitude/longitude e hemisfério compatível | UI | Limites 90/180 | APROVADO | UT + E2E navegação dos quatro modos |
| C06 | Clipboard permitido copia valor completo | Clipboard | Valor interno | APROVADO | E2E leu `-27.5945` do clipboard |
| C07 | Clipboard negado e fallback manual | Clipboard/UI | Permissão real negada | BLOQUEADO | Não se revogou permissão durante o fluxo |
| C08 | Decimal→GMS ponto/vírgula, espaços, muitas casas e −0 | Parser/formatação | Round-trip 1×10⁻¹⁰° | APROVADO APÓS CORREÇÃO | E2E `-0`→S; UT localizado |
| C09 | Carry de segundos arredondados a 60 | Formatação | GMS válido | APROVADO APÓS CORREÇÃO | S10-001 |
| C10 | Lat/lon→X/Y EPSG:31982: eixo, metro, 3 casas/UI e precisão interna | proj4/UI | PROJ, 1 µm | APROVADO | E2E 742.003,210 / 6.945.275,215; OI |
| C11 | X/Y→lat/lon e round-trip SIRGAS/WGS84 N/S | proj4 | PROJ, 1×10⁻¹⁰° | APROVADO | 37/37 comparação |
| C12 | Texto GMS/decimal com símbolos, W/O, caixa e contradições | Parser | Fórmula manual | APROVADO APÓS CORREÇÃO | S10-002 |
| C13 | SRC geográfico bloqueia conversão X/Y; campos parciais/eixos invertidos | UI/validação | Contrato espacial | APROVADO | UT espacial + revisão de UI |
| C14 | Botão inverter campos revalida valores | UI | Limites por eixo | APROVADO | Revisão de estado e cobertura estrutural |
| C15 | Salvar/reabrir separadamente os 4 modos do conversor | Histórico | Restauração integral | BLOQUEADO | Persistência E2E cobriu polígono; shapes dos modos por UT/revisão, não 4 saves UI |

## Distância e azimute

| ID | Item/contrato e cenários | Camada/efeito | Oráculo/tolerância | Situação | Evidência/justificativa |
|---|---|---|---|---|---|
| D01 | São Paulo↔Rio geodésico GRS80/Karney | GeographicLib/UI | 1 µm; 1×10⁻⁹° | APROVADO | E2E + OI 361260,861146 m |
| D02 | Quatro quadrantes, cardeais e normalização `[0,360)` | Geodésico/plano | Fórmula manual | APROVADO | UT de azimute/plano |
| D03 | Coincidente: 0 m e azimute indeterminado | UI/core | Invariante | APROVADO APÓS CORREÇÃO | S10-012; E2E |
| D04 | Quase coincidente e segmento curto | GeographicLib | 1 µm; az 0,001° | APROVADO | OI; maior desvio 9,07×10⁻⁵° |
| D05 | Quase antípoda e antimeridiano finitos | GeographicLib | 1 µm; 1×10⁻⁹° | APROVADO | OI/UT Karney |
| D06 | Metros/km, graus, método e arredondamento pt-BR | UI | Precisão visual declarada | APROVADO | E2E 361,261 km / 79,31° |
| D07 | Inverter A/B preserva distância e recalcula azimute | UI | Simetria da distância | APROVADO | E2E |
| D08 | X/Y eixos/cardinais/diagonais/negativas/altas finitas | Plano | Euclides/atan2 | APROVADO | E2E 10 m/90° + UT |
| D09 | Geodésica derivada, diferença de quadrícula, convergência e escala | UTM/UI | PROJ; 1e-5°/1e-9 | APROVADO APÓS CORREÇÃO | S10-010; OI |
| D10 | Erro espacial bloqueia cálculo projetado | UI/validação | Faixas UTM | APROVADO APÓS CORREÇÃO | S10-011; E2E |
| D11 | Salvar/reabrir geográfico e projetado | Histórico | Recálculo, não resultado salvo | APROVADO APÓS CORREÇÃO | S10-013; shape/UT; E2E persistência projetada em polígono |

## Área, perímetro e vértices

| ID | Item/contrato e cenários | Camada/efeito | Oráculo/tolerância | Situação | Evidência/justificativa |
|---|---|---|---|---|---|
| P01 | Listas geográfica/projetada independentes | Estado React | Unidade/eixo separados | APROVADO | Estrutura do componente + UT de estado |
| P02 | Adição manual: vazio/texto/NaN/Infinity/ponto/vírgula/extremos | Parser/UI | Política estrita | APROVADO | UT parser/espacial |
| P03 | Mínimo 3, fechamento Vn→V1 e sem duplicata interna | Geometria | Invariante | APROVADO | UT + E2E 4 vértices |
| P04 | Quadrado, retângulo, triângulo e irregular projetados | Gauss/Euclides | 1×10⁻⁴ m² | APROVADO | OI 4 figuras, desvio 0 |
| P05 | Côncavo e mudança do vértice inicial | Geometria | Gauss/Euclides | APROVADO | UT topologia/orientação |
| P06 | Polígono geográfico pequeno e invertido | GeographicLib/GRS80 | 1×10⁻⁴ m² | APROVADO | OI, desvio 5,96×10⁻⁸ m² |
| P07 | Geográfico atravessando antimeridiano e invertido | GeographicLib/GRS80 | 1×10⁻⁴ m² | APROVADO | OI, desvio 0 |
| P08 | Duplicado, colinear/degenerado, auto-interseção/arestas | Shapely + validação | Topologia exata/tolerância | APROVADO APÓS CORREÇÃO | Exportação inválida bloqueada; UT |
| P09 | Outlier e múltiplos fusos | Validação espacial | Faixa/aviso | APROVADO | UT/revisão |
| P10 | Editar metadados, altitude −/0/decimal/inválida, acento/HTML/texto longo | Editor/UI | Contrato dos campos | APROVADO APÓS CORREÇÃO | E2E V1; PDF/arquivos externos |
| P11 | Reordenar, localizar, selecionar, mover e excluir vértice | UI/mapa | Recalcular determinístico | APROVADO | UT de undo/reorder + controles acessíveis; gesto físico abaixo |
| P12 | Cancelar/confirmar exclusão e limpar todos | Modal/UI | Confirmação destrutiva | BLOQUEADO | Fluxos não foram percorridos visualmente nesta execução |
| P13 | Desfazer/refazer botões, nova edição limpa redo, limite 40 | Estado | Máquina de estados | APROVADO | UT + E2E botões |
| P14 | Ctrl/Cmd+Z e Shift+Z fora/dentro de campos | Teclado | Não capturar edição de input | APROVADO | UT estrutural/handlers; gesto E2E por botões |
| P15 | m²/ha/km² e m/km, valores pequenos/grandes | Formatação | Conversões SI exatas | APROVADO | E2E 100 m²/0,0100 ha/40 m + UT |
| P16 | Salvar/reabrir polígono projetado com metadados/SRC | UI/API/SQLite | Recálculo integral | APROVADO | E2E duplo clique + reabertura |

## Mapas e offline

| ID | Item/contrato e cenários | Camada/efeito | Oráculo/tolerância | Situação | Evidência/justificativa |
|---|---|---|---|---|---|
| M01 | Carregamento, fit, zoom, marcadores, tooltip, linha/polígono | Leaflet/UI | Inspeção visual/E2E | APROVADO APÓS CORREÇÃO | S10-023; capturas 01–03 |
| M02 | Transformação visual WGS84 não muda originais/cálculo | proj4/estado | PROJ | APROVADO APÓS CORREÇÃO | S10-021; export e UI preservam original |
| M03 | Posição conhecida e ordem lat/lon | Leaflet/proj4 | PROJ 1 µm | APROVADO | E2E Florianópolis |
| M04 | Um, dois, três, muitos e geometria pequena | Leaflet | Enquadramento | APROVADO APÓS CORREÇÃO | 10×10 m agora zoom 20; estados 1/2/3 revisados |
| M05 | Geometria extensa, antimeridiana e fora do Brasil no mapa | Leaflet | Operação real | BLOQUEADO | Matemática coberta; renderização cartográfica desses extremos não foi operada |
| M06 | Tile lento/HTTP, offline→online e botão repetir | Rede/Leaflet | Falha/recuperação real | BLOQUEADO | E2E abortou tiles e disparou offline; não cobriu lento/reconexão/retry |
| M07 | Offline preserva campos, cálculo e overlays | UI | Independência do mapa-base | APROVADO | E2E mostrou “Mapa-base indisponível” com cálculo local |
| M08 | Clique e arraste real de origem/destino/vértice | Mouse/touch | Gesto físico | BLOQUEADO | Alternativas por campos/botões existem; gesto real não operado |
| M09 | Atribuição, foco Leaflet e ausência de armadilha | Acessibilidade | Axe/árvore | APROVADO | Axe final sem violação nos estados exercitados |

## Importação CSV/TXT

| ID | Item/contrato e cenários | Camada/efeito | Oráculo/tolerância | Situação | Evidência/justificativa |
|---|---|---|---|---|---|
| I01 | Texto colado geográfico/projetado; `;`, `,`, tab | Parser/UI | Fixtures sintéticas | APROVADO | UT + E2E projetado |
| I02 | Seleção física `.CSV`/`.TXT`, nome longo/acentuado, MIME e falha leitura | File input | Navegador/SO | BLOQUEADO | Limites no código; arquivo físico não selecionado no E2E final |
| I03 | Decimal ponto/vírgula e milhar ambíguo | Parser | Interpretação única | APROVADO APÓS CORREÇÃO | S10-006 |
| I04 | Com/sem cabeçalho, desconhecido, extras, ordem e seleção manual | Parser/preview | Mapeamento explícito | APROVADO | UT |
| I05 | Linha original/número, totais, 100 exibidas, mensagens | Preview | Contrato UI | APROVADO | UT/estrutura; volume sintético |
| I06 | Vazias, espaços, aspas, ausentes, texto, fora de limite/eixo | Parser | Rejeição específica | APROVADO APÓS CORREÇÃO | S10-007 + UT |
| I07 | Duplicata: preservar primeira válida | Topologia/import | Tolerância documentada | APROVADO | UT |
| I08 | Vazio, extensão indevida, acima 2 MB/10.000/50 colunas | Pré-condições | Bytes/contagens | APROVADO APÓS CORREÇÃO | UT exato/no limite |
| I09 | Exatamente 10.000 linhas e 2 MB UTF-8 | Desempenho | Limites do produto | APROVADO | 97,6871 ms e 147,7752 ms |
| I10 | Acrescentar/substituir/cancelar e inválidas não entram | Preview/estado | Estratégia explícita | APROVADO | E2E substituir + UT |
| I11 | Compatibilidade de SRC/fuso/hemisfério/outlier antes de aplicar | Validação | Faixas espaciais | APROVADO | Gate espacial compartilhado |
| I12 | Aplicar recalcula e suporta undo/redo sem duplo clique | Estado/UI | Determinismo | APROVADO | E2E + UT |

## Exportações e PDF

| ID | Item/contrato e cenários | Camada/efeito | Oráculo/tolerância | Situação | Evidência/justificativa |
|---|---|---|---|---|---|
| E01 | CSV geográfico/projetado: encoding, CRLF, header, ordem, precisão, SRC/unidade | Download/core | Parser externo | APROVADO APÓS CORREÇÃO | VE 10/10; metadados preservados |
| E02 | GeoJSON Feature/Polygon, lon/lat, WGS84, anel e origem | Download/core | JSON+Shapely | APROVADO APÓS CORREÇÃO | 5 posições; EPSG:31982→4326 |
| E03 | KML 2.2, lon/lat/Z, caracteres especiais, anel e origem | Download/core | XML ElementTree | APROVADO APÓS CORREÇÃO | 5 posições, conteúdo escapado |
| E04 | DXF POLYLINE/flag/VERTEX/layer/X/Y/Z/SEQEND/EOF | Download/core | Inspeção DXF | APROVADO APÓS CORREÇÃO | 4 VERTEX; S10-004 |
| E05 | DXF geográfico bloqueado; GeoJSON/KML projetados transformados | UI/core | Contrato de formato | APROVADO APÓS CORREÇÃO | S10-021; UT/E2E |
| E06 | Nome/extensão/MIME, repetição e revogação Object URL | Browser | Contrato download | APROVADO | E2E quatro downloads sequenciais; revisão do handler |
| E07 | Download cancelado/bloqueado | Browser/SO | Permissão real | BLOQUEADO | Não foi possível impor diálogo/bloqueio do SO no runner |
| E08 | Reabertura externa dos quatro formatos | Arquivos | CSV/JSON/XML/DXF | APROVADO | `validacao-arquivos-independente.json` 8 checks não-PDF |
| E09 | PDF campos, acentos, SRC/método/resultados/coordenadas/metadados/croqui/assinatura | pdfmake | pypdf + visual | APROVADO APÓS CORREÇÃO | 2 páginas; texto extraído e PNGs |
| E10 | PDF vazio/limites/texto longo/tabela longa/croqui degenerado | pdfmake/layout | Inspeção todas páginas | BLOQUEADO | Documento nominal aprovado; extremos de layout não gerados |
| E11 | Falha de carregamento do pdfmake e recuperação | Lazy import/UI | Falha injetada | BLOQUEADO | Não houve injeção no loader |

## Histórico, backend, SQLite e segurança

| ID | Item/contrato e cenários | Camada/efeito | Oráculo/tolerância | Situação | Evidência/justificativa |
|---|---|---|---|---|---|
| H01 | Modal: nome sugerido, unidade, método e resultado | UI | Estado ativo | APROVADO | E2E polígono + cobertura estrutural |
| H02 | Sem vínculo, cliente, projeto e ambos coerentes | API/SQLite | Contrato de vínculo | APROVADO APÓS CORREÇÃO | API deriva cliente pelo projeto |
| H03 | Divergente/inexistente/removido/UUID inválido | API | 400/404 | APROVADO APÓS CORREÇÃO | Integração API descartável |
| H04 | Tipo do projeto não restringido a Topografia | API | Regra real | APROVADO | Documentado; nenhuma regra nova criada |
| H05 | Nome 200/observação 4.000, vazio/espaço/acento/emoji/HTML/campo extra | UI/API | Zod strict/limites | APROVADO | UT/API; HTML E2E permaneceu inerte |
| H06 | Data civil, bordas, 29/02 inválido e America/Sao_Paulo | API/UI | Calendário real | APROVADO | API rejeitou 2026-02-29; Intl `en-CA` com fuso explícito |
| H07 | Duas submissões rápidas | UI/API | Um registro | APROVADO APÓS CORREÇÃO | S10-022; E2E `dblclick`, uma POST |
| H08 | 201, JSON, unidade/método/vínculos/timestamps e auditoria | Fastify/SQLite | Consulta direta | APROVADO | Integração API |
| H09 | Atomicidade cálculo + auditoria com falha forçada | Transação | Rollback integral | APROVADO | API retornou 500 controlado e não persistiu cálculo |
| H10 | Reabertura restaura entradas/modo/SRC/metadados e recalcula | UI | Não confiar no resultado salvo | APROVADO APÓS CORREÇÃO | E2E + parsers legados |
| H11 | Shape legado ausente/adicional/tipo errado/EPSG desconhecido | UI/API | Parser estrutural | APROVADO APÓS CORREÇÃO | S10-014/S10-015 |
| H12 | JSON inválido/primitivo/array marcado e não reaberto | API/UI | Objeto estrito | APROVADO APÓS CORREÇÃO | Integração API |
| H13 | Histórico vazio/loading/erro/retry/lento | React Query | Estados reais | BLOQUEADO | Vazio/loading estrutural; erro/lento/retry não injetados no E2E |
| H14 | >20, recorte visual e total; ordenação/empate | UI/API | Ordem determinística | APROVADO APÓS CORREÇÃO | S10-016/S10-017; volume via API/revisão |
| H15 | Recarregar e reiniciar API/Electron | Persistência | Processo real | BLOQUEADO | Reload E2E aprovado; restart nativo não executado |
| H16 | `GET ?tipo=topografico`, ausente/ambiental/desconhecido/duplicado/extra | API | Zod strict | APROVADO | Integração e suíte API |
| H17 | POST null/primitivo/array/objeto, extra, data e UUID | API | Zod strict | APROVADO APÓS CORREÇÃO | S10-015 |
| H18 | Corpo muito grande/profundo/não serializável | Fastify | Limite efetivo | BLOQUEADO | Não submetido para evitar indisponibilidade fora de prova dedicada |
| H19 | `deletedAt`, legado inválido e ausência de 500 | API | Consulta direta | APROVADO APÓS CORREÇÃO | Integração API |
| H20 | Concorrência SQLite multiprocesso/leitura durante escrita | SQLite | Dois processos reais | BLOQUEADO | Risco herdado; apenas dupla submissão UI e transação foram cobertas |
| H21 | XSS/injeção textual/JSON/ID | UI/API/arquivos | Conteúdo inerte/strict | APROVADO | HTML inerte; CSV protegido; UUID/schema estritos |
| H22 | Logs/auditoria sem coordenada sensível desnecessária | API | Audit row mínimo | APROVADO | Consulta `audit_logs`; cálculo registra entidade/ID/ação |

## Desempenho, acessibilidade, regressão e itens ausentes

| ID | Item/contrato e cenários | Camada/efeito | Oráculo/tolerância | Situação | Evidência/justificativa |
|---|---|---|---|---|---|
| Q01 | NaN/Infinity/−0/overflow e estabilidade | Core/UI | Invariantes numéricos | APROVADO APÓS CORREÇÃO | Parsers estritos, −0 preservado, Karney em extremos |
| Q02 | Import 10k e geoespacial 500k vértices | Perf | Cronometragem | APROVADO | 97,6871 ms; benchmark 88,94 ms/37.589.016 B |
| Q03 | Volume produtivo de histórico/export/PDF e memória prolongada | App real | Perfil de produção | BLOQUEADO | Bench sintético não substitui volume produtivo |
| Q04 | Teclado, foco, labels, live regions, unidades e estados não só por cor | UI | WCAG 2.2 A/AA | APROVADO APÓS CORREÇÃO | Árvores + Axe nas 3 abas; S10-020/S10-023 |
| Q05 | Leitor de tela real | Windows assistivo | NVDA/Narrator real | BLOQUEADO | Risco herdado obrigatório |
| Q06 | Touch e arraste real | Hardware/OS | Gesto real | BLOQUEADO | Risco herdado obrigatório |
| Q07 | 360/768/1024/1440, zoom 200%, claro/escuro, alto contraste, reduced motion | Visual/nativo | Matriz de dispositivos | BLOQUEADO | Capturas em viewport padrão; matriz não executada |
| Q08 | Português, °′″, menos, `…`, pt-BR, SI e tabularidade | Conteúdo/UI | Revisão/E2E | APROVADO | Capturas e textos finais |
| Q09 | Anti-padrões AGENTS.md no diff da sessão | Código | rg/ESLint/revisão | APROVADO | Lint exit 0; controles têm semântica/foco |
| Q10 | Regressão web/API/Electron/build/smoke | Repo/pacote | Exit 0 | APROVADO | 192+185+18, build e smoke verdes |
| Q11 | Manifesto oficial do candidato de release | Release | SHA-256/tamanho | REPROVADO | Manifesto cita 1.0.2/1.0.3 ausentes e hash/tamanho 1.0.4 divergentes |
| Q12 | Upgrade sobre instalação antiga | Electron/installer | Máquina com versão anterior | BLOQUEADO | Risco herdado; não instalado sobre perfil legado |
| N01 | Recalcular/certificar resultado no backend | Produto atual | Limite explícito | NÃO APLICÁVEL | Backend apenas persiste |
| N02 | Editar/excluir histórico pela UI | Produto atual | Ausência confirmada | NÃO APLICÁVEL | Somente salvar/reabrir |
| N03 | Nivelamento, desnível, estação livre e irradiação | Produto atual | Ausência confirmada | NÃO APLICÁVEL | Nenhuma funcionalidade criada |
| N04 | Poligonal, fechamento angular/linear e compensação | Produto atual | Ausência confirmada | NÃO APLICÁVEL | Nenhuma funcionalidade criada |
| N05 | Volume e azimute astronômico | Produto atual | Ausência confirmada | NÃO APLICÁVEL | Nenhuma funcionalidade criada |
| N06 | Plano topográfico local e fator combinado | Produto atual | Ausência confirmada | NÃO APLICÁVEL | A diferença quadrícula–elipsoide não foi renomeada |
| N07 | Novos EPSG/formatos/algoritmos | Escopo | Sem aprovação de produto | NÃO APLICÁVEL | Catálogo/algoritmos atuais preservados |

## Contagem

A contagem abaixo é gerada pela classificação das linhas desta matriz e deve permanecer reconciliada com o relatório executivo:

- **APROVADO: 68**
- **APROVADO APÓS CORREÇÃO: 36**
- **REPROVADO: 1**
- **BLOQUEADO: 21**
- **NÃO APLICÁVEL: 7**
- **Total: 133 itens**
