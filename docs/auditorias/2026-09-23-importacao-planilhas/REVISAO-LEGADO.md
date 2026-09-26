# Revisão obrigatória do ledger legado

> **Reteste final de 25/09:** [RETESTE-FINAL-2026-09-25.md](RETESTE-FINAL-2026-09-25.md) não encontrou nesta campanha o arquivo original confiável para comparação célula a célula. O bloqueio de novas migrações completas foi preservado; não houve retropreenchimento de ledger, hash inventado ou dispensa automática. Os demais testes sintéticos prosseguiram em bancos separados.

> **Correção de premissa — 25/09/2026:** o usuário confirmou expressamente que `skygeo_revisada.xlsx` foi importada **somente para teste**. O ledger no banco padrão registra `importId=a809978d-9c6d-403d-8dce-514bc6ae35a4`, conclusão em `2026-08-30T16:41:15.789Z` e hash do arquivo `0afda9c584c43b237e3bbde3b9616eec3eb48bbfbefa669e9136ac3740cad1ce`. Esses metadados foram lidos sem abrir a planilha ou alterar o banco. Não se deve descrever essa importação como se sua finalidade fosse desconhecida ou exigir o arquivo original para provar que era teste.

**Conferência com a planilha de teste fornecida pelo usuário:** `C:\Users\Thalles\Desktop\Skygeo\Planilhas\skygeo.xlsx` tem 51.273 bytes e SHA-256 `2bd6cc695a8106fd06a9414548052867cdc5f580481170aa233d4ccf3e7aeca7`. Seu hash difere do de `skygeo_revisada.xlsx`, portanto não é o mesmo arquivo em bytes. A planilha fornecida tem uma aba, 64 colunas, 73 linhas de dados preenchidas e nenhum conteúdo de fórmula na amostra lida. Os **64 nomes de coluna** e os **10 totais financeiros agregados** coincidem com os metadados do ledger antigo. O teste de integração com opt-in importou essa planilha apenas em SQLite descartável: 1/1 passou, com 73 clientes, 72 propriedades, 73 projetos, 73 orçamentos, 73 faturamentos e 72 despesas. Esses resultados apoiam a semelhança da estrutura e dos totais; não comprovam igualdade célula a célula. Nenhuma linha pessoal foi publicada na evidência e o banco padrão permaneceu intacto.

**Consequência prática:** o bloqueio atual é específico do banco que contém esse ledger de teste. Um banco novo, limpo e separado não terá o ledger e pode ser avaliado para início de uso sem remover, alterar ou inventar registros no banco antigo. A liberação de importação de dados reais continua condicionada aos demais testes de segurança e integridade. Se o usuário optar por manter o banco atual, uma exceção controlada para este `importId` precisa ser implementada e testada; não se deve eliminar o bloqueio de todos os ledgers legados.

Em 24/09/2026, uma consulta **somente leitura** ao banco padrão encontrou uma migração completa concluída com chave por hash do arquivo e nenhuma chave correspondente de impressão digital do conteúdo. A consulta não abriu planilhas, não leu linhas pessoais e não alterou o banco. O arquivo original e as linhas parseadas não estão guardados no ledger; portanto, não é possível reconstruir uma impressão digital confiável a partir do registro.

**Decisão do usuário:** bloquear novas migrações completas e exigir revisão do legado. A API agora responde HTTP 409, código `LEGACY_FULL_IMPORT_REVIEW_REQUIRED`, ao solicitar prévia quando encontra uma importação concluída sem ledger de conteúdo associado. A mesma verificação ocorre dentro da transação de commit, cobrindo prévias antigas e execuções em fila. O teste em banco descartável confirmou 409 e ausência de novo ledger após commit direto. Importações simples continuam disponíveis.

## Procedimento para uma futura liberação

1. Fazer cópia verificável do banco e identificar o ledger legado e todas as entidades vinculadas pelo `importId` e pelas referências de origem.
2. Localizar o arquivo original em fonte confiável. Comparar o SHA-256 dos bytes com o `fileHash` do ledger e reconciliar cada entidade e valor financeiro com o estado persistido. Se o arquivo não existir, registrar expressamente que o conteúdo não pôde ser comprovado.
3. Documentar divergências, duplicidades, exclusões, correções manuais e a decisão de tratamento. Não inventar hash de conteúdo nem inserir um ledger de conteúdo fictício.
4. Somente após essa revisão, implementar uma liberação controlada e testada para o caso concreto. A alteração deve manter proteção contra replay, auditoria e rollback. Este reteste não criou mecanismo de dispensa automática.

Até a conclusão desse processo, a política é **manter a migração completa bloqueada**. O banco padrão não foi modificado nesta campanha.
