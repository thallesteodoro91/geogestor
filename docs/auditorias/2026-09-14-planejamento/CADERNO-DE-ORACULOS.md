# Caderno de oráculos

## Relógio, fuso e isolamento

- Fuso de negócio: `America/Sao_Paulo`.
- Ciclo principal: `2026-01-01` a `2026-12-31`.
- Capturas de revisão: `2026-07-30` e `2026-08-15`.
- `updatedAt` das fixtures de origem: `2026-07-15T12:00:00.000Z`.
- SQLite de integração: `scratch/strategic-planning-<PID>/strategic-planning.test.db`.
- E2E: diretório `scratch/run-<timestamp>-<pid>-<uuid>` criado e removido pelo harness.
- IDs: UUIDs gerados por `crypto.randomUUID()` dentro da base descartável. Identidade estável do oráculo é dada pelos nomes sintéticos; nenhum ID foi gravado em base real.

## Seleção e estrutura

| Regra | Oráculo | Observado |
|---|---|---|
| Ciclos visíveis | `deletedAt IS NULL` | Ciclo soft-deletado não volta no snapshot |
| Seleção | solicitado válido → ativo → primeiro ordenado | URL inválida é canonicalizada; ativo precede os demais |
| Ordenação de ciclos | ativo, início desc., criação desc., ID asc. | Critérios explícitos no serviço |
| Pilar | exatamente um ciclo; ordem inteira `0…999` | Contrato e relação validados |
| Objetivo | ciclo do objetivo = ciclo do pilar | Associação cruzada rejeitada |

## Fórmulas

Definição geral: somente progressos disponíveis participam das médias. O resultado final é limitado a `[0,100]`.

| Caso | Entradas | Cálculo independente | Esperado/GeoGestor |
|---|---|---|---|
| Aumentar | base 0, meta 100, atual 50 | `(50−0)/(100−0)×100` | 50% / 50% |
| Reduzir | base 100, meta 50, atual 75 | `(100−75)/(100−50)×100` | 50% / 50% |
| Manter | base/meta 100, atual 100 | tolerância `max(100×5%,0,01)=5`; distância 0 | 100% / 100% |
| Automático indisponível | sem população válida | sem numerador/denominador | `null`, “indisponível”, fora da média |
| Zero válido | valor numérico 0 | participa; não vira `null` | contrato preserva zero |

Fórmula de manter vigente: `max(0, 100 − |atual−meta|/tolerância×100)`. Intervalo igual a zero nas direções aumentar/reduzir segue o ramo explícito do helper e não faz divisão por zero. A família foi revisada, mas toda a matriz de valores iguais/diferentes, negativos, magnitude extrema e clamp foi classificada como bloqueada por falta de execução integral.

## Médias e contagens

- Progresso do objetivo = soma dos progressos disponíveis de seus KRs ÷ quantidade disponível.
- Progresso geral = soma dos progressos disponíveis de todos os KRs do ciclo ÷ quantidade disponível.
- Não existe ponderação por objetivo, prioridade ou confiança.
- `objetivosEmRisco` = união por ID de objetivo com status `em_risco` e objetivo ligado a risco alto/crítico que não esteja resolvido/aceito.
- Iniciativa atrasada = prazo `< data civil de hoje` e status diferente de concluída/cancelada.
- Decisão pendente = status pendente ou em andamento; atraso exige também prazo `< hoje`.
- Desatualização: semanal 10, mensal 40, trimestral 110, semestral 210, anual 400 dias. A idade usa chaves civis de São Paulo; indisponível não é stale.

## Oráculo de origem

| Fixture semântica | Incluída? | Motivo |
|---|---:|---|
| Recebimento R$ 100,00 em 10/07 | sim | ativo, não estornado, dentro do ciclo |
| Despesa paga R$ 40,00 em 11/07 | sim | paga e dentro do ciclo |
| Despesa pendente R$ 9.000,00 | não | status não pago |
| Oportunidade ganha em 10/06 | sim | encerrada como ganha |
| Oportunidade perdida em 11/06 | sim | encerrada como perdida |
| Oportunidade em negociação | não | não encerrada |
| Projeto concluído 10/01–10/04 | sim | sobrepõe o ciclo e é concluído |
| Projeto em andamento 10/03–10/10 | sim no denominador | sobrepõe o ciclo, não concluído |
| Tarefa concluída com prazo 10/05 | sim | ativa e prazo no ciclo |
| Tarefa a fazer com prazo 10/08 | sim no denominador | ativa e prazo no ciclo |

Resultados: Financeiro R$ 60,00; CRM 50%; Projetos 50%; Tarefas 50%. Detalhes em [MATRIZ-DE-FONTES.md](./MATRIZ-DE-FONTES.md).

## Snapshots e tendências

1. Revisão `2026-07-30`, status atenção, KR manual em 50, decisão pendente e risco alto mitigando: primeiro snapshot; tendência indisponível por falta de par.
2. O estado ao vivo muda: KR manual 75, objetivo crítico, iniciativa 40, risco resolvido, decisão concluída.
3. A edição textual da revisão 1 não altera `objetivosJson` nem `progressoGeral` históricos.
4. Revisão `2026-08-15`, status no rumo: segundo snapshot; tendência passa a disponível e compara 30/07 com 15/08.
5. Reabrir a decisão limpa `concluidaEm` e ela volta à contagem pendente do estado ao vivo, sem reescrever os snapshots.

## Limites não convertidos em prova

Não foram executadas todas as combinações solicitadas de clamp, datas nas bordas inclusivas das quatro fontes, status com caixa/acento alternados, JSON histórico inválido, todos os contadores de tendência e concorrência. Elas permanecem `BLOQUEADO` na matriz, não “aprovadas por leitura de código”.
