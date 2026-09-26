# Achados — Sessão 10: Topografia

## Resultado

Foram reproduzidos **23 defeitos**: **11 P1**, **11 P2**, **1 P3** e **0 P0**. Todos os 23 foram corrigidos e retestados. A primeira suíte vermelha registrou 180 aprovações e 8 falhas; falhas adicionais surgiram nos testes integrados, no Axe, nos arquivos externos e na submissão concorrente.

| ID | Gravidade | Camada / rota | Pré-condição e passos | Esperado | Obtido antes | Causa raiz | Correção | Evidência de reteste |
|---|---|---|---|---|---|---|---|---|
| S10-001 | P2 | Conversor decimal → GMS | Informar valor cujos segundos arredondam a 60 | Carregar segundo para minuto/grau | Exibia `60″` | Arredondamento sem normalização | Carry de segundos/minutos | `topographyAdvanced.test.ts`; E2E conversor |
| S10-002 | P1 | GMS/decimal | Usar `+27 S`, grau/minuto fracionário ou sinais conflitantes | Rejeitar contradição e inteiros inválidos | Aceitava combinações contraditórias | Parser permissivo e coerção numérica | Parser localizado estrito e validação de sinal/hemisfério | 192/192 web; E2E mensagem por campo |
| S10-003 | P1 | Área / exportação | Tentar exportar polígono degenerado ou auto-intersectante | Bloquear arquivo | Arquivo era gerado | Exportador não aplicava validação geométrica | Validação obrigatória antes de exportar | `topographyExchange.test.ts` |
| S10-004 | P1 | DXF | Exportar polígono projetado fechado | 1 `VERTEX` por vértice e flag 70=1 | Primeiro vértice duplicado | Fechamento de anel aplicado também ao DXF | Fechamento somente pela flag da `POLYLINE` | DXF externo: 4 vértices/4 entradas |
| S10-005 | P1 | CSV/GeoJSON/KML/DXF | Editar código, descrição, altitude, precisão e observação; exportar | Preservar metadados e Z | Campos eram descartados | Modelo de exportação reduzido | Metadados adicionados a todos os contratos suportados | Validador externo 10/10 |
| S10-006 | P2 | Importação CSV/TXT | Arquivo vazio, colunas iguais ou vírgula ambígua | Bloquear com causa específica | Importação podia prosseguir | Inferência sem checagem de ambiguidade | Pré-condições e mapeamento estritos | `topographyImport.test.ts` |
| S10-007 | P2 | Importação CSV/TXT | Campo entre aspas contendo delimitador | Preservar conteúdo | Linha era quebrada | Split simples por delimitador | Tokenizador com aspas escapadas | `topographyImport.test.ts` |
| S10-008 | P2 | PDF | Gerar relatório com metadados de vértice | Incluir dados técnicos editados | Metadados ausentes | Definição PDF só listava coordenadas | Tabela de metadados adicionada | PDF reaberto/renderizado em 2 páginas |
| S10-009 | P1 | SRC / sugestão UTM | Longitude exatamente −30° | Selecionar fuso 26 | Selecionava fuso 25 | Fórmula de borda subtraía epsilon indevido | Fórmula UTM de intervalo semiaberto | `topographySpatial.test.ts` |
| S10-010 | P1 | Distância projetada / metadados UTM | Ponto conhecido EPSG:31982 | Fator 1.0003229671 | Desvio de 2,538×10⁻⁷ (~0,254 ppm) | Série incompleta/incorreta | Série Transversa de Mercator corrigida | Desvio final 3,7574×10⁻¹² |
| S10-011 | P1 | Distância X/Y | Norte UTM 11.000.000 m | Bloquear resultado | Distância plana permanecia visível | Métrica ignorava erro espacial bloqueante | Gate espacial aplicado antes do cálculo | E2E distância |
| S10-012 | P2 | Distância X/Y | Pontos projetados coincidentes | 0 m e azimute indeterminado | Estado inconsistente | Coincidência tratada apenas no modo geográfico | Estado explícito comum | E2E distância |
| S10-013 | P2 | Histórico / distância | Salvar e reabrir modo projetado/geográfico | Restaurar o modo original | Reabria em modo incorreto | Shape salvo não restaurava discriminante | Restauração integral e recálculo | E2E + testes de estado |
| S10-014 | P2 | Histórico / área | Abrir polígono legado malformado | Marcar inválido e não quebrar | Shape podia chegar ao estado ativo | Parser legado confiava em cast | Parser estrutural seguro | `topographyExchange.test.ts`; API 185/185 |
| S10-015 | P1 | API cálculos | POST com `null`, primitivo ou array; vínculo divergente | 400; derivar cliente coerente | Contrato aceitava JSON não objeto | Schemas JSON amplos e vínculo incompleto | Objetos estritos, derivação e rejeição no servidor | `session10-topography.integration.test.ts`; API 185/185 |
| S10-016 | P2 | API histórico | Itens empatados em data/hora | Ordem determinística | Ordem podia oscilar | Ordenação sem desempate | `createdAt`/`id` descendentes | Integração API |
| S10-017 | P2 | UI histórico | API retorna mais de 20 | Declarar recorte visual | Exibia 20 sem informar total | Slice silencioso | Texto “20 de N retornados” | Web 192/192 |
| S10-018 | P2 | Configurador SRC | Buscar `wGs 84 LATITUDE` com espaços/caixa | Encontrar WGS 84 geográfico | Busca por substring contínua falhava | Normalização não tokenizada | Busca por tokens, sem acento e sem caixa | E2E conversor/SRC |
| S10-019 | P3 | Mensagem do conversor | `+27 S` | Informar sinal positivo contraditório | Texto mencionava sinal negativo | Mensagem genérica invertida | Mensagem específica por sinal | E2E conversor |
| S10-020 | P1 | Acessibilidade | Axe nas mensagens de importação/topografia | Lista manter semântica e anunciar atualização | `<ul role="alert">` removia semântica dos `li` | Papel ARIA substituía papel nativo | `aria-live="assertive"` mantendo `<ul>` | Axe 0 violações nas três abas |
| S10-021 | P1 | Exportação GeoJSON/KML pela UI | X/Y projetado com metadados, transformar para WGS 84 e exportar | Manter atributos na geometria transformada | O core suportava, mas a UI descartava | `mapVertices` criava apenas lat/lng | Merge da posição transformada com o vértice original | E2E e validador externo |
| S10-022 | P2 | Salvar cálculo | Duplo clique rápido em confirmar | Uma gravação | Duas requisições 201 | Janela antes de `isPending` do React | Trava síncrona `useRef` até `onSettled` | E2E mantém `dblclick` e observa um item |
| S10-023 | P1 | Mapa / WCAG 2.2 | Polígono 10×10 m com marcadores próximos | Alvos ≥24 px sem sobreposição no enquadramento | Axe `target-size` serious | Zoom máximo 18 compactava 10 m em ~16–22 px | Enquadramento do polígono permite zoom 20 | Axe 0 violações no fluxo final |

## Observações técnicas

- O servidor persiste e audita o resultado, mas **não recalcula nem certifica** a matemática topográfica.
- A correção S10-010 não mudou datum, projeção ou finalidade: corrigiu a implementação do fator UTM para o contrato já declarado.
- HTML sintético permaneceu texto inerte na UI, PDF e arquivos; CSV também neutraliza início de fórmula com apóstrofo.
- Nenhum defeito permanece aberto dentro do conjunto efetivamente reproduzido. Os limites não exercidos estão na matriz como `BLOQUEADO`, e a divergência do manifesto de release está como `REPROVADO`.
