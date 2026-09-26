# Protocolo de arquivos e limpeza

## Isolamento

- Prefixo lógico: `QA-AUDIT-S10-20260913-`.
- E2E: cada execução criou banco, distribuição web, perfil e downloads em `scratch/commercial-e2e/run-<id>`, protegidos por `.geogestor-e2e-run.json`.
- API: banco descartável `scratch/session10-topography-<pid>/geogestor.db`, removido no `finally`.
- Oráculos: dependências instaladas somente em `scratch/QA-AUDIT-S10-20260913-oracles`, removidas após gerar as evidências.
- Banco real `data/geogestor.db`: 1.990.656 bytes, modificado em 2026-08-30 14:12:58 −03:00; SHA-256 antes e depois `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471`.
- Nenhum cliente, projeto, coordenada ou cálculo profissional real foi usado ou associado.

## Importação

| Caso | Resultado |
|---|---|
| Texto `;`, vírgula, tab; cabeçalho e ordem reordenada | Detectado e parseado nos testes focados |
| Decimal com ponto/vírgula e separador ambíguo | Formatos inequívocos aprovados; ambiguidade bloqueada |
| Aspas e delimitador dentro do campo | Preservado após correção |
| Linha inválida/duplicada | Exibida na prévia; a primeira válida é preservada |
| Arquivo vazio/colunas iguais/cabeçalho ambíguo | Bloqueado com mensagem específica |
| 10.000 linhas | APROVADO em 97,6871 ms na regressão final |
| Acima de 10.000 linhas | Bloqueado antes da aplicação |
| 2 MB em UTF-8 multibyte | Limite em bytes aprovado em 147,7752 ms |
| Acima de 2 MB / acima de 50 colunas | Bloqueado por pré-condição |

Seleção física de arquivo, MIME divergente e falha real de leitura ficaram `BLOQUEADO`; o fluxo integrado validado usou texto colado e os parsers unitários.

## Exportações produzidas pela interface

| Arquivo | Bytes | SHA-256 | Validação externa |
|---|---:|---|---|
| `ui-amostra.csv` | 396 | `C63AADAB0B93B6C410DBCDB2962BF359F72480F19A3DE0D5F4D53958F17C2B19` | CSV UTF-8, 8 colunas, 4 vértices, metadados, fórmula neutralizada |
| `ui-amostra.geojson` | 1.491 | `D6B9F04770D174D23D13C9FA06F08DA256108E0914C3F17A929D6F9A0C6BF8B9` | JSON/Feature/Polygon válido; 5 posições; WGS 84; metadados e altitude |
| `ui-amostra.kml` | 1.149 | `DBCAC07E4F45A77B029707FA462A2AA896F4260E46D9A7197F650AF877819159` | XML namespace KML 2.2; 5 posições; origem EPSG:31982; conteúdo escapado |
| `ui-amostra.dxf` | 473 | `7B295D0FFE3D0FF1193E99507F1C41464D9948576D75FA7EE8C2C3A98D7A9C69` | ASCII DXF, POLYLINE fechada, 4 VERTEX, X/Y/Z, SEQEND/EOF |
| `relatorio-topografia.pdf` | 27.694 | `C190C60333A3F596C3C197F9AD36B9F98E054B698D1AF3BDD58C8E99E20F5186` | pypdf 6.0.0: 2 páginas; pypdfium2 4.30.0: 2/2 renderizadas |

O validador externo registrou **10/10 verificações aprovadas** em `evidencias/validacao-arquivos-independente.json`. GeoJSON foi aberto por Shapely 2.1.2; KML por `xml.etree.ElementTree`; CSV pelo parser Python; DXF por inspeção estrutural independente; PDF por pypdf e PDFium.

### Conteúdo reconciliado

- Polígono: quadrado projetado 10×10 m, quatro vértices no EPSG:31982.
- Resultado: 100 m² = 0,01 ha = 0,0001 km²; perímetro 40 m = 0,04 km.
- GeoJSON/KML: transformação para longitude/latitude WGS 84, com anel fechado uma única vez.
- DXF: permanece X/Y projetado, camada `GEOGESTOR`, flag fechada `70=1`; DXF geográfico continua bloqueado.
- V1: código `=QA-V1`, descrição sintética com HTML inerte, altitude −1,25 m, precisão 0,02 m e observação de QA.
- CSV: código iniciado por `=` é serializado como `'=QA-V1` para reduzir risco de fórmula.
- PDF: título, cliente/projeto sintéticos, responsável, data, SIRGAS 2000, EPSG:31982/UTM 22S, método, resultados, coordenadas, metadados, croqui, advertência e assinatura.

## Inspeção visual do PDF

- Página 1: margens, título, duas colunas de metadados, resultados, tabelas, croqui e rodapé íntegros; nenhum texto cortado ou sobreposto.
- Página 2: advertência profissional, linha de assinatura, responsável e rodapé íntegros.
- Imagens: `evidencias/pdf-pagina-1.png` e `evidencias/pdf-pagina-2.png`.
- Extração: `evidencias/pdf-texto-extraido.txt`.

Não foram exercitados relatório com tabela longa/croqui degenerado, bloqueio/cancelamento de download ou falha real de carregamento do pdfmake; esses itens estão `BLOQUEADO`.

## Limpeza

- **20** execuções E2E falhas da Sessão 10, todas com marcador de propriedade válido e comando contendo `session10-topography.spec.ts`, foram removidas pelo helper seguro do próprio projeto.
- A execução E2E final aprovada removeu automaticamente sua raiz descartável.
- O ambiente isolado de oráculos foi removido após a produção das evidências.
- Verificação final: 0 raízes E2E marcadas para `session10-topography`; `scratch/QA-AUDIT-S10-20260913-oracles` ausente.
- Banco real: hash, tamanho e data inalterados.
- Resíduos intencionais: somente os arquivos sanitizados e as evidências versionáveis deste diretório.
