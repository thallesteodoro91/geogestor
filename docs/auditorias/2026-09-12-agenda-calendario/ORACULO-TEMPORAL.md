# Oráculo temporal

## Regras canônicas

- Datas de negócio são civis no formato `AAAA-MM-DD`; não são instantes UTC.
- A data selecionada (`data`) prevalece sobre o mês (`mes`) e força o mês correspondente.
- Mês sem data seleciona o primeiro dia daquele mês na entrada inicial.
- Data ou mês inexistente é substituído por estado canônico válido.
- Intervalos de API são inclusivos; `inicio > fim` é recusado.
- Projeto gera no máximo dois eventos: início e entrega. Datas iguais geram dois eventos distintos.
- Tarefa gera evento somente com `dataLimite` e sem `deletedAt`.
- Compromisso sem hora é dia inteiro; com hora usa `HH:MM` local.
- Ordem: data, eventos com hora antes de dia inteiro, hora, tipo, título e ID.
- No Google, dia inteiro termina no dia civil seguinte, exclusivo. Evento com hora dura uma hora e usa `America/Sao_Paulo`.

## Casos de referência executados

| Caso | Entrada | Saída esperada/observada |
|---|---|---|
| Fevereiro bissexto | `2024-02` | 29 dias, grade com 35 células. |
| Mês de 4 semanas | `2026-02` | 28 células. |
| Mês de 6 semanas | `2026-08` | 42 células. |
| 31 → fevereiro | 31/01/2024 + próximo mês | 29/02/2024. |
| Teclado PageUp | 29/02/2024 | 29/01/2024 e entrada no histórico. |
| Voltar | após PageUp | retorna a 29/02/2024 em uma etapa. |
| Limites do mês | 01/02 e 29/02/2024 | ambos renderizados e contados. |
| Atravessa meses | projeto 31/01–01/03 | início e entrega nos meses corretos. |
| Só início | 15/02, entrega nula | um evento “Início”. |
| Só entrega | início nulo, 15/02 | um evento “Entrega”. |
| Sem datas/prazo | nulo | nenhum evento derivado. |
| Meia-noite | `00:00` | primeiro compromisso com hora do dia. |
| Fim do dia | `23:59` | antes dos itens de dia inteiro. |
| Google com hora | 29/02/2024 23:59 | `20240229T235900/20240301T005900`, `ctz=America/Sao_Paulo`. |
| Google dia inteiro | 29/02/2024 | início 29/02, fim exclusivo 01/03. |
| Importação UTC | `2024-03-01T01:30:00Z` | 29/02/2024 22:30 em São Paulo. |
| Data inválida | 30/02/2024 | HTTP 400 / URL canonicalizada. |
| Intervalo invertido | 01/03 → 01/02 | HTTP 400. |

## Limites do oráculo

A virada real da meia-noite, mudança do relógio do sistema e fusos diferentes de São Paulo não foram executados no ambiente nativo. Esses itens permanecem bloqueados e não são inferidos a partir dos testes determinísticos.

