# Relatório de auditoria — Sessão 05: Projetos

**Data:** 11/09/2026  
**Responsável:** auditoria técnica assistida  
**Escopo:** Projetos, suas rotas, formulários, especializações, detalhe, tarefas, arquivos, finanças, status, reatribuição e exclusão  
**Resultado geral:** **APROVADO COM RESSALVAS**

## 1. Resumo executivo

A Sessão 05 foi auditada em código, API, banco temporário, interface web e pacote desktop. Foram avaliados **101 critérios**:

| Situação | Quantidade |
|---|---:|
| APROVADO | 50 |
| APROVADO APÓS CORREÇÃO | 35 |
| BLOQUEADO | 12 |
| N/A | 4 |
| **Total** | **101** |

Foram confirmados e corrigidos **10 defeitos**, sendo **0 P0**, **6 P1** e **4 P2**. Todos os defeitos atribuíveis ao módulo foram retestados; não restou P0/P1 aberto em Projetos.

A ressalva decorre de testes manuais/ambientais não disponíveis e de um bloqueio externo no smoke empacotado: a rota `/api/projetos` do pacote passou, mas o fluxo parou depois porque a Configuração Inicial não gerou o log de auditoria esperado. Esse ponto pertence à Sessão 01 e não foi corrigido fora do escopo.

## 2. Escopo efetivamente percorrido

- Rotas `/projetos`, `/projetos/:id` e alias legado `/operacional`.
- Lista, grade, estatísticas, busca, filtros, ordenação, paginação, URL, vazio, erro e retry.
- Criação/edição, cliente/propriedade, datas, coordenadas, área e tipos especializados.
- Status, suspensão, cancelamento e decisão financeira.
- Tarefas, atraso, prioridade, conclusão por teclado e contador.
- Upload PDF com acento e atualização do detalhe.
- Orçado, contratado, faturado, recebido, saldo, custos, desvio e percentuais.
- Exclusão com dependências, repetição e registros excluídos logicamente.
- Contraste, Axe, foco, teclado, overflow e viewport de 360 px.
- Build desktop e smoke da API empacotada em ambiente temporário.

Edição/exclusão em massa e reordenação de tarefas foram classificadas como N/A porque não existem no módulo atual. Capacidades de arquivo não exercitadas, leitor de tela, zoom nativo, concorrência e matriz visual completa foram mantidas como bloqueadas, não presumidas como aprovadas.

## 3. Arquitetura e fluxo de dados

A técnica de `audit-context-building` foi usada para mapear limites, persistência e consumidores antes das alterações:

```text
ListagemProjetos / ProjetoDetalhes / ProjectFormModal
                  │
                  ▼
        /api/projetos e serviços relacionados
                  │
                  ▼
 contratos Zod ─► Drizzle/libSQL ─► banco local
                  │
                  ├─ clientes / propriedades
                  ├─ tarefas / documentos
                  ├─ orçamentos / parcelas / notas
                  └─ despesas / eventos financeiros
```

Três referências opcionais citadas pelo skill não estavam presentes (`OUTPUT_REQUIREMENTS.md`, `COMPLETENESS_CHECKLIST.md` e `FUNCTION_MICRO_ANALYSIS_EXAMPLE.md`). A ausência foi contornada com a matriz exigida pelo prompt, análise direta dos fluxos e testes de integração/E2E; não impediu a auditoria.

## 4. Correções entregues

1. Integridade de cliente ativo e propriedade pertencente ao cliente.
2. Contratos estritos de criação/edição, enums, datas reais, limites e coordenadas pareadas.
3. Validações específicas de licenciamento, perícia e memorial.
4. Suspensão e cancelamento com decisão financeira pendente; decisão recusada em projeto ativo.
5. Cancelamento temporal seguro de parcelas e replay idempotente.
6. Exclusão transacional com bloqueio por dependências e `404` em repetição.
7. Normalização segura de parâmetros inválidos da URL.
8. Contraste AA em estatísticas e detalhes.
9. Custo executado coerente, excluindo despesas canceladas/estornadas.
10. Legenda de status responsiva, sem colisão no card estreito.

Os detalhes de reprodução, severidade, correção e reteste estão em [ACHADOS.md](./ACHADOS.md).

## 5. Resultados funcionais e numéricos

Com uma massa conhecida de 15 projetos, a UI e a API exibiram:

- 15 projetos no total;
- 3 concluídos, 4 em andamento no prazo, 3 atrasados e 5 outros;
- produtividade de 20%;
- tempo médio de entrega de 20 dias;
- ticket médio aprovado de R$ 150,00.

No projeto principal, os resultados foram R$ 100,00 contratado, R$ 70,00 faturado, R$ 30,00 recebido, R$ 70,00 em aberto, R$ 40,00 de custo previsto e R$ 25,00 de custo realizado. A despesa cancelada de R$ 5,00 foi excluída, produzindo desvio de −R$ 15,00 e consumo de 62,5%.

A memória reproduzível está em [CALCULOS.md](./CALCULOS.md).

## 6. Testes e qualidade

| Camada | Resultado |
|---|---|
| API completa | 162/162 |
| Web completa | 171/171 |
| Electron | 18/18 |
| Web focado S05 | 11/11 |
| API focada S05 e adjacências | 5/5 arquivos |
| E2E S05 | 4/4 |
| Axe | zero violação nas páginas percorridas |
| Lint | aprovado |
| Typecheck web/API | aprovado |
| Build completo | aprovado |
| Smoke empacotado | `/api/projetos` aprovado; etapa posterior bloqueada pela Configuração Inicial |

O build final gerou e assinou novamente `GeoGestor Setup 1.0.4.exe`. O histórico de comandos e resultados está em [COMANDOS-E-RESULTADOS.md](./COMANDOS-E-RESULTADOS.md).

## 7. Segurança, integridade e isolamento

- Toda escrita de auditoria ocorreu em banco/pasta temporários com prefixo `QA-AUDIT-S05-20260911-`.
- O banco real `data/geogestor.db` manteve o SHA-256 `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471` antes e depois.
- UUIDs, enums, datas, paginação, limites, payloads extras e vínculos cruzados foram exercitados na API.
- O E2E aprovado foi removido pelo runner; 13 diretórios de tentativas falhas desta sessão também foram removidos.
- Resíduos antigos não pertencentes à Sessão 05 foram preservados.
- A árvore de trabalho já continha alterações de outras sessões; elas foram preservadas e nenhum reset/checkout destrutivo foi usado.

## 8. Evidências visuais

- [01 — lista vazia e recuperação](./evidencias/01-lista-vazia-recuperada.png)
- [02 — estatísticas e cálculos](./evidencias/02-estatisticas-calculos.png)
- [03 — estatísticas em 360 px](./evidencias/03-estatisticas-mobile.png)
- [04 — detalhe e contexto financeiro](./evidencias/04-detalhe-financeiro.png)

As capturas 02 e 04 foram inspecionadas visualmente após o último reteste. A captura 02 confirma a legenda 2×2 sem sobreposição; a captura 04 confirma R$ 25,00 no cartão de custo executado.

## 9. Bloqueios e riscos residuais

| Tema | Motivo | Tratamento recomendado |
|---|---|---|
| Smoke instalado integral | log de auditoria ausente na Configuração Inicial | resolver na Sessão 01 e repetir `release:smoke-package` |
| Leitor de tela e zoom 200% | requer validação assistiva/manual real | executar rodada manual dedicada |
| Arquivos: duplicidade/download/exclusão/reinício | jornada não coberta pelo E2E S05 atual | ampliar o runner com diretório temporário persistente por reinício |
| Concorrência de exclusão/reatribuição | ambiente atual é monoexecução local | adicionar teste transacional concorrente |
| Tema escuro e matriz ampla de viewports | amostra visual limitada | executar regressão visual multi-viewport |

## 10. Conclusão e recomendação

O núcleo de Projetos está apto para continuidade: rotas, CRUD, especializações, tarefas, upload, cálculos financeiros, status e exclusão passaram após as correções. A recomendação é **prosseguir para a Sessão 06**, mantendo como pré-condição de release final a correção do bloqueio de Configuração Inicial e uma rodada manual de acessibilidade/arquivos.

Consulte a cobertura critério a critério em [MATRIZ-DE-COBERTURA.md](./MATRIZ-DE-COBERTURA.md).
