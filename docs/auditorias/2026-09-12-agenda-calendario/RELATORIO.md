# Sessão 08 — Agenda — Calendário

Data da auditoria: 12/09/2026  
Produto: GeoGestor Desktop 1.0.4  
Branch/HEAD de referência: `main` / `a16551a8b63e73f42d826297df893488e5ab88ca`  
Decisão: **APROVADO COM RESSALVAS**

## Resultado executivo

O calendário local, sua API e o pacote desktop estão aprovados após correções. A auditoria encontrou 12 defeitos materiais — 3 P1 e 9 P2 — e todos foram corrigidos e retestados. Não restou falha P0/P1 reproduzível no escopo local.

A integração externa com uma conta real do Google Agenda não foi executada porque não havia conta isolada de QA autorizada. Portanto, OAuth real, revogação, expiração de token, indisponibilidade externa e sincronização bidirecional real permanecem **BLOQUEADOS**, não aprovados por inferência. O contrato local, a proteção de segredos, o `state` OAuth, o mapeamento temporal e o scheduler foram auditados e testados sem acessar conta pessoal.

## Escopo e baseline

- Foram lidos integralmente os sete relatórios obrigatórios das Sessões 01–07.
- Baseline técnico: Electron + React/Vite + Fastify + Drizzle/libSQL/SQLite.
- A árvore já estava amplamente modificada antes desta sessão. As alterações alheias foram preservadas; nenhum reset ou descarte foi feito.
- Banco real preservado: 1.990.656 bytes, SHA-256 `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471`.
- Todos os dados funcionais de teste usaram banco e perfil E2E isolados. Os resíduos das execuções falhas desta sessão foram removidos ao final.

## Correções entregues

1. A API de compromissos passou a validar datas civis, horas, tipos, UUIDs, campos extras e intervalos; também recusa vínculos removidos ou cliente/projeto cruzados.
2. A consulta de compromissos passou a ter uma única regra de vínculo efetivo, sem `JOIN` que duplicava linhas, com exclusões lógicas respeitadas.
3. Foi removido o truncamento silencioso em 500 registros nas três fontes do calendário.
4. Foi criado endpoint de detalhe de tarefa por ID; o detalhe deixou de carregar uma coleção limitada e tipos de rota desconhecidos deixaram de cair em compromisso.
5. As três fontes passaram a receber cancelamento da consulta e a composição ganhou ordem determinística por data, hora, tipo, título e ID.
6. URL inválida passou a ser canonicalizada; mês/dia/filtros refletem estado; Voltar/Avançar funciona sem loop; o retorno do detalhe preserva o contexto temporal.
7. O layout agenda/calendário deixou de se comprimir em 1120 px; a divisão em colunas agora ocorre apenas em viewport larga.
8. O Google Agenda agora distingue evento de dia inteiro de evento com hora, usa `America/Sao_Paulo`, calcula fim exclusivo/duração de uma hora e preserva a hora na importação.
9. Atualizações locais sincronizadas gravam `ultimoSyncGoogle`; scheduler e sincronização manual recusam execução desativada ou sem refresh token.
10. Criação, atualização e exclusão de compromissos mantêm auditoria e jornada na mesma transação.

## Provas principais

- API integral: **178/178** testes aprovados.
- Web: **182/182** testes aprovados.
- Electron: **18/18** testes aprovados.
- E2E dedicado em build de produção: **4/4** testes aprovados.
- Total de testes automatizados únicos executados: **382**, sem falhas na rodada final.
- Axe WCAG 2 A/AA, 2.1 A/AA e 2.2 A/AA: zero violações nas três telas/estados dedicados analisados.
- `lint`, `typecheck`, `git diff --check`, build do instalador e smoke do pacote: aprovados.
- Build: `GeoGestor.exe` 201.237.504 bytes; instalador 89.961.164 bytes; blockmap 95.069 bytes.

## Cobertura temporal e funcional confirmada

- Meses com 4, 5 e 6 semanas; fevereiro bissexto de 2024; transição 31/01 → 29/02.
- Eventos no início/fim do mês e projeto atravessando meses.
- Projeto só com início, só com entrega e sem datas; tarefa sem prazo e tarefa removida.
- Compromissos com 00:00, 09:00, 23:59 e dia inteiro; todos os sete tipos permitidos.
- Busca sem acento, filtros, contagens, ordem de empates e estado vazio.
- Criação com validação/foco, persistência, detalhe, exclusão, confirmação e Desfazer.
- Três fontes reconciliadas sem duplicar e falha parcial preservando as fontes válidas.
- 501 compromissos adicionais no mesmo intervalo, provando ausência de corte em 500.
- Desktop 1120 px e mobile 360 px em tema escuro, sem rolagem horizontal.

## Ressalvas e bloqueios

| Tema | Situação | Consequência |
|---|---|---|
| Conta Google real de QA | BLOQUEADO | OAuth, revogação, token expirado, falha de rede, duplicidade e conflito remoto não têm prova ponta a ponta. |
| Política de conflito Google | MELHORIA P1 | O fluxo atual é local-primeiro; edição concorrente e exclusão remota/local precisam de regra de produto explícita. |
| Desfazer exclusão | RESSALVA | Recria o compromisso com novo ID; não é restauração perfeita e não preserva `googleEventId`. |
| Leitor de tela real | BLOQUEADO | Axe e semântica passaram, mas NVDA/JAWS/VoiceOver não foram executados. |
| Zoom nativo 200%, alto contraste e matriz ampla de dispositivos | BLOQUEADO | Foram cobertos 1120 px e 360 px; a matriz física completa depende de ambiente manual. |
| Offline/reconexão e virada real da meia-noite | BLOQUEADO | Falha parcial foi simulada; relógio e rede reais não foram manipulados. |
| Concorrência multiprocesso SQLite | BLOQUEADO HERDADO | O runner precisou de `busy_timeout`/retry ao semear em conexão concorrente; não há prova de carga multiprocesso de produção. |
| Upgrade sobre instalação antiga | BLOQUEADO HERDADO | Build limpo e smoke passaram; atualização in-place não foi reproduzida nesta sessão. |

## Decisão final

**APROVADO COM RESSALVAS** para calendário local e pacote desktop. A sincronização Google real fica explicitamente fora da aprovação até execução com conta isolada de QA e protocolo destrutivo autorizado. Nenhum bloqueio foi mascarado como aprovado e nenhum item material permaneceu sem status na matriz.

