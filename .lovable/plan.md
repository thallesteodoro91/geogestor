

## Analise SaaS do GeoGestor - Melhorias Identificadas

---

### 1. ASSINATURA E COBRANCA

#### 1.1 Sem integracao de pagamento (CRITICO)
Nao existe integracao com gateway de pagamento (Stripe, etc.). O sistema registra planos e precos (Trial R$0, Completo R$197/mes, Semestral R$1.005, Anual R$1.773), mas nao ha fluxo real de cobranca. O trial expira e nada acontece -- o usuario continua usando normalmente porque nao ha mecanismo de bloqueio automatico.

#### 1.2 Trial sem bloqueio apos expiracao (CRITICO)
O tenant "SkyGeo" tem trial expirado (dezembro 2025), mas o sistema continua funcionando normalmente. Nao ha:
- Verificacao de data de expiracao no `ProtectedRoute` ou `TenantContext`
- Tela de bloqueio/upgrade quando o trial vence
- Rotina automatica para alterar status de `trialing` para `expired`

#### 1.3 Sem pagina de escolha de plano (IMPORTANTE)
O `PlanInfoCard` mostra o plano atual mas nao oferece opcao de upgrade. Nao existe pagina de comparacao de planos ou botao funcional de "Fazer Upgrade". Os botoes "Ver Planos" nos toasts de limite redirecionam para `/configuracoes`, que nao tem seletor de planos.

#### 1.4 Planos inativos no banco
Existem 3 planos marcados como `is_active: false` (Starter, Professional, Enterprise) que sao resquicios de uma estrutura anterior. Eles poluem o banco sem utilidade.

---

### 2. CONTROLE DE ACESSO E PERMISSOES

#### 2.1 Sem controle de permissoes por role (IMPORTANTE)
O campo `role` em `tenant_members` aceita "admin" e "user", mas a unica verificacao real de role esta na pagina `AuditLogs` (verifica `user_roles` -- tabela separada) e no Edge Function `invite-user` (verifica `tenant_members.role`). Nenhuma outra funcionalidade diferencia admin de usuario comum:
- Ambos podem excluir todos os dados da empresa
- Ambos podem alterar configuracoes do tenant
- Ambos podem ver informacoes financeiras sensiveis
- A secao "Zona de Perigo" (excluir tudo) esta disponivel para todos

#### 2.2 Inconsistencia entre `user_roles` e `tenant_members.role`
A pagina `AuditLogs` verifica admin via tabela `user_roles`, enquanto o Edge Function verifica via `tenant_members.role`. Sao duas fontes de verdade diferentes para a mesma informacao. Um usuario pode ser admin em `tenant_members` mas nao ter registro em `user_roles`, resultando em acesso bloqueado aos logs de auditoria.

#### 2.3 Logs de Auditoria sem filtro de tenant
A query de `AuditLogs.tsx` busca `audit_logs` sem filtro de `tenant_id`. Se houver multiplos tenants, um admin pode ver logs de outros tenants (dependendo do RLS).

---

### 3. GESTAO DE EQUIPE

#### 3.1 Sem funcionalidade de remover membro (IMPORTANTE)
O `TeamMembersList` (nao inspecionado em detalhe, mas referenciado) provavelmente nao oferece opcao de remover um membro da equipe. Nao ha Edge Function para isso.

#### 3.2 Sem alteracao de role pos-convite
Nao ha como alterar o role de um membro apos ele aceitar o convite (de user para admin ou vice-versa).

#### 3.3 Email de convite usando dominio generico
O email de convite usa `noreply@resend.dev` (dominio de teste do Resend), que pode cair em spam ou ser bloqueado. Para producao, deveria usar um dominio proprio verificado.

---

### 4. ONBOARDING E PRIMEIRO ACESSO

#### 4.1 Onboarding minimalista demais
A pagina de onboarding pede apenas o nome da empresa. Falta:
- CNPJ / dados fiscais da empresa
- Segmento de atuacao
- Numero de funcionarios
- Wizard multi-step com configuracao inicial (importar dados, convidar equipe)
- Tour guiado pelo sistema apos criacao

#### 4.2 Criacao automatica de tenant no TenantContext
O `TenantContext` cria tenant automaticamente se nao encontrar um (linhas 87-120), o que pode competir com o fluxo de onboarding e criar tenants com nomes genericos (email do usuario ou "Minha Empresa").

#### 4.3 Pagina de Onboarding orfao
O `ProtectedRoute` nao redireciona mais para `/onboarding` (comentario na linha 96). O componente Onboarding.tsx existe mas nao e referenciado nas rotas do `App.tsx`. E codigo morto.

---

### 5. CONFIGURACOES E UX DO SAAS

#### 5.1 Informacoes hardcoded em Configuracoes (IMPORTANTE)
- "Ultimo Backup: 15 de Maio de 2025 as 14:30" -- texto estatico, nao reflete dados reais
- "1.247 registros" -- valor fixo, nao calculado
- "Versao 1.0.0" e "Ultima Atualizacao: Maio 2025" -- hardcoded
- Botoes "Exportar Dados" e "Fazer Backup" nao fazem nada

#### 5.2 Card de "Integracao AI" decorativo
O switch "Consultor Financeiro Ativo" e o seletor de "Frequencia de Analises" nao persistem e nao alteram comportamento.

#### 5.3 Sem barras de uso de recursos no PlanInfoCard
O componente `UsageBar` esta definido (linhas 10-38) mas nunca e renderizado no `PlanInfoCard`. Os contadores de clientes/propriedades/usuarios sao recebidos como props mas nao exibidos.

#### 5.4 Nome do sistema inconsistente
O sistema e chamado de "SkyGeo 360" na tela de login, "GeoGestor" no PWA manifest/titulo, "TopoVision Dashboard" na descricao de Configuracoes, e "Performance & Insights" no subtitulo do sidebar. Precisa de consistencia de marca.

---

### 6. SEGURANCA SAAS

#### 6.1 `TenantSettingsCard` sem verificacao de role
Qualquer membro do tenant pode alterar o nome da empresa e configuracoes de alerta. Deveria ser restrito a admins.

#### 6.2 Secao "Dados e Backup" sem protecao
O botao "Excluir Todos os Dados" esta disponivel para qualquer membro, sem verificacao de role admin. Isso e extremamente perigoso.

#### 6.3 Geracao de dados demo disponivel para todos
Qualquer membro pode gerar 50 clientes ficticios, o que pode poluir dados reais de producao.

---

### 7. CORRECOES PRIORITARIAS

#### Prioridade 1 - Criticas
1. **Implementar bloqueio de trial expirado**: Verificar `current_period_end` no `ProtectedRoute` e mostrar tela de upgrade quando expirado
2. **Adicionar barras de uso** ao `PlanInfoCard` (o componente `UsageBar` ja existe, so precisa ser renderizado)
3. **Restringir acoes destrutivas a admins**: Excluir dados, alterar tenant, gerar demo

#### Prioridade 2 - Importantes
4. **Unificar fonte de verdade de roles**: Usar `tenant_members.role` como unica fonte, remover dependencia de `user_roles` nos AuditLogs
5. **Pagina de planos/upgrade**: Criar pagina comparativa de planos com CTAs de upgrade
6. **Remover informacoes hardcoded** de Configuracoes (backup, versao, registros)
7. **Remover cards decorativos** ou funcionaliza-los (Integracao AI)

#### Prioridade 3 - Melhorias
8. **Consistencia de marca**: Padronizar nome do sistema em todos os pontos
9. **Funcionalidade de remover membro** e alterar role
10. **Limpar planos inativos** do banco de dados
11. **Remover pagina Onboarding.tsx** e rota orfao
12. **Dominio proprio para emails** de convite

---

### Resumo

| Area | Criticos | Importantes | Melhorias |
|------|----------|-------------|-----------|
| Assinatura | 2 | 1 | 1 |
| Permissoes | 0 | 2 | 1 |
| Equipe | 0 | 1 | 2 |
| Onboarding | 0 | 0 | 3 |
| Config/UX | 0 | 2 | 2 |
| Seguranca | 0 | 3 | 0 |
| **Total** | **2** | **9** | **9** |

O maior risco SaaS e a ausencia de bloqueio pos-trial e de integracao de pagamento. Um usuario pode continuar usando indefinidamente sem pagar. A segunda preocupacao e a falta de controle de acesso por role -- qualquer membro pode executar acoes destrutivas.

