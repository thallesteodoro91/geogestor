-- Usar somente após exportar os dados criados pelo módulo financeiro.
DROP TABLE IF EXISTS `projeto_financeiro_decisoes`;
DROP TABLE IF EXISTS `financeiro_eventos`;
DROP TABLE IF EXISTS `notas_fiscais`;
DROP TABLE IF EXISTS `despesa_documentos`;
DROP TABLE IF EXISTS `recebimentos`;
DROP TABLE IF EXISTS `viagens`;
-- As colunas adicionadas a despesas são mantidas deliberadamente.
-- Removê-las exigiria recriar a tabela no SQLite e elevaria o risco de perda.
