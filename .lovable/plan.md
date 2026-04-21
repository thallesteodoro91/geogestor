

## Plano: Hub Único de Configurações com Abas

### Diagnóstico

Hoje há **duas páginas separadas** que confundem o usuário:

| Página | Conteúdo atual | Problema |
|---|---|---|
| `/perfil` | Dados pessoais, avatar, tema, notificações de pagamento | Mistura conta pessoal com config de empresa (notificações ficam em settings do tenant, não do usuário) |
| `/configuracoes` | Empresa, plano, equipe, template PDF, Google Calendar, importação, zona de perigo, "info do sistema" | Lista vertical sem hierarquia — tudo aparece de uma vez, sem foco |

**Duplicações detectadas:**
- "Tema" no Perfil + ThemeToggle no header → duplicado
- "Importação" como atalho em Configurações + item no UserMenu (já removemos do sidebar) → atalho em Configurações vira ruído
- "Informações do Sistema" em Configurações é um card vazio que só repete contagens já mostradas no PlanInfoCard

**No UserMenu (avatar):** "Meu Perfil" e "Minhas Notificações" → ambos vão para `/perfil`. Item duplicado sem motivo.

### Nova arquitetura

**Uma única página `/configuracoes` com 4 abas verticais (sidebar interna em desktop, dropdown em mobile):**

```
/configuracoes
├── 👤 Conta              ← prioridade 1 (mais usado)
├── 🏢 Empresa            ← prioridade 2 (admins)
├── 🔔 Notificações       ← prioridade 3
└── 🔌 Integrações        ← prioridade 4
```

**Aba 👤 Conta** (todo usuário)
- Avatar (AvatarUpload)
- Nome completo, e-mail
- Botão "Alterar senha" (envia link via `supabase.auth.resetPasswordForEmail`)
- Preferências: Tema (claro/escuro/sistema)

**Aba 🏢 Empresa** (somente admin — não-admin vê estado read-only)
- Nome da empresa, identificador (slug)
- Plano atual + uso de recursos (PlanInfoCard)
- Equipe (TeamManagementSection)
- Template de orçamento PDF
- **Zona de perigo** (excluir todos os dados) — colapsável no rodapé

**Aba 🔔 Notificações** (todo usuário, mas algumas são tenant-level só para admin)
- **Alertas de pagamento** (toggle, antecedência, frequência) — admin
- **Canais:** sistema (sempre on), e-mail (toggle por tipo) — futuro
- **Tipos de alerta** (lista clara com toggles individuais):
  - Pagamentos próximos do vencimento
  - Pagamentos vencidos
  - Novos orçamentos / conversões
  - Tarefas atribuídas a mim

**Aba 🔌 Integrações** (admin)
- Google Calendar (GoogleCalendarCard)
- Importação de dados → botão grande "Abrir Importador" → `/importacao`

### Mudanças no UserMenu (avatar)

Remover item duplicado. Estrutura final:
```
[Nome do usuário]
[email]
─────────────
⚙️  Configurações       → /configuracoes (abre na aba Conta)
🛡️  Política de Privacidade
❓ Central de Ajuda
─────────────
🚪 Sair
```

Removidos: "Meu Perfil" e "Minhas Notificações" (agora são abas dentro de Configurações).

### Mudanças nas rotas

- `/perfil` → redirect 301 para `/configuracoes?tab=conta`
- `/configuracoes` → suporta query `?tab=conta|empresa|notificacoes|integracoes` (deep link a partir de qualquer lugar)

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/Configuracoes.tsx` | **Reescrita completa** — Tabs com 4 abas, lê `?tab=` da URL |
| `src/pages/Perfil.tsx` | **Deletar** (conteúdo vai para aba Conta) |
| `src/components/settings/AccountTab.tsx` | **Novo** — avatar, nome, email, senha, tema |
| `src/components/settings/CompanyTab.tsx` | **Novo** — empresa + plano + equipe + template + zona de perigo |
| `src/components/settings/NotificationsTab.tsx` | **Novo** — toggles de alertas (extraído de Perfil.tsx + expandido com tipos) |
| `src/components/settings/IntegrationsTab.tsx` | **Novo** — Google Calendar + atalho importação |
| `src/components/layout/UserMenu.tsx` | Remover "Meu Perfil" e "Minhas Notificações"; manter "Configurações" |
| `src/App.tsx` | Adicionar redirect `/perfil` → `/configuracoes?tab=conta` |

Sem migrações. Sem mudanças de schema. Reorganização de UI puramente.

### Princípio
- **Conta** = "Eu" (o que muda só pra mim)
- **Empresa** = "Nós" (o que muda pra todos do tenant)
- **Notificações** = "O que o sistema me avisa"
- **Integrações** = "Como o sistema fala com o mundo"

Cada coisa em UM lugar. Sem duplicação. Sem dúvida.

