# Achados — Sessão 03 — Comercial — CRM e Funil

Todos os sete defeitos reproduzidos foram corrigidos e retestados. Não há achado pendente.

## S03-F01 — API de leads aceitava dados inválidos e operações inconsistentes — P1

- Camada/rota: API, `/api/contatos`.
- Passos: em banco isolado, enviar POST com nome em branco, e-mail/telefone inválidos ou campo extra; repetir e-mail/telefone; atualizar/excluir ID ausente.
- Esperado: 400/409/404 e nenhuma gravação. Obtido antes: nome vazio retornava 200 e a rota não aplicava contrato estrito, normalização ou existência uniforme.
- Evidência: primeira execução vermelha de `session03-crm-funnel.integration.test.ts`; após a correção, suíte API 8/8.
- Causa raiz: corpo consumido sem schema servidor completo.
- Arquivo/endpoints: `apps/api/src/routes/contatos.routes.ts`; POST/PUT/DELETE contatos.
- Correção: Zod estrito, data real, trim, e-mail minúsculo, telefone em dígitos, duplicidade ativa, HTTP coerente e transações.
- Reteste: API 8/8; E2E 3/3.

## S03-F02 — Contrato de oportunidades permitia combinações e datas inválidas — P1

- Camada/rota: contrato/API, POST/PATCH/reorder oportunidades.
- Passos: enviar data inexistente, próxima ação sem data, campo extra, limites inválidos ou IDs repetidos na ordem.
- Esperado: rejeição determinística. Obtido antes: validação lexical/parcial e reorder sem unicidade de IDs.
- Evidência: casos negativos da nova suíte API.
- Causa raiz: schema não estrito e sem validação de calendário, par de campos ou IDs únicos.
- Arquivos: `packages/contracts/src/opportunities.ts`, `apps/api/src/services/oportunidades.service.ts`.
- Correção: YYYY-MM-DD real, `.strict()`, refinamento ação/data e IDs únicos.
- Reteste: domínio + integração, 8/8.

## S03-F03 — Escritas do funil não deixavam auditoria completa — P1

- Camada: serviço/API/banco.
- Passos: criar, editar, transicionar, reordenar, vincular orçamento, converter projeto ou excluir oportunidade.
- Esperado: evento sanitizado por operação. Obtido antes: histórico de etapa existia, mas a trilha operacional não cobria todas as mutações.
- Evidência: consultas a `audit_logs` no teste isolado; metadados não contêm `<script>`, e-mail ou telefone.
- Causa raiz: chamadas de auditoria ausentes.
- Arquivos: `apps/api/src/services/oportunidades.service.ts`, `apps/api/src/routes/contatos.routes.ts`.
- Correção: auditoria transacional com metadados mínimos.
- Reteste: API 8/8 e verificações DB.

## S03-F04 — Formulário de lead não protegia descarte nem associava erros — P2

- Camada/rota: frontend, `/crm?view=leads`.
- Passos: editar Novo lead e fechar; submeter nome/e-mail/telefone/data inválidos.
- Esperado: confirmar descarte, erro junto ao campo e foco no primeiro erro. Obtido antes: descarte silencioso e validação insuficiente.
- Evidência: E2E de descarte/validação e Axe.
- Causa raiz: ausência de snapshot sujo e mapa de erros.
- Arquivo: `apps/web/src/pages/Contatos/Contatos.tsx`.
- Correção: confirmação, foco, `aria-invalid`, `aria-describedby`, limites e normalização.
- Reteste: E2E 3/3; typecheck web aprovado.

## S03-F05 — Cartão do kanban continha controles interativos aninhados — P1

- Camada/rota: frontend/a11y, `/crm?view=funil`.
- Passos: executar Axe/árvore acessível no funil populado e navegar por teclado.
- Esperado: alça de arraste e ações como controles irmãos. Obtido: propriedades da alça no `article`, envolvendo botões e links.
- Evidência: Axe vermelho antes e zero violações após correção.
- Causa raiz: `dragHandleProps` aplicado ao cartão inteiro.
- Arquivo: `apps/web/src/pages/CRM/CRM.tsx`.
- Correção: botão dedicado “Arrastar …”, ícone decorativo, foco no scroll e alternativa de transição.
- Reteste: E2E/Axe no funil populado.

## S03-F06 — Contraste insuficiente no funil e histórico — P2

- Camada/rota: frontend/a11y, funil e modal de histórico.
- Passos: Axe no estado populado e modal aberto.
- Esperado: WCAG AA. Obtido: data vencida e textos do histórico abaixo de 4,5:1; o estado transiente da animação também reduzia contraste.
- Evidência: ciclo Axe vermelho; `evidencias/06-historico-oportunidade.png` após correção.
- Causa raiz: tokens fracos para fonte pequena e medição antes do fim da animação.
- Arquivo: `apps/web/src/pages/CRM/CRM.tsx`.
- Correção: cores fortes e espera pela opacidade final no teste.
- Reteste: Axe zero com modal aberto.

## S03-F07 — Toast de sucesso ilegível no tema escuro — P2

- Camada: frontend global, resposta da exclusão.
- Passos: excluir oportunidade e executar Axe com o toast presente.
- Esperado: contraste AA. Obtido: `#86efac` sobre `#ecfdf3`, 1,33:1.
- Evidência: ciclo Axe vermelho; E2E final 3/3.
- Causa raiz: regra escura alterava só o texto enquanto o fundo rico permanecia claro.
- Arquivo: `apps/web/src/index.css`.
- Correção: fundo `#052e16`, borda `#166534`, texto `#bbf7d0`.
- Reteste: Axe zero em Indicadores claro/escuro.

## Melhorias não implementadas

| Prioridade | Melhoria | Benefício | Esforço | Risco |
|---|---|---|---|---|
| 1 | Política de concorrência/versão para reorder | Evita última escrita entre usuários | médio | decisão de produto e migração |
| 2 | Leitor de tela e zoom nativo 200% | Amplia evidência assistiva | médio | rodada manual |
| 3 | Ordenação de leads | Facilita bases grandes | médio | nova função não autorizada |
| 4 | Importação em lote em Leads | Reduz cadastro manual | alto | nova função e deduplicação |
