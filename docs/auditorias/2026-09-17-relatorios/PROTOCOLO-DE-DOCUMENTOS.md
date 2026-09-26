# Protocolo de documentos

## Arquivos canônicos

| Documento | Tamanho | Páginas | SHA-256 |
| --- | ---: | ---: | --- |
| `geogestor-executivo-2026-09-18-2026-09-18.pdf` | 94.231 bytes | 3 | `03e00b108e88a430d315de12026c22edcb51245107a05160fa40984fa4eac7f8` |
| `geogestor-financeiro-2026-09-18-2026-09-18.pdf` | 68.575 bytes | 2 | `0435118b7da2b15c2b645d75aafdf218a50ee6d1ae4bc2aafd70c2e5c4f8ff4` |
| `geogestor-projetos-2026-09-18-2026-09-18.pdf` | 66.502 bytes | 2 | `0e339b82cab371b03cd87b25e4c608169e6ba57074d17b96716acd02ee0b873e` |

## Protocolo aplicado

1. download acionado na interface real e aguardado até a gravação;
2. confirmação do cabeçalho `%PDF`;
3. abertura e contagem de páginas com pypdf;
4. extração textual para verificar empresa, e-mail, período, critérios e conteúdo inerte;
5. cálculo SHA-256 e tamanho;
6. renderização de todas as páginas pelo Poppler;
7. inspeção visual de identidade, margens, cabeçalhos, rodapés, paginação, tabelas, quebras e textos longos.

## Resultado por documento

- Executivo: 3 páginas, 1.542/1.682/2.405 caracteres extraídos por página; alertas, visão financeira, operacional e critérios presentes.
- Financeiro: 2 páginas, 1.722/1.652 caracteres; resumo, composição, categorias e critérios presentes.
- Projetos: 2 páginas, 1.259/1.313 caracteres; status, agenda, municípios e critérios presentes.
- O logo válido foi renderizado junto ao nome da empresa sem sobreposição.
- Cabeçalhos de tabela se repetem e as linhas não são divididas entre páginas.
- O texto longo quebra dentro das células sem cortar a margem.
- A cadeia HTML-like permanece texto literal; nenhum conteúdo ativo é interpretado.
- Rodapés trazem paginação e data no fuso de São Paulo.

## Artefatos auxiliares

- `evidencias/protocolo-pdfs.json`: resultado estruturado das verificações.
- `evidencias/pdfs-gerados.json`: nomes capturados pelo E2E.
- `evidencias/*.txt`: texto extraído dos PDFs.
- `evidencias/pdf-renders/*.png`: as sete páginas renderizadas.

Os três PDFs intermediários de 17/09 foram removidos após a validação final; somente a versão canônica de 18/09 foi mantida.

