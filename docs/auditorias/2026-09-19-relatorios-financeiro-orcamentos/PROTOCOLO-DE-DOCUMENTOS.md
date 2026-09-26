# Protocolo de documentos

## Conjunto auditado

| Documento | Origem | Páginas | Bytes | SHA-256 |
|---|---|---:|---:|---|
| Proposta emitida ORC-2026-0001 v1 | Interface | 3 | 36.254 | `fe8d15ffc0be6b63b223c05dffdb4eeb34e44bd7556900332895b0337ff494f7` |
| Proposta rascunho v1 | Interface | 3 | 36.629 | `fc9fdcf0b9d9ec3b4a073da612d4fc78122966e9779b88f1bef7c043993ce3d6` |
| Relatório executivo | Interface | 3 | 94.260 | `8311ed87d1edee3c89953d2f3ab79085e29b993bdc13b030a8eba99eb911766f` |
| Relatório financeiro | Interface | 2 | 68.571 | `0e734a4ff4431fa41938eecfb6c344bf29112b3caf6081974dbd08d2f816f701` |
| Relatório de projetos | Interface | 2 | 66.525 | `f815a65ea518f9be7ded4fc6ac014a90ad07bb48c63fcda7b1f720975191dc38` |
| Proposta emitida com 100 itens | Gerador real | 16 | 97.608 | `63cbc714a0fe230d25b8979abb98ecfe92934c6b6ebd11a7036602d50cbb2736` |
| Proposta rascunho com 100 itens | Gerador real | 16 | 100.004 | `5ad649b1dcbae8db8777137d0cfa23cde85bfc1d41ffc3a949ed4f5a5c368706` |

Total: **7 PDFs e 45 páginas**.

## Controles aplicados

- Cabeçalho `%PDF-1.3` e abertura com `pypdf` em modo estrito.
- Tamanho A4 em todas as páginas, com tolerância de 2 pontos.
- Texto extraível e não vazio em 45/45 páginas.
- Renderização em 2× com PDFium em 45/45 páginas.
- Inspeção visual de 13 folhas de contato cobrindo todas as páginas.
- Busca de dados internos semeados no texto, bytes e metadados.
- Busca por JavaScript, ações de abertura, lançamento, anexos e formulários ativos.
- Conferência da marca d’água em todas as páginas de rascunho e ausência nos emitidos.
- Conferência de repetição de cabeçalhos, continuidade de tabelas, rodapés, numeração e área de assinatura.

Resultado estrutural: **7/7 aprovados**.  
Resultado visual: **45/45 páginas sem defeito material**.  
Resultado de acessibilidade: **texto extraível, mas 0/7 PDFs marcados; 0/7 com idioma e título**.

O protocolo legível por máquina está em `evidencias/protocolo-pdfs.json`; o texto extraído está em `evidencias/pdf-texto`; as páginas renderizadas estão em `evidencias/renderizados`; as folhas de contato estão em `evidencias/folhas-de-contato`.

`qpdf` não estava disponível no ambiente. A validação foi feita por dois leitores independentes disponíveis: pypdf (estrutura/texto) e PDFium (renderização).

