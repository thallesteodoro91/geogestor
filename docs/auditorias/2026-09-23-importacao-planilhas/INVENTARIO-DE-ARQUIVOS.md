# Inventário de arquivos da campanha

> **Atualização de 25/09/2026:** [RETESTE-2026-09-25.md](RETESTE-2026-09-25.md) contém os resultados mais recentes e prevalece sobre contagens ou pendências antigas abaixo. A decisão atual é **NÃO IMPORTAR DADOS REAIS ATÉ CORRIGIR E RETESTAR**.

## Fixtures acrescentadas no reteste

| Arquivo | Bytes | SHA-256 | Uso |
|---|---:|---|---|
| [contato-bom-multilinha.csv](evidencias/contato-bom-multilinha.csv) | 146 | `29428995af2312922619c333bedb9c27ccd6bc40dfde8f220ab9f847c488de5e` | BOM, `;`, linha vazia, multiline; origem física 3 |
| [clientes-homonimos.csv](evidencias/clientes-homonimos.csv) | 167 | `fa3bdf82c21c06dad191e6f52af2d19e34662b4e26f4ec8224ff5eec66903d15` | Dois clientes sintéticos de mesmo nome e CPFs distintos, sem colisão com outra fixture; linhas LF uniformes |
| [projeto-homonimo.csv](evidencias/projeto-homonimo.csv) | 87 | `5835b06b18e544e2153955ba98fd9323e9f748a47798accfa0fde5e58bc9d67a` | Projeto sintético ambíguo |
| [migracao-multilinha.csv](evidencias/migracao-multilinha.csv) | 1.049 | `286f0724ee2be8e83c161901f87d02979b1d8b516d56ae2c4a399e00d2df134d` | Migração completa de duas linhas, origem [2,4] |
| [migracao-multilinha.xlsx](evidencias/migracao-multilinha.xlsx) | 6.093 | `d4102eed1b04c73fe5ff62df27e2a512231adaca0187196bcd004536ded417de` | Migração completa de duas linhas, origem [2,3] e tipos nativos |
| [contato-esquema.csv](evidencias/contato-esquema.csv) | 81 | `35dc17448af1b1078c2c0533baba9cd44e04a7a1b321d19d87c9b165ec201c5a` | Persistência do esquema com cache ausente/corrompido |

Os dois arquivos de migração são reproduzidos por [gerar_migracao_multilinha.py](evidencias/gerar_migracao_multilinha.py) e conferidos por [oraculo_multilinha.py](evidencias/oraculo_multilinha.py). CSV da linha 21 e XLSX corrompido foram gerados em memória, sem persistir arquivo.

| Arquivo | Formato | Bytes | Linhas | SHA-256 | Uso |
|---|---|---:|---:|---|---|
| [contato-sintetico.csv](evidencias/contato-sintetico.csv) | CSV UTF-8 sem BOM, LF | 76 | 2, sendo 1 de dados | `9589c6ce76ec45a542d04ce170e091efb5213d98170ba419671d9f0e73fb8245` | E2E real aprovado |
| [contato-sintetico.xlsx](evidencias/contato-sintetico.xlsx) | XLSX, duas abas | 5.458 | Cabeçalho na linha 2 da aba de dados; 1 linha de dados | `b2633de1dd65bb5ba4bc87379fdbcfadc851a32a71876f4b9194911e35de1340` | E2E real aprovado |
| [cliente-sintetico.csv](evidencias/cliente-sintetico.csv) | CSV UTF-8 sem BOM, LF | 100 | 2, sendo 1 de dados | `b48df89b26635d4e720cf279e7419b599dbb69ad40c3f6617f2a230da6a1e738` | Cliente simples E2E aprovado |
| [projeto-sintetico.csv](evidencias/projeto-sintetico.csv) | CSV UTF-8 sem BOM, LF | 96 | 2, sendo 1 de dados | `759028e5500c916ffdc7533e01bf9625b300c9b74efc78771070253e086a4ff3` | Projeto simples E2E aprovado |
| [contato-cabecalho-ambiguo.csv](evidencias/contato-cabecalho-ambiguo.csv) | CSV UTF-8 sem BOM, LF | 94 | 2, sendo 1 de dados | `0e4dc517941ee1aece226459709da2c0bdb3b151b26778e962a00c34a38ed9f0` | Escolha manual, contato importado E2E |
| [contato-cabecalho-ambiguo.xlsx](evidencias/contato-cabecalho-ambiguo.xlsx) | XLSX, uma aba | 4.936 | Cabeçalho parcial na linha 1; 1 linha de dados | `3d25ec8f9458d3b6961b08a4682880913029e275390006c59a9f6f98c2ea04b4` | Escolha manual, contato importado E2E |
| [migracao-sintetica.csv](evidencias/migracao-sintetica.csv) | CSV UTF-8 sem BOM, LF | 749 | 2, sendo 1 de dados | `9ebbcf8b1d8c13038f2fddab80eb1563a6347ac50044a269ea4745f55307f3ca` | Migração completa E2E aprovada |
| [migracao-cabecalho-ambiguo.csv](evidencias/migracao-cabecalho-ambiguo.csv) | CSV UTF-8 sem BOM, LF | 759 | 2, sendo 1 de dados | `02c16ae0f8a9f83a86c98abb5303c4e21ae8ab6fecf6adc47ef3d3b074af0e90` | Escolha manual e prévia completa E2E, sem confirmação |

Os workbooks são reproduzíveis pelos scripts [gerar_xlsx_sintetico.py](evidencias/gerar_xlsx_sintetico.py) e [gerar_xlsx_cabecalho_ambiguo.py](evidencias/gerar_xlsx_cabecalho_ambiguo.py). Seus ZIPs podem mudar em bytes entre gerações por metadados; os hashes acima se referem aos arquivos preservados. As tentativas anteriores usaram buffers CSV temporários, não incluídos como fixtures auditáveis.
