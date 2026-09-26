# Segurança e privacidade

> **Atualização de 25/09/2026:** [RETESTE-2026-09-25.md](RETESTE-2026-09-25.md) contém os resultados mais recentes e prevalece sobre contagens ou pendências antigas abaixo. A decisão atual é **NÃO IMPORTAR DADOS REAIS ATÉ CORRIGIR E RETESTAR**.

O bloqueio de ledger legado passou em prévia e commit direto com HTTP 409; não há exceção silenciosa ou hash retropreenchido. XLSX com bytes corrompidos foi recusado antes da prévia no E2E. Fórmulas de texto permaneceram inertes no parser CSV. ZIP/XML expansivo, path traversal, XSS e prototype pollution ainda não foram testados de ponta a ponta. Nenhum arquivo real foi aberto. **Decisão de segurança: BLOQUEADA.**

**Complemento:** a API agora rejeita metadado de arquivo com separadores de caminho, unidade Windows ou extensão diferente de CSV/XLSX. Cabeçalhos, linhas e mapeamentos com nomes de propriedades reservadas de JavaScript também recebem 400. A integração isolada cobriu as rejeições e confirmou que o protótipo global permaneceu intacto. Isso não prova proteção contra ZIP/XML expansivo nem XSS na interface.

- CSV de erros: aspas, ponto e vírgula e quebra de linha continuam serializados; células com início `=`, `+`, `-` ou `@`, inclusive após espaços, recebem apóstrofo. Asserções de integração passaram.
- Histórico de execução: `failImportRun` não persiste mais mensagem arbitrária de exceção. E-mail sintético foi usado como sentinela e não apareceu na resposta.
- Hash do arquivo: a API valida sintaxe de 64 hexadecimais, mas não possui os bytes originais para comprovar o SHA-256 bruto. Uma impressão digital canônica dos dados parseados passou a impedir reimportação de conteúdo idêntico com hash forjado em novas execuções. Ledgers antigos não têm essa chave adicional.
- Fórmulas, macros, OLE, links, XML/ZIP hostil, path traversal e XSS não receberam campanha integrada nesta rodada. Os XLSX ensaiados eram sintéticos e não continham conteúdo ativo. Nenhuma planilha real foi aberta.
- Logs e evidências desta campanha não incluem linha real de usuário; falhas E2E preservadas temporariamente foram removidas após análise, mantendo apenas descrição sanitizada.

**Veredito de segurança: BLOQUEADA para dados reais**, pela matriz hostil e compatibilidade de ledgers antigos ainda não comprovadas.
