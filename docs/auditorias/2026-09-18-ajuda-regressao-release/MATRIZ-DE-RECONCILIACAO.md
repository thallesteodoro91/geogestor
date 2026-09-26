# Matriz de reconciliação das sessões anteriores

| Tema herdado | Origem | Estado nesta sessão | Evidência/decisão |
|---|---|---|---|
| Bloqueio financeiro histórico | sessões financeiras anteriores | resolvido no teste automatizado | fixture relativa; API 190/190 |
| Divergência de versão da Ajuda | governança/pré-release | corrigido | versão mínima 1.0.4 |
| Nome do instalador fixo | governança/pré-release | corrigido na configuração | usa `${version}`; candidato não gerado |
| Manifestos/hashes antigos | pré-release | não promovidos | artefatos existentes são históricos |
| Ausência de Sessão 11 | relatórios antigos | superada por evidência de 17/09 | dossiê `docs/auditorias/2026-09-17-relatorios/` existe |
| 19 testes humanos | homologação 01/08 | permanece pendente | 0/19 executados no candidato final |
| Concorrência otimista | sessões anteriores | permanece pendente | não encerrada por esta auditoria |
| Revisão jurídica | documentação comercial | permanece pendente | publicação bloqueada |
| Authenticode | pré-release | risco aceito, teste real pendente | frase obrigatória preservada |
| Links internos literais | baseline de governança | melhorado, não encerrado | 70 → 60; zero novos |
| Ativos sem consumidor | baseline de governança | inconclusivo | 28 ocorrências avisadas |
| Endpoints repetidos | baseline de governança | dívida aceita temporariamente | sem aumento bloqueante observado |
| `temp-lovable` | histórico | permanece para decisão do proprietário | não aberto nem removido |
| Ajuda operacional | escopo desta sessão | aprovada com ressalvas | 20 artigos e 3 E2E verdes |
| Pesquisa global | escopo desta sessão | corrigida funcionalmente | seis tipos, removidos excluídos e limites testados |
| Gate integral E2E | escopo desta sessão | reprovado | 56/90 passaram, 13 falharam, 21 não rodaram |
| Release/publicação | escopo desta sessão | bloqueado/não executado | worktree sujo e ausência de autorização |

## Regra de prevalência

Evidência mais recente substitui apenas a conclusão específica que retestou. Ela não apaga riscos de outro gate. Assim, os retestes focados verdes encerram os defeitos de contraste e altura, mas não transformam a execução integral vermelha em verde; a configuração correta do pacote também não equivale a um instalador validado.
