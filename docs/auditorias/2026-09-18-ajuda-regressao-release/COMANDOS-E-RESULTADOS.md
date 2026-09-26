# Comandos e resultados

Os comandos abaixo foram executados no repositório original. Testes E2E usaram raízes temporárias gerenciadas em `scratch/commercial-e2e`; bancos reais não foram abertos.

| Comando | Resultado |
|---|---|
| `pnpm run test:web` | aprovado, 202/202 |
| `pnpm run test:api` | aprovado, 190/190 |
| `pnpm run test:electron` | aprovado, 18/18 |
| `pnpm run lint` | aprovado |
| `pnpm run typecheck` | aprovado |
| `pnpm run governance:check` | aprovado; baseline 70, atual 60, removidos 10, novos 0, aumentados 0 |
| `pnpm run governance:test` | aprovado, 18/18 |
| teste integrado focado de pesquisa global | aprovado, 1/1 |
| `node scripts/run-commercial-e2e.mjs --workers=1` | reprovado: 56 passaram, 13 falharam, 21 não rodaram, 12,1 min |
| E2E focado de Ajuda na execução integral | aprovado, 3/3 |
| E2E focado de acessibilidade, cabeçalhos, relatórios e Sessão 06 | identificou seletor instável, altura de 32 px e contraste de toast |
| E2E focado após correções de CSS | cabeçalhos e Sessão 06 aprovados; mock de alertas ainda instável |
| E2E focado `Central de Alertas` após mock determinístico | aprovado, 2/2 incluindo setup |
| `pnpm run release:verify-source` | bloqueado corretamente por worktree sujo |
| inventário de processos/portas após E2E | nenhum processo GeoGestor e nenhuma porta de teste remanescente |
| inventário de bancos por metadados/hash | somente leitura; nenhum banco aberto ou alterado |
| verificação Authenticode via PowerShell | inconclusiva por falha de carregamento do módulo de segurança no ambiente |

## Falhas integrais classificadas

1. `accessibility-navigation`: interação antiga com combobox e corrida de mock; corrigida e aprovada isoladamente.
2. `commercial-critical` financeiro: estado compartilhado não correspondia à fixture esperada.
3. link profundo de contas a receber: parcelas ausentes após contaminação do estado.
4. `header-standardization`: filtro com 32 px; corrigido e aprovado.
5. `reports-managerial`: texto duplicado em strict mode; seletor tornado exato e aprovado no foco.
6. Sessão 01 dashboard: estado/contagem compartilhado.
7. Sessão 02 clientes: estado compartilhado.
8. Sessão 03 CRM: estado compartilhado.
9. Sessão 04 orçamentos: esperava vazio, mas havia orçamento criado anteriormente.
10. Sessão 05 projetos: esperava vazio, mas havia projeto criado anteriormente.
11. Sessão 06 ambiental: contraste 3,15:1 e depois 4,28:1 por empilhamento; corrigido e aprovado.
12. Sessão 09 tarefas: esperava 103, observou 109 após criações anteriores.
13. Sessão 11 relatórios: data fixa tornou receita vencida diferente do esperado.

## Ambiente

- Windows NT `10.0.26200.0`, localidade pt-BR, fuso America/Sao_Paulo.
- Node `v24.17.0`, pnpm `11.8.0`, Electron `35.7.5`.
- Espaço livre observado em C: aproximadamente 62,86 GB.
- Execução atravessou a mudança civil de 18 para 19/09/2026; o diretório mantém a data de início solicitada.

## Incidente ambiental

Após a execução E2E longa, o executor isolado do Windows passou a falhar com `CreateProcessWithLogonW failed: 1909`. Leituras, testes e patches subsequentes foram executados fora desse executor mediante autorização; toda edição continuou usando o motor oficial `apply_patch`. O incidente não foi tratado como defeito do produto.
