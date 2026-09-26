# Relatório de auditoria — Sessão 06: Ambiental

**Data:** 11/09/2026  
**Responsável:** auditoria técnica assistida  
**Escopo:** demandas ambientais, perícias, licenças, condicionantes, alertas, Análise CAR, histórico e laudos PDF  
**Resultado geral:** **APROVADO COM RESSALVAS**

## 1. Resumo executivo

A Sessão 06 foi auditada em código, contratos, API Fastify, SQLite isolado, interface React real via Playwright, geração de PDF e pacote desktop. A matriz contém **152 critérios encerrados**:

| Situação | Quantidade |
|---|---:|
| APROVADO | 94 |
| APROVADO APÓS CORREÇÃO | 44 |
| REPROVADO | 0 |
| BLOQUEADO | 9 |
| NÃO APLICÁVEL | 5 |
| **Total** | **152** |

Foram reproduzidos e corrigidos **18 defeitos: 0 P0, 6 P1, 12 P2 e 0 P3**. Não restou defeito P0/P1 nem reprovação aberta no escopo. O status mantém ressalvas apenas por nove verificações que dependem de ambiente/manualidade não disponível, como leitor de tela real, impressão física, matriz visual ampla, virada real da meia-noite e concorrência multiprocesso.

O antigo bloqueio herdado do smoke empacotado foi resolvido: o script consumia o formato antigo de `/api/audit-logs`. Após a compatibilização com o objeto paginado, o smoke passou integralmente.

## 2. Escopo efetivamente comprovado

- `/ambiental`, abas `ambiental`, `licenciamento` e `car`, rotas de detalhe e redirects legados;
- navegação por URL, clique e teclado, fallback seguro e normalização de parâmetros;
- demandas Ambiental/Perícia, filtros, paginação, tarefas, próxima ação, fases e andamentos;
- licenças LP/LI/LO/Renovação/Outros, status registrado/efetivo e janelas de prazo;
- condicionantes, vínculo aninhado, cumprimento, exclusão lógica, contadores e deep link;
- alertas de licença/condicionante, incluindo exclusões e estados encerrados;
- Análise CAR com quatro percentuais regionais, arts. 15, 67 e 68, centésimos e entradas inválidas;
- histórico CAR persistido, vínculo com cliente/projeto e registro legado inválido;
- quatro tipos de laudo PDF, nome Windows seguro, acentos, conteúdo e download;
- contratos Zod estritos, datas reais, atomicidade, soft delete, auditoria e proteção de segredos;
- responsividade de 360 px, viewport desktop de 1120 px, teclado e Axe WCAG 2.2 A/AA;
- regressões completas de API, web e Electron, build NSIS e smoke da API empacotada.

## 3. Contexto arquitetural

A técnica `audit-context-building` orientou o mapeamento dos limites e consumidores antes das correções:

```text
Ambiental / Licenciamento / Análise CAR
                 │
                 ▼
        contratos Zod + Fastify
                 │
                 ▼
       Drizzle/libSQL transacional
       ├─ projetos / ambiental / perícias
       ├─ tarefas / interações / audit_logs
       ├─ licenças / condicionantes
       ├─ cálculos_salvos
       └─ alertas derivados
                 │
                 └─ pdfmake → downloads isolados
```

As três referências opcionais citadas pelo skill não existiam no pacote local; a matriz exigida pelo prompt, a leitura direta e as campanhas integradas supriram essa ausência sem bloquear o trabalho.

## 4. Correções entregues

1. Próxima tarefa com prazo ordenada antes de tarefa sem prazo.
2. Contratos estritos para queries, fases, andamentos, licenças, condicionantes e cálculos.
3. Datas validadas como calendário real e comparadas pelo dia civil de São Paulo.
4. Integridade de cliente ativo, propriedade/projeto e tipo de projeto do cálculo ambiental.
5. Reatribuição do projeto de licença bloqueada e PATCH validado após mesclagem.
6. Licenças de projetos excluídos removidas de listas, resumos e alertas.
7. Exclusão lógica transacional de licença com cascata das condicionantes.
8. Condicionantes aninhadas restritas à licença pai ativa, com cumprimento/data coerentes.
9. Status legado desconhecido preservado e explicitamente sinalizado.
10. Alertas sem licenças encerradas ou ancestrais removidos.
11. Histórico CAR resiliente a JSON legado malformado.
12. Parser CAR localizado, sem científica/NaN/negativos e com invariantes territoriais.
13. Fórmulas CAR isoladas em módulo puro com cobertura unitária.
14. URL principal canônica, sem ação invisível entre abas.
15. Deep link de condicionante com aba, scroll, destaque e foco após render.
16. Modal/PDF com labels, limites, estado de geração, nome seguro e datas pt-BR.
17. Contraste AA corrigido em datas e metadados de histórico/condicionantes.
18. Smoke empacotado compatível com resposta paginada de auditoria.

Reprodução, causa raiz e reteste constam em [ACHADOS.md](./ACHADOS.md).

## 5. Resultados ambientais e cálculos

Para um imóvel de 100 ha, as referências conferidas foram 20 ha em demais regiões, 80 ha em floresta da Amazônia Legal, 35 ha em cerrado da Amazônia Legal e 20 ha em campos gerais. No cenário base com 10 ha de APP e 15 ha fora de APP:

- sem as três condições do art. 15: 15 ha computados e déficit preliminar de 5 ha;
- com as três condições: 25 ha computados e excedente potencial de 5 ha;
- art. 67 com 4 módulos, existência em 22/07/2008 e remanescente de 10 ha: referência de 10 ha;
- art. 68: somente aviso de análise documental, nunca regularidade automática;
- limites de 19,99 e 20,01 ha preservaram déficit/excedente de 0,01 ha.

A memória completa está em [CALCULOS-CAR.md](./CALCULOS-CAR.md). A Lei nº 12.651/2012 e orientações oficiais do CAR/SFB foram consultadas e registradas em [FONTES-NORMATIVAS.md](./FONTES-NORMATIVAS.md).

## 6. Testes e artefatos

| Camada | Resultado |
|---|---|
| API completa | 163/163 |
| Web completa | 179/179 |
| Electron | 18/18 |
| API focada S06 | 1/1 |
| CAR/PDF focado | 8/8 |
| E2E S06 | 5/5 |
| Axe | zero violação nas jornadas finais |
| Lint | aprovado |
| Typecheck web/API | aprovado |
| Build completo | aprovado |
| Smoke empacotado | aprovado após correção |

O build produziu `GeoGestor Setup 1.0.4.exe`, com 89.958.435 bytes e SHA-256 `BC91B86E37F1D989831CD9AD6A0B9CF40B46982A491CC9D06A00AAC5DE57C56B`. Detalhes em [COMANDOS-E-RESULTADOS.md](./COMANDOS-E-RESULTADOS.md).

## 7. Segurança, persistência e limpeza

- Escritas ocorreram exclusivamente em bancos/diretórios descartáveis e com prefixo `QA-AUDIT-S06-20260911-`.
- O banco real `data/geogestor.db` permaneceu com 1.990.656 bytes, modificação de 30/08/2026 e SHA-256 `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471` antes e depois.
- Fase + histórico + auditoria, licença + auditoria, condicionante + auditoria e cálculo + auditoria foram exercitados em transações.
- Payloads extras, datas impossíveis, UUIDs, vínculos cruzados, texto inerte, nome de arquivo adversarial e registros removidos foram testados.
- O smoke confirmou banco empacotado criptografado e ausência de senha/token serializados em auditoria.
- Quinze diretórios temporários próprios foram removidos; a verificação final indicou zero diretório S06 e zero execução do dia em `scratch`.
- As nove evidências deliberadamente preservadas contêm apenas dados sintéticos.
- Alterações preexistentes e resíduos antigos de outras campanhas foram preservados.

## 8. Evidências

- [01 — estado vazio e recuperação](./evidencias/01-estado-vazio-recuperado.png)
- [02 — demanda, histórico e prazos](./evidencias/02-demanda-historico-e-prazos.png)
- [03 — licenças e fronteira de 30 dias](./evidencias/03-licencas-fronteira-30-dias.png)
- [04 — condicionante por link profundo](./evidencias/04-condicionante-link-profundo.png)
- [05 — CAR móvel e validação](./evidencias/05-car-mobile-validacao.png)
- [Laudo — vistoria](./evidencias/laudo-vistoria.pdf)
- [Laudo — fauna](./evidencias/laudo-fauna.pdf)
- [Laudo — flora](./evidencias/laudo-flora.pdf)
- [Laudo — genérico](./evidencias/laudo-outros.pdf)

## 9. Arquivos de código alterados nesta sessão

| Área | Arquivos | Motivo |
|---|---|---|
| Contratos/API | `packages/contracts/src/environmental.ts`; `ambiental.routes.ts`; `licencas.routes.ts`; `operational-data.routes.ts` | schemas estritos, datas, merge, status e serialização |
| Integridade/alertas | `relationship-integrity.service.ts`; `deadline-alerts.service.ts` | vínculos ativos, cascata e alertas sem órfãos |
| Demandas/licenças | `AmbientalDetalhes.tsx`; `ListagemAmbiental.tsx`; `LicencaDetalhes.tsx`; `LicenseFormModal.tsx`; `ConditionFormModal.tsx` | navegação, foco, datas, contraste e limites |
| CAR/histórico | `CalculadoraAmbiental.tsx`; `environmentalCalculation.ts`; `CalculationHistory.tsx`; `NumericInput.tsx` | parser, fórmulas e legado resiliente |
| PDF | `GeradorLaudoModal.tsx`; `laudoPdfGenerator.ts` | acessibilidade, estado, data e filename seguro |
| Release | `scripts/smoke-packaged-api.mjs` | aceitar resposta paginada de auditoria |
| Testes | `session06-environmental.integration.test.ts`; `environmentalCalculation.test.ts`; `laudoPdfGenerator.test.ts`; `session06-environmental.spec.ts` | regressão focada API/unit/E2E |

Nenhuma modificação de outras sessões foi atribuída a esta campanha.

## 10. Bloqueios e riscos residuais

| Tema | Motivo | Tratamento recomendado |
|---|---|---|
| Reconexão/offline nativa | rede do host não foi interrompida | campanha controlada com proxy ou adaptador virtual |
| Impressão física | impressora/spooler não disponíveis | validar uma cópia dos quatro laudos |
| Lista com milhares de licenças | API atual não pagina | benchmark dedicado antes de grande base |
| Concorrência multiprocesso | execução local foi serial | teste com dois clientes/processos |
| Virada real da meia-noite | relógio do host não foi alterado | teste com relógio injetável |
| Leitor de tela real | NVDA/JAWS não operados | rodada assistiva manual |
| Matriz visual completa | amostra visual em 360/1120 e tema claro | 768/1024/1440, 200% e tema escuro |
| Stress de lock SQLite | não executado | ensaio de lock/timeout isolado |
| Upgrade sobre instalação anterior | afetaria perfil real | VM ou perfil descartável dedicado |

## 11. Melhorias não implementadas

| Prioridade | Melhoria | Benefício | Esforço | Risco |
|---|---|---|---|---|
| 1 | Paginação/virtualização de licenças | escala para bases grandes | médio | médio |
| 2 | Relógio injetável para regras de prazo | testes determinísticos de meia-noite/DST | médio | baixo |
| 3 | Reabertura detalhada de cálculo salvo | comparação e rastreabilidade operacional | médio | médio |
| 4 | Exportar memória CAR anexável ao projeto | documentação do processo | médio | médio |
| 5 | Upload estruturado de comprovante da condicionante | melhor rastreabilidade documental | alto | médio |

São evoluções de produto, não correções comprovadas; por isso não foram implementadas sem aprovação.

## 12. Conclusão e recomendação

O núcleo Ambiental está apto para continuidade: não há reprovação aberta, os 18 defeitos foram corrigidos, as fórmulas e ressalvas jurídicas do CAR foram verificadas, e o pacote passou build e smoke. A recomendação objetiva é **iniciar a Sessão 07 — Financeiro**, mantendo os nove itens manuais/ambientais como dívida de validação pré-release, não como bloqueio da próxima auditoria.

Consulte a cobertura completa em [MATRIZ-DE-COBERTURA.md](./MATRIZ-DE-COBERTURA.md).
