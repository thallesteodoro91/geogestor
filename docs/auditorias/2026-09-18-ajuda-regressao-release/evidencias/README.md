# Índice de evidências

As evidências volumosas permanecem nas raízes gerenciadas originais para evitar cópia ou adulteração. Este diretório funciona como índice.

## Execução integral preservada

`scratch/commercial-e2e/run-1789785248308-31464-059094db-6e37-47d8-aad8-84c1ae5473ad`

- 90 testes descobertos;
- 56 aprovados;
- 13 falharam;
- 21 não executados;
- screenshots, traces e `error-context.md` preservados por falha.

## Retestes vermelhos preservados

- `scratch/commercial-e2e/run-1789786536489-45836-4f9de1ba-20bb-40f0-bdd1-fbfb434ff9a9`
- `scratch/commercial-e2e/run-1789786704436-46564-651e1a34-a8c4-4d36-97b1-6656e45aa689`
- `scratch/commercial-e2e/run-1789786839484-9288-4c1f52fb-6b55-43e9-aba0-f5a511385bdb`
- `scratch/commercial-e2e/run-1789786898585-36604-865a6ca4-1c63-46c4-8385-041e95b93163`

Essas execuções documentam a progressão: seletor nativo incorreto, controle instável, seletor textual ambíguo e corrida entre troca de filtro e retentativa.

## Execuções verdes

- O reteste conjunto `run-1789786704436-46564-651e1a34-a8c4-4d36-97b1-6656e45aa689` comprovou cabeçalhos e Sessão 06 verdes, embora tenha preservado a falha restante da Central de Alertas.
- A execução final `run-1789786988785-14616-58bd80a1-d097-46f7-b8f4-81ed5b6ec22e` aprovou 2/2 e removeu apenas os próprios resíduos, conforme política do runner. O resultado está registrado em `COMANDOS-E-RESULTADOS.md`.

## Reprodutibilidade

Todos os E2E foram construídos em `web-dist` temporário, usaram banco temporário, scheduler desativado e portas locais escolhidas dinamicamente. Nenhum caminho deste índice deve ser tratado como artefato publicável.
