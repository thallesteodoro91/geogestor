# Segurança e confidencialidade

## Dados sentinela

Os fixtures incluíram deliberadamente marcadores que jamais deveriam chegar ao documento do cliente: `CONTEUDO_INTERNO`, `CUSTO_INTERNO`, `CONTA_INTERNA`, `CONTA_FINANCEIRA`, `SIGILO_INTERNO`, `MARGEM_INTERNA`, `MARKUP_INTERNO` e `CONFIDENCIAL-QA`.

Resultado: nenhum marcador foi encontrado no texto extraído, nos bytes brutos ou nos metadados dos sete PDFs.

## Conteúdo ativo e injeção

- Nenhum PDF continha `/JavaScript`, `/JS`, `/Launch`, `/EmbeddedFile`, `/OpenAction` ou `/AcroForm`.
- Um nome de projeto com carga HTML foi tratado como texto inerte; não surgiu imagem executada na interface.
- Os arquivos de evidência usam dados sintéticos e endereços `.invalid`/`.test`.
- O relatório gerencial preservado foi sanitizado antes da gravação.

## Isolamento

O executor comercial criou raiz temporária, banco SQLite, porta, token e senha próprios para cada suíte. A base de uso real não foi consultada nem modificada. O encerramento removeu a raiz efêmera; apenas os artefatos explicitamente destinados à auditoria foram copiados para `docs/auditorias`.

## Metadados

Os PDFs registram `Producer`/`Creator` como pdfmake e data de criação. Não foram encontrados tokens, credenciais, caminhos locais ou valores sentinela. Como melhoria, recomenda-se definir título e idioma sem inserir dados pessoais desnecessários.

## Conclusão

Não foi identificado vazamento de notas internas, custos internos, margem/markup internos, conta financeira, token ou caminho local nos documentos auditados. O risco residual é o universo limitado dos marcadores e fixtures; não substitui revisão de classificação de todos os campos futuros.

