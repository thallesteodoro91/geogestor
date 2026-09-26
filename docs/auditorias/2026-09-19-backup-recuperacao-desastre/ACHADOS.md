# Achados

## A19-01 — P1 — backup completo sem documentos

- Camada: API/serviço de backup.
- Pré-condição: raiz de documentos ausente.
- Obtido antes: bundle `type=complete` podia ser promovido contendo somente o banco.
- Esperado: falha acionável e nenhum bundle completo.
- Causa: dois `ENOENT` eram tratados como diretório vazio.
- Correção: raiz obrigatória, existente e diretório; enumeração não omite links.
- Reteste: vermelho reproduzido; integração final 1/1 verde.
- Estado: corrigido.

## A19-02 — P1 — TOCTOU entre teste isolado e restauração

- Camada: Electron/API/autorização/worker.
- Pré-condição: substituir o conteúdo do diretório mantendo o mesmo caminho/nonce.
- Obtido antes: `testedNonces` registrava somente o nonce.
- Esperado: o mesmo bundle validado deve chegar ao worker.
- Causa: ausência de identidade do conteúdo testado.
- Correção: fingerprint SHA-256 do manifesto + `COMPLETE`, ligado ao nonce e verificado antes do 202 e no worker.
- Reteste: teste unitário de fingerprint trocado + integração verde.
- Estado: corrigido.

## A19-03 — P2 — retenção confiava no manifesto

- Camada: retenção/capacidade.
- Obtido antes: `maxStorageBytes` somava `manifest.totals.bytes` manipulável.
- Esperado: decisão pelo conteúdo realmente presente.
- Correção: soma real dos arquivos e exclusão do conjunto gerenciado quando falta `COMPLETE`, existe `PENDING` ou manifesto é inválido.
- Reteste: 25 versões e manifesto com total falso; 4/4 verdes.
- Estado: corrigido.

## A19-04 — P2 — conteúdo extra não coberto

- Camada: validação do bundle.
- Obtido antes: arquivo físico extra não listado era ignorado.
- Esperado: cobertura integral pelo manifesto antes da restauração.
- Correção: inventário físico estrito, banco único, entradas/totais/hashes validados e colisões lógicas recusadas.
- Reteste: arquivo extra sintético recusado; integração verde.
- Estado: corrigido.

Totais: P0 0; P1 2 corrigidos/0 pendentes; P2 2 corrigidos/0 pendentes; P3 0.
