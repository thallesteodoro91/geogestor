# Relatório de importações

## Importação simples

| Área | Cobertura | Resultado |
|---|---|---|
| Formato | CSV e XLSX; seletor e associação manual exercitados | Aprovado |
| Entidades | Clientes, Projetos e Contatos, conforme contrato | Aprovado |
| Cabeçalho/mapeamento | automapeamento, troca manual, sem uso, obrigatórios e preview | Aprovado |
| Limites/erros | inválidos, duplicados, parcial, zero sucesso e limite simples | Aprovado |
| Vínculos | projeto por referência/associação manual; consumidor conferido | Aprovado |
| Idempotência | replay igual, payload divergente e chamadas concorrentes | Aprovado |
| Atomicidade | falha da auditoria reverte a entidade; outbox segue contrato | Aprovado |
| Histórico | resumo, detalhe, linhas e CSV de erros | Aprovado |

Os arquivos sintéticos são criados dentro do ambiente E2E, portanto seus hashes e dados por linha não são persistidos depois da autolimpeza. A evidência durável é o resultado dos testes de contrato/integração e o registro sanitizado de comandos; nenhum dado pessoal real foi usado.

## Migração completa

- Prévia ligada ao SHA-256 do arquivo, aba, cabeçalho, mapeamento e `previewId`.
- Alteração do conteúdo/mapeamento invalida a confirmação anterior.
- Expiração, uso único e duas confirmações concorrentes foram cobertos.
- Clientes, propriedades, projetos, orçamentos, faturamentos/notas, despesas e totais financeiros são reconciliados em centavos no teste de integração.
- Falha transacional não deixa entidades ou relações parciais; reimportação não duplica.

## Esquemas

- A configuração operacional no SQLite é a fonte de verdade.
- O cache `geogestor_import_schemas` no `localStorage` é apenas aceleração/fallback visual.
- JSON ausente, inválido, objeto em vez de array e itens estruturalmente inválidos resultam em lista segura; dados válidos permanecem no banco.
- Exclusão atualiza autoridade e cache e persiste após reload.
- Aplicação manual, edição e renomeação não existem no contrato atual e foram marcadas não aplicáveis.

## Reteste de interface

`tests/e2e/importacao-associacao-manual.spec.ts`: **6/6 aprovados em 1,2 min**, incluindo cache corrompido. O executor confirmou a remoção automática do run `run-1789680314354-17300-3d7ca609-00f8-4b7d-afd1-14117e133eb5`.
