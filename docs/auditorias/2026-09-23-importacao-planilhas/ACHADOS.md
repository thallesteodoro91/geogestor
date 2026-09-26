# Achados

> **Complemento final:** [RETESTE-FINAL-2026-09-25.md](RETESTE-FINAL-2026-09-25.md). **IMP-A11 (P1, corrigido no escopo):** CSV UTF-8 inválido era decodificado com substituição e XLSX expandido chegava ao parser sem inspeção do diretório ZIP; o frontend agora recusa esses arquivos antes da prévia. **IMP-A12 (P2, corrigido):** 20 MiB com célula gigante avançava ao mapeamento; há limite de 20.000 caracteres antes da prévia. **IMP-A13 (P2, corrigido):** descrição da etapa futura tinha contraste 2,97:1 e a prévia rolável não recebia foco em zoom CSS de 200%; os dois casos foram retestados com axe e teclado. Esses achados não homologam volumetria máxima nem acessibilidade completa.

> **Atualização de 25/09/2026:** [RETESTE-2026-09-25.md](RETESTE-2026-09-25.md) contém os resultados mais recentes e prevalece sobre contagens ou pendências antigas abaixo. A decisão atual é **NÃO IMPORTAR DADOS REAIS ATÉ CORRIGIR E RETESTAR**.

## Estado atualizado dos achados

- **IMP-A04, legado:** proteção por conteúdo vale para novas importações. O usuário confirmou que a migração antiga `skygeo_revisada.xlsx` foi feita somente para teste. O bloqueio HTTP 409 no banco atual permanece por falta de fingerprint, mas não deve ser apresentado como dúvida sobre a finalidade da planilha. Um banco novo e separado evita esse ledger; uma exceção no banco atual exigiria implementação e teste específicos. Continua **aberto para liberação de importação real**.
- **IMP-A05, cabeçalho:** seleção manual agora cobre cabeçalho vazio ou duplicado, linhas 1/2/6/20, troca de arquivo e teclado. Cabeçalho na linha 21 foi recusado com orientação. **Corrigido nos casos executados**; corpus hostil ainda pendente.
- **IMP-A06, associação:** o fluxo automático continuou válido e a escolha manual entre homônimos passou pela UI real, FK e histórico. **Corrigido nos casos executados**; estados inativo/excluído ainda pendentes.
- **IMP-A07, linha de origem:** CSV com linha vazia e campo multilinha perdia a correspondência confiável entre índice lógico e linha física em etapas subsequentes. O payload e histórico agora transportam números de origem; E2E verificou linha 3 e migração CSV [2,4]. **Corrigido nos casos executados**.
- **IMP-A08, descarte de prévia:** troca de arquivo deve invalidar mapeamento, prévia e chave de idempotência. O estado foi limpo na troca e E2E confirmou bloqueio antes da nova escolha manual. **Corrigido nos casos executados**.
- **IMP-A09, esquemas:** a lista lia apenas `localStorage` no primeiro render; cache ausente ou inválido podia ocultar um esquema já salvo no SQLite. A tela consulta o valor autoritativo ao abrir e o salvamento parte desse valor. E2E confirmou SQLite, ausência/corrupção do cache e recarga. **Corrigido após recarga nos casos executados**; reinício da API pendente.
- **IMP-A10, metadados e chaves reservadas:** a API aceitava nomes com caminho e nomes de propriedade especiais em dados parseados. A validação agora exige nome simples CSV/XLSX e rejeita `__proto__`, `constructor` e `prototype` em cabeçalho, linha ou mapeamento. Integração isolada confirmou HTTP 400 e ausência de alteração no protótipo global. **Corrigido no contrato da API**; entrada ZIP/XML e XSS na UI ainda pendentes.

O primeiro XLSX sintético de duas linhas continha uma célula vazia serializada como `inlineStr` sem texto e foi rejeitado por `read-excel-file`. A fixture foi regenerada com célula nativa vazia e passou. Isso é uma **limitação de compatibilidade a investigar**, sem evidência suficiente para classificar como defeito de planilha Excel válida.

## IMP-A01 — P1 — Hash diferente entre prévia e gravação assíncrona

- **Modo/camada:** completa, API/worker/banco; CSV e XLSX.
- **Reprodução:** prévia com `fileHash` sintético, confirmação 202, aguardar worker e repetir o mesmo conteúdo com nome diferente. Antes, o worker substituía `fileHash` por `requestDigest`, que inclui o nome; a chave do ledger não coincidia com a usada pela prévia.
- **Impacto:** a reimportação por renomeação podia deixar de ser reconhecida e produzir duplicidade.
- **Causa:** `commitFullSpreadsheetImport({ ...payload, fileHash: run.requestDigest })`.
- **Correção:** worker preserva `payload.fileHash`; histórico grava o hash declarado do arquivo em `source_hash`.
- **Reteste:** integração isolada confirmou chave `full-spreadsheet-import:<fileHash>` e prévia renomeada `already_imported`. **Corrigido dentro do contrato atual.**

## IMP-A02 — P2 — Fórmula executável no CSV de erros

- **Modo/camada:** ambos, histórico/exportação/segurança.
- **Reprodução:** mensagem de erro começando por `=HYPERLINK(...)`, `+`, `-` ou `@`; aspas CSV sozinhas não impedem avaliação por planilha.
- **Correção:** prefixo de apóstrofo antes de serializar a célula.
- **Reteste:** as quatro classes passaram na integração. **Corrigido.**

## IMP-A03 — P2 — Erro interno exposto no histórico

- **Modo/camada:** completa, worker/histórico/privacidade.
- **Reprodução:** `failImportRun` com exceção que inclui e-mail sintético; mensagem era persistida diretamente.
- **Correção:** falhas internas recebem mensagem estática acionável; `ImportRunError` mantém mensagens de contrato.
- **Reteste:** histórico do run `failed` não contém o e-mail. **Corrigido.**

## IMP-A04 — P1 — Hash original não é verificável pela API

- **Modo/camada:** completa, API/segurança/idempotência.
- **Reprodução:** o schema aceita qualquer string hexadecimal de 64 caracteres como `fileHash`; o servidor recebe linhas parseadas e não recebe os bytes do arquivo para comparar SHA-256. Alterar esse valor em prévia e confirmação pode contornar a proteção por arquivo.
- **Impacto antes:** a garantia de não duplicar conteúdo dependia de um cliente fiel.
- **Correção:** o servidor calcula uma impressão digital canônica de cabeçalhos e linhas, independente do nome do arquivo e da aba; prévia consulta os dois ledgers, e o commit reserva ambos na mesma transação. Uma colisão do ledger de conteúdo reverte também a reserva do hash declarado.
- **Reteste:** hash, nome de arquivo e nome de aba alterados com conteúdo idêntico produziram `already_imported`; commit direto foi rejeitado e não deixou ledger do hash forjado. **Corrigido para novas importações.** Ledgers anteriores à correção não contêm impressão digital do conteúdo e não puderam ser retropreenchidos sem as linhas originais; esta limitação histórica permanece declarada.

## IMP-A05 — P2 — Cabeçalho com coluna vazia pode ser trocado pela primeira linha de dados

- **Modo/camada:** ambos, CSV/XLSX, parser/UX.
- **Reprodução sintética:** `[['Cliente','Projeto','','Valor'], ['Cliente A','Projeto A','Propriedade A','1000']]` retorna índice `1` em `detectHeaderRowIndex`; esperado `0`.
- **Impacto antes:** arquivo válido podia perder a primeira linha ou apresentar mapeamento incorreto.
- **Decisão do usuário:** exigir seleção explícita da linha quando a detecção for ambígua. A seleção automática permanece nos casos sem indício de cabeçalho parcial.
- **Correção:** quando uma linha anterior à sugerida tem ao menos dois valores e uma coluna vazia, o fluxo mantém o arquivo em espera, mostra as primeiras 20 linhas e exige seleção manual antes de gerar prévia. A linha escolhida define cabeçalhos, dados, mapeamento e prévia a partir do arquivo ainda em memória.
- **Reteste:** unidade 1/1 para cabeçalho parcial e título simples; E2E CSV/Contatos e XLSX/Contatos 2/2 com importação e leads visíveis; E2E CSV/migração completa 1/1, sem prévia antes da escolha. **Corrigido nos casos reproduzidos.** Outros padrões de ambiguidade ainda precisam de corpus ampliado.

## IMP-A06 — P2 — Projeto não encontra cliente cujo nome contém números

- **Modo/camada:** simples, CSV, API/associação de projetos.
- **Arquivo sintético:** `cliente-sintetico.csv` SHA-256 `b48df89b26635d4e720cf279e7419b599dbb69ad40c3f6617f2a230da6a1e738`; `projeto-sintetico.csv` SHA-256 `759028e5500c916ffdc7533e01bf9625b300c9b74efc78771070253e086a4ff3`.
- **Reprodução:** importar cliente com nome `QA-IMPORT-20260923-2320-Cliente Simples` e projeto cuja referência é esse nome. Antes, o cliente constava ativo no SQLite, mas a prévia marcava `missing`, `pending=1`, e bloqueava a confirmação.
- **Causa:** `loadRelevantProjectClients` descartava qualquer nome do qual se pudesse extrair somente dígitos, mesmo quando a contagem não era de CPF/CNPJ. O resolvedor tratava essa mesma entrada como nome, criando divergência entre consulta e decisão.
- **Correção:** a consulta agora classifica como documento apenas referências com 11 ou 14 dígitos, como o resolvedor; nomes com outras quantidades de dígitos entram na busca por nome exato.
- **Reteste:** E2E real 1/1; dois runs simples `completed`, cliente `4e5968b2-af15-400c-a7c9-4d3216dae3f7`, projeto `b78637b6-5181-47b6-96b7-43c36ffc7979`, `cliente_id` igual ao ID criado. **Corrigido.**

## Ajustes no teste E2E

O novo teste de percurso real falhou primeiro ao clicar um checkbox visualmente estilizado; passou após uso de teclado. Depois falhou por esperar `/contatos`, embora a rota atual redirecione a `/crm?view=leads`; a expectativa foi atualizada. O teste final com fixture estável passou.
