

## Plano: Reorganizar UX — Configurações, Menu do Avatar e Importação

### Diagnóstico

**1. Página de Configurações está sobrecarregada** com 8+ blocos misturando:
- Conta pessoal (perfil, avatar, email)
- Empresa (dados, plano, equipe, template)
- Sistema (importação, notificações, integrações, zona de perigo)
- Atalhos genéricos (informações do sistema)

**2. Menu do avatar (UserMenu) está subutilizado** — só tem Configurações, Ajuda, Privacidade e Sair. Itens de conta pessoal deveriam estar acessíveis daqui.

**3. Importação está invertida:**
- `/importacao` (acessível pelo dashboard) → modo `completo` ✅ correto
- `/configuracoes` → 5 botões separados (Clientes, Propriedades, Orçamentos, Serviços, Despesas) — modo unitário, ruim e redundante

### Proposta de Reorganização

**A) Menu do Avatar (UserMenu)** — virar centro da CONTA PESSOAL

```
┌─ [Avatar] Nome do usuário ─┐
│  email@exemplo.com         │
├────────────────────────────┤
│ 👤 Meu Perfil              │ ← novo (vai para /perfil)
│ 🔔 Minhas Notificações     │ ← novo (preferências pessoais)
│ ⚙️ Configurações da Empresa│ ← renomeado, leva a /configuracoes
│ ❓ Central de Ajuda        │
│ 🛡️ Política de Privacidade │
├────────────────────────────┤
│ 🚪 Sair                    │
└────────────────────────────┘
```

**B) Nova página `/perfil`** (Conta Pessoal) — extraída de Configurações:
- Avatar (AvatarUpload)
- Nome completo
- Email
- Tema (claro/escuro/sistema)
- Preferências de notificação (alertas de pagamento, frequência)

**C) Página `/configuracoes`** (Empresa & Sistema) — fica enxuta:
- Dados da Empresa (TenantSettingsCard)
- Plano & Assinatura (PlanInfoCard)
- Gestão de Equipe (TeamManagementSection)
- Template de Orçamento
- Integrações (Google Calendar)
- Zona de Perigo (excluir todos os dados — só admin)
- Informações do Sistema

**Removido de Configurações:** perfil pessoal, tema, notificações pessoais, **e os 5 botões de importação unitária**.

**D) Importação unificada em `/importacao`:**
- Mantém o modo `completo` (já existe e funciona bem)
- Adiciona uma seção secundária **"Importar entidade específica"** (collapsible/accordion) com os 5 botões — para o caso raro de quem precisa importar só clientes ou só despesas
- Configurações deixa de ter qualquer importação; ganha um link discreto "Importar dados →" que leva a `/importacao`

### Mudanças nos arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/layout/UserMenu.tsx` | Adicionar itens "Meu Perfil" e "Minhas Notificações"; renomear "Configurações" → "Configurações da Empresa" |
| `src/pages/Perfil.tsx` | **Novo** — extrai blocos de conta pessoal (avatar, nome, email, tema, notificações pessoais) |
| `src/App.tsx` | Adicionar rota `/perfil` (lazy + ProtectedRoute) |
| `src/pages/Configuracoes.tsx` | Remover blocos: Perfil do Usuário, Aparência, Notificações, e os 5 botões de import unitário. Manter só: Empresa, Plano, Equipe, Template, Google Calendar, Zona de Perigo, Info do Sistema. Adicionar link "Importar dados →" apontando para `/importacao` |
| `src/pages/ImportacaoDados.tsx` | Adicionar seção colapsável "Importar entidade específica" com 5 botões abrindo SmartImporter no modo correspondente |

Sem migrações. Sem mudanças no backend. Apenas reorganização de UI/rotas.

### Princípio
- **Avatar** = "Eu, minha conta"
- **Configurações** = "Minha empresa, meu sistema"
- **Importação** = um único lugar, com modo "tudo de uma vez" em destaque e modos específicos como avançado

