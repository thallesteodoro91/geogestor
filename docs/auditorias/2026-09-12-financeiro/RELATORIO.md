# Relatório de auditoria — Sessão 07: Financeiro

**Data:** 12/09/2026  
**Responsável:** auditoria técnica assistida  
**Escopo:** `/financeiro`, visão geral, contas a receber, contas a pagar, viagens, notas fiscais, diagnóstico, exportação e persistência financeira  
**Resultado geral:** **APROVADO COM RESSALVAS**

## 1. Resumo executivo

A Sessão 07 foi auditada em código, contratos, API Fastify, SQLite isolado, interface React real via Playwright, CSV e pacote desktop. Foram confirmados e corrigidos **10 defeitos: 0 P0, 5 P1, 5 P2 e 0 P3**. Não restou defeito P0/P1 nem reprovação aberta no escopo.

A matriz encerra **124 critérios**: 86 aprovados diretamente, 27 aprovados após correção, 9 bloqueados e 2 não aplicáveis. As ressalvas são verificações que exigem ambiente ou operação manual não disponível nesta campanha: leitor de tela real, alto contraste do Windows, matriz visual ampla, zoom nativo de 200%, interrupção de rede, virada real da meia-noite, volume de produção, concorrência multiprocesso/lock prolongado e upgrade sobre uma instalação anterior.

O veredito financeiro é sustentado por uma reconciliação independente em centavos entre SQLite, API, interface e CSV. No oráculo sintético final, os valores foram: receita contratada R$ 8.000,00; recebida R$ 6.420,00; pendente R$ 600,00; atrasada R$ 1.000,00; despesas lançadas R$ 1.100,00; pagas R$ 700,00; vencidas R$ 300,00; resultado de caixa R$ 5.720,00.

## 2. Escopo comprovado

- rota canônica `/financeiro`, redirect legado, abas principais e auxiliares, URL inválida e link profundo de parcela;
- visão geral, períodos, cliente/categoria/tipo/centro de custo, KPIs, alertas, séries, distribuição, rentabilidade e CSV;
- parcelas e recebimentos parciais/integrais, acréscimos, descontos, estorno, histórico e tentativa concorrente de dupla baixa;
- despesas, baixa, cancelamento, estorno, exclusão lógica, status vencido efetivo, comprovantes e filtros;
- viagens com adiantamento/prestação de contas e proteção contra encerramento repetido;
- notas fiscais, cancelamento, substituição, URL segura e aviso de que o módulo não substitui escrituração fiscal;
- diagnóstico de vínculos somente leitura e repetível;
- schemas estritos, datas reais, inteiros monetários, integridade relacional, transações, auditoria e exclusões do consolidado;
- teclado, foco, semântica de abas, contraste AA, Axe WCAG 2.2 A/AA, 360 px, modo escuro e recuperação após erro;
- regressões completas de API, web e Electron, build NSIS e smoke da API empacotada.

## 3. Contexto arquitetural

A investigação mapeou primeiro as fontes e os consumidores dos números financeiros:

```text
orçamentos ── parcelas ── recebimentos
      │             │          │
      └─────────────┴──────────┼── visão geral / contas / CSV
despesas ─ documentos ─ viagens│
      │                        │
notas fiscais ─────────────────┘
               │
               ▼
        Fastify + Zod estrito
               │
               ▼
       Drizzle/libSQL + auditoria
```

Essa abordagem evidenciou divergências entre status persistido e status efetivo, filtros e seus resumos, além de vínculos aceitos pela API mas indisponíveis na interface.

## 4. Correções entregues

1. Datas ISO agora precisam existir no calendário; intervalos invertidos são recusados.
2. Payloads de mutação são estritos, limitados e PATCH vazio é rejeitado.
3. Despesa, viagem e nota fiscal validam cliente/projeto ativos e relações coerentes.
4. Status efetivo de despesa distingue Pendente, Vencida, Paga, Cancelada e Estornada e alimenta filtro e resumo pelo mesmo universo.
5. Nota fiscal aceita somente HTTP/HTTPS e substituição existente, ativa e do mesmo cliente.
6. O seletor de comprovante de despesa envia o cliente obrigatório e o projeto opcional corretos.
7. Datas civis deixam de depender de UTC na API e na interface.
8. Abas principais e auxiliares ganharam roving tabindex, setas, Home/End, `aria-controls` e `tabpanel`.
9. Falha de listagem de contas/despesas apresenta erro acionável com repetição, em vez de estado vazio falso.
10. O gráfico deixou de expor foco dentro de região oculta e o resultado positivo passou a contraste AA.

Reprodução, causa e reteste estão em [ACHADOS.md](./ACHADOS.md).

## 5. Reconciliação financeira

As regras e somas independentes estão em [RECONCILIACAO.md](./RECONCILIACAO.md). Os números foram comparados em quatro camadas:

| Medida | SQLite/oráculo | API | Interface | CSV |
|---|---:|---:|---:|---:|
| Receita recebida | 642.000 ¢ | 642.000 ¢ | R$ 6.420,00 | 6420,00 |
| Despesas pagas | 70.000 ¢ | 70.000 ¢ | R$ 700,00 | 700,00 |
| Resultado de caixa | 572.000 ¢ | 572.000 ¢ | R$ 5.720,00 | 5720,00 |

Cancelados, estornados, excluídos e orçamento rejeitado foram injetados com valores altos para que qualquer inclusão indevida quebrasse o oráculo.

## 6. Testes e pacote

| Camada | Resultado final |
|---|---|
| API completa | **169/169** |
| Web completa | **182/182** |
| Electron | **18/18** |
| API financeira focada | **7/7** |
| Web financeira focada | **10/10** |
| E2E S07 | **4/4**, 52,7 s |
| Axe | zero violação na jornada final |
| Lint | aprovado |
| Typecheck web/API | aprovado |
| `git diff --check` | aprovado |
| Build completo | aprovado |
| Smoke empacotado | aprovado |

O build final gerou `GeoGestor Setup 1.0.4.exe`, com 89.959.799 bytes e SHA-256 `480E1057CD1100BEA47D7290317721835D0B179113C3F9610AF34AD210304057`. Veja [COMANDOS-E-RESULTADOS.md](./COMANDOS-E-RESULTADOS.md).

## 7. Segurança, persistência e limpeza

- Todas as escritas de QA ocorreram em bancos e perfis descartáveis, com prefixo `QA-AUDIT-S07-20260912-`.
- O banco real `data/geogestor.db` permaneceu com 1.990.656 bytes, modificação de 30/08/2026 14:12:58 e SHA-256 `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471` antes e depois.
- A tentativa concorrente de duas baixas sobre a mesma parcela retornou 201 + 409; o principal total permaneceu em 600.000 centavos, sem duplicação.
- Uma falha sintética obrigatória de auditoria reverteu integralmente a criação de despesa.
- O diagnóstico de vínculos foi executado duas vezes sem criar eventos ou alterar dados.
- O runner E2E removeu automaticamente o perfil isolado aprovado; outros 14 diretórios descartáveis identificados da campanha foram removidos explicitamente. Somente evidências sintéticas deliberadas foram preservadas.
- O worktree já estava amplamente modificado por sessões anteriores. Essas alterações foram preservadas e não são atribuídas a esta auditoria.

## 8. Evidências

- [Visão geral reconciliada](./evidencias/01-visao-geral-reconciliada.png)
- [Contas e recuperação de erro](./evidencias/02-contas-e-recuperacao.png)
- [Auxiliares, modo escuro e 360 px](./evidencias/03-auxiliares-mobile-escuro.png)
- [Resposta integral da API](./evidencias/reconciliacao-api.json)
- [CSV exportado](./evidencias/fluxo-caixa.csv)
- [Catálogo das evidências](./evidencias/README.md)

## 9. Arquivos da Sessão 07

| Área | Arquivos | Motivo |
|---|---|---|
| Schemas/API | `financeiro.schemas.ts`; `financeiro.routes.ts`; `financeiro-recebimentos.routes.ts`; `financeiro-operacional.routes.ts` | contratos, datas, vínculos, status, filtros e operações |
| Consolidação | `finance-overview-query.service.ts`; `finance-overview.service.ts` | data civil e reconciliação do overview |
| Interface | `Financeiro.tsx`; `Faturas.tsx`; `Despesas.tsx`; `GestaoFinanceira.tsx` | datas, erro/recuperação, acessibilidade, contraste e comprovantes |
| Utilitário | `localDate.ts`; `localDate.test.ts` | data civil local determinística |
| Testes | `session07-finance.integration.test.ts`; `financeConsolidation.test.ts`; `session07-finance.spec.ts` | campanhas API, fonte e E2E |

## 10. Bloqueios e riscos residuais

| Tema | Motivo | Tratamento recomendado |
|---|---|---|
| Leitor de tela e alto contraste nativos | NVDA/JAWS e modo HC não foram operados | rodada assistiva manual |
| Matriz visual e zoom | amostra final em 360 px, 1280 px, claro/escuro; sem 768/1024/1440 e 200% nativo | inspeção visual pré-release |
| Offline/reconexão | rede do host não foi interrompida | ensaio controlado com proxy/adaptador |
| Meia-noite real | relógio do host não foi alterado | relógio injetável e teste de virada |
| Volume produtivo | não havia cópia sanitizada de grande base | benchmark com cardinalidade realista |
| Multiprocesso/lock SQLite | concorrência HTTP foi exercitada no mesmo processo | dois processos e lock prolongado |
| Upgrade anterior | afetaria instalação/perfil real | VM ou perfil descartável com 1.0.3 |

## 11. Melhorias não implementadas

| Prioridade | Melhoria | Benefício | Esforço | Risco |
|---|---|---|---|---|
| 1 | Paginação/virtualização unificada de contas e despesas | escala em bases grandes | médio | médio |
| 2 | Relógio injetável comum | fronteiras de vencimento determinísticas | médio | baixo |
| 3 | Importação/retorno bancário e conciliação assistida | reduz baixa manual | alto | alto |
| 4 | Livro-razão exportável por entidade | rastreabilidade contábil | alto | médio |
| 5 | Ensaio multiprocesso automatizado | prova de lock/idempotência | médio | médio |

São evoluções de produto, não correções comprovadas, e por isso não foram implementadas sem autorização.

## 12. Conclusão

O núcleo Financeiro está apto para continuidade: os 10 defeitos confirmados foram corrigidos, não há P0/P1 ou reprovação aberta, as somas fecharam entre SQLite, API, UI e CSV, e o instalador passou build e smoke. A recomendação objetiva é **iniciar a Sessão 08**, mantendo os nove bloqueios ambientais/manuais como dívida de validação pré-release.

Consulte a cobertura completa em [MATRIZ-DE-COBERTURA.md](./MATRIZ-DE-COBERTURA.md).
