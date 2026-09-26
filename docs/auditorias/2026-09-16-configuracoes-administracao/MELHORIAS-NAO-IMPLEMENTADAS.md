# Melhorias não implementadas

| Prioridade | Item | Benefício | Esforço/risco | Motivo |
|---|---|---|---|---|
| 1 | Corrigir regressão financeira herdada | libera suíte global | médio/alto; fora do escopo administrativo | falha 186/187 pertence à Sessão 07/13 |
| 2 | Regenerar e assinar manifesto de release | libera verificação do candidato | médio; governança de release | Sessão 15, publicação não autorizada aqui |
| 3 | Concorrência otimista em catálogos/propriedades | evita overwrite silencioso | alto; mudança de contrato/schema | débito herdado, requer decisão de produto |
| 4 | Ensaio físico de restauração/reinício instalado | eleva confiança de recuperação real | médio; ambiente descartável instalado | bloqueado no ambiente automatizado |
| 5 | Narrator, alto contraste e zoom 200% reais | cobre acessibilidade assistiva | médio; validação manual | sem sessão física dedicada |
| 6 | Offline/reconexão e lock SQLite reais | prova recuperação sob falha física | alto; risco operacional | não havia isolamento físico suficiente |
| 7 | Validar Google OAuth/sincronização externa | comprova integração ponta a ponta | médio; credenciais/agenda QA | não autorizado |
| 8 | Validar entrega de notificação nativa | comprova integração Windows | baixo/médio; permissão do SO | ambiente sem permissão controlada |
| 9 | Ampliar filtros/exportação de Auditoria | melhora investigação administrativa | médio; mudança de produto | prompt proíbe novos filtros sem aprovação |
| 10 | Aplicar/editar/renomear esquemas | transforma esquema em fluxo reutilizável explícito | alto; UX/API novas | fora do contrato atual |
| 11 | Relatório final da Sessão 11 | fecha rastreabilidade histórica | baixo, se artefato existir | arquivo não localizado; não foram inventados resultados |

Nenhuma dessas melhorias é necessária para considerar corrigidos os quatro defeitos reproduzidos da Sessão 14. As quatro primeiras, contudo, devem ser tratadas antes da publicação de release.
