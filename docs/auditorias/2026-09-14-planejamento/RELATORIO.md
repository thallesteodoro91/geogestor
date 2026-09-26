# Auditoria da Sessão 12 — Planejamento estratégico

Data de execução: 14 e 15/09/2026  
Rota: `/planejamento`  
Commit de referência: `a16551a8b63e73f42d826297df893488e5ab88ca`  
Status: **APROVADA COM RESSALVAS**

## Resumo executivo

O fluxo principal foi exercitado na aplicação construída, API Fastify e SQLite isolado: criação das oito entidades manipuláveis, edição de objetivo, navegação entre as quatro abas, filtro persistido na URL, recarga, snapshots, decisão, risco, erro e recuperação. Os quatro conectores automáticos foram recalculados a partir das tabelas de origem. Foram corrigidos 28 defeitos reproduzidos: 7 P1, 17 P2 e 4 P3. Não permaneceu P0 ou P1 conhecido dentro do recorte efetivamente exercitado.

A aprovação tem ressalvas porque a campanha não comprovou, em ambiente real, todas as combinações pedidas no roteiro: exclusão pela UI das oito entidades, concorrência multiprocesso, lock SQLite, reinício do aplicativo instalado, leitor de tela, alto contraste, zoom 200%, todos os viewports e Axe em cada modal/estado. Esses itens estão classificados, não omitidos, na matriz.

## Cobertura obtida

| Dimensão | Resultado |
|---|---:|
| Abas abertas no fluxo real | 4/4 |
| Entidades criadas pela UI | 8/8 |
| Entidades com PATCH exercitado na API | 8/8 |
| Famílias de fórmula | 3/3 |
| Fontes automáticas recalculadas | 4/4 |
| Exclusões lógicas exercitadas em integração | 3/8 diretamente; política das demais revisada no código |
| Snapshots históricos comparados | 2 |
| Viewports com captura | 2 (`1440×900` e `390×844`) |
| Temas com captura | 2/2 |
| E2E final | 2/2 |
| Matriz consolidada | 10 aprovados, 15 aprovados após correção, 0 reprovados, 8 bloqueados, 5 não aplicáveis |

## Principais diferenças encontradas e resolvidas

- Uma fonte sem registros era confundida conceitualmente com dado desatualizado. Agora retorna `valorAtual=null`, `progresso=null`, `estadoDado=indisponivel` e não aumenta `dadosDesatualizados`.
- As fontes automáticas recebiam uma data de atualização artificial da leitura. Agora usam o maior `updatedAt` da população consultada; na fixture, `2026-07-15T12:00:00.000Z` gera quatro dados desatualizados de forma justificável.
- Metadados automáticos adulteráveis (regra, período, rota e unidade) eram aceitos. O servidor agora restaura a definição canônica da fonte.
- Editar um check-in podia recapturar o estado atual e alterar retrospectivamente o histórico. O snapshot original agora permanece imutável; somente um novo check-in produz novo snapshot.
- Soft delete não dispara `ON DELETE`. Ciclos, objetivos, iniciativas e check-ins agora tratam dependências e desvinculações explicitamente e dentro de transação.
- O filtro “Depois de 30 dias” incluía o dia +30. Agora a fronteira é estritamente `> hoje+30`.
- Datas civis derivadas de UTC podiam deslocar o dia. A UI e o serviço usam a data civil de `America/Sao_Paulo`.

## Oráculos confirmados

Com ciclo `2026-01-01…2026-12-31`:

- Financeiro: `10.000 − 4.000 = 6.000` centavos, convertido uma vez para **R$ 60,00**.
- CRM: `1 ganha ÷ 2 encerradas = 50%`; oportunidade aberta não entra.
- Projetos: `1 concluído ÷ 2 sobrepostos ao ciclo = 50%`.
- Tarefas: `1 concluída ÷ 2 ativas com prazo no ciclo = 50%`.
- Aumentar: `(50−0)/(100−0)×100 = 50%`.
- Reduzir: `(100−75)/(100−50)×100 = 50%`.
- Manter: meta/atual `100`, tolerância `5`, resultado `100%`.

## Integridade e governança

- Migração em runtime: schema 15; `PRAGMA foreign_keys=1` verificado.
- Check-in, snapshot, decisão legada e próxima revisão são gravados na mesma transação.
- Falha injetada no audit log devolveu 500 sanitizado e deixou zero ciclos residuais.
- Exclusão de pilar com objetivo ativo retornou 400 específico e sanitizado.
- Risco não pôde apontar para objetivo de outro ciclo.
- Exclusão de iniciativa zerou `risco.iniciativaId`; exclusão de check-in marcou o snapshot como excluído e desvinculou a decisão; exclusão de ciclo marcou seus descendentes.
- O teste de volume carregou 80 objetivos e 320 resultados em 67,1 ms no último reteste focado, abaixo do teto de 3 s.

## Regressão e release

| Comando/suíte | Resultado |
|---|---|
| Integração estratégica focada final | 1/1, 11.130,269 ms, incluindo teardown e limpeza |
| Testes web | 194/194, ~3,20 s |
| Testes Electron | 18/18, 157,6 ms |
| E2E Planejamento | 2/2, 40,8 s; cenário principal 27,1 s |
| Typecheck API | aprovado, ~25 s |
| Typecheck web | aprovado, ~32,6 s |
| Lint web | aprovado, sem saída |
| Lint API | aprovado com 78 avisos históricos fora do escopo |
| Build completo | aprovado; web Vite 2,91 s e instalador NSIS assinado |
| Smoke do pacote | aprovado |
| API completa | 184/185; 1 falha reproduzível fora do Planejamento |
| `release:verify-candidate` | bloqueado por manifesto/tamanho/SHA herdados |
| `governance:check` | bloqueado por débitos globais fora dos arquivos da sessão |

A falha da suíte API completa está em `financial-removal-scenarios.integration.test.ts:318`: esperado `accountsReceivableCents=0`, obtido `3333`, e `receivedCents=6668`. Ela também falha isoladamente e nenhum arquivo financeiro foi alterado nesta sessão.

## Segurança dos dados e limpeza

As duas bases reais foram somente lidas e tiveram hashes comparados antes/depois:

- `data/geogestor.db`: 1.990.656 bytes; SHA-256 `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471`.
- `%APPDATA%/geogestor-desktop/geogestor.db`: 1.163.264 bytes; SHA-256 `D4B4169A496501DD3A28746AD49792DB5CFA00CF7D096AB8744B4EE0229CF4DA`.

Tamanho, `LastWriteTime` e SHA-256 permaneceram idênticos. As fixtures ficaram em bancos descartáveis sob `scratch`; o run final `run-1789508256577-24396-1cb0e9f0-bd22-4534-ad84-b5ca96ad6698` foi limpo pelo harness. O snapshot temporário `scratch/qa-audit-s12-baseline-20260914` foi removido depois da comparação (`StillExists: False`). O teardown foi endurecido para aguardar o fechamento do cliente e remover o diretório inteiro; 145 diretórios numéricos residuais `strategic-planning-<PID>` foram validados como filhos diretos de `scratch` e removidos, restando zero. Não há IDs sintéticos a remover das bases reais.

## Riscos e recomendação

O relatório da Sessão 11 não foi localizado em `docs/auditorias/*-relatorios/RELATORIO.md`; a reconciliação financeira foi feita diretamente nas tabelas. A publicação continua bloqueada pelos problemas do manifesto de release já herdados. A Sessão 13 pode iniciar, desde que não seja tratada como autorização de release e registre a falha financeira global como dívida externa. Recomenda-se reservar uma campanha posterior para os oito bloqueios de ambiente desta sessão.

Na Sessão 13 — Cadastros e Propriedades, retestar como regressão cruzada: (1) a suíte API completa e a falha financeira herdada; (2) que cadastros/propriedades não alterem a população das quatro fontes sem regra explícita; (3) que opções e vínculos continuem ignorando registros soft-deletados; e (4) hashes/manifesto antes de qualquer candidato de release. Os bloqueios específicos de concorrência, lock e acessibilidade assistiva permanecem responsabilidade de uma campanha dedicada, não da Sessão 13.

## Artefatos

- [Matriz de cobertura](./MATRIZ-DE-COBERTURA.md)
- [Achados](./ACHADOS.md)
- [Caderno de oráculos](./CADERNO-DE-ORACULOS.md)
- [Matriz de fontes](./MATRIZ-DE-FONTES.md)
- [Protocolo de governança](./PROTOCOLO-DE-GOVERNANCA.md)
- [Protocolo de integridade](./PROTOCOLO-DE-INTEGRIDADE.md)
- [Comandos e resultados](./COMANDOS-E-RESULTADOS.md)
- [Arquivos alterados](./ARQUIVOS-ALTERADOS.md)
- [Melhorias não implementadas](./MELHORIAS-NAO-IMPLEMENTADAS.md)
- [Índice de evidências](./evidencias/README.md)
