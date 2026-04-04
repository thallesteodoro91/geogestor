

## Plano: Reestruturação Completa da Arquitetura e Navegação do SkyGeo

### Diagnóstico dos Problemas Atuais

1. **Duplicação Clientes vs Cadastros** — A página Cadastros tem uma aba "Clientes e Propriedades" que duplica exatamente o módulo Clientes. Ambos listam clientes, editam, excluem. Confunde o usuário.
2. **"Serviços" = "Projetos"** — O sistema já usa `fato_servico` como entidade de projeto/execução. Renomear para "Projetos" dá clareza sem mudar o banco.
3. **Importação espalhada** — Botão "Importar Planilha" aparece em Clientes, Serviços, Despesas, Orçamentos e Configurações. 5 pontos de entrada para a mesma ferramenta.
4. **Navegação com 6 seções** — Muitas categorias, itens como "Operacional" e "Relatório Executivo" confundem.

### Mudanças Planejadas

---

#### 1. Reestruturar Navegação (Sidebar)

Nova estrutura do menu:

```text
VISÃO GERAL
  Dashboard 360
  Dashboard Financeiro

OPERAÇÃO
  Projetos          (era "Serviços")
  Orçamentos        (era "Serviços e Orçamentos" em ServicosOrcamentos)
  Despesas
  Calendário

RELACIONAMENTO
  Clientes           (HUB central)

CONFIGURAÇÕES
  Cadastros          (só tipos de serviço + tipos de despesa)
  Importação de Dados (SmartImporter centralizado)
  Configurações
  Central de Ajuda

INTELIGÊNCIA
  GeoBot
  Relatório Executivo
  Logs de Auditoria
```

**Arquivo:** `src/components/layout/Sidebar.tsx`

---

#### 2. Transformar Clientes em HUB Central

A página Clientes já é funcional. Melhorias:
- Renomear título de "Clientes e Projetos" para "Clientes"
- Adicionar colunas "Receita Gerada" e "Última Atividade" na tabela
- Remover botão "Importar Planilha" do header (ficará em módulo centralizado)
- Adicionar action bar contextual: "Você tem X clientes sem projetos ativos"

**Arquivo:** `src/pages/Clientes.tsx`

---

#### 3. Renomear "Serviços" para "Projetos"

Mudança de nomenclatura em toda a UI (sem alterar banco de dados):
- Título: "Projetos" em vez de "Serviços"
- Subtítulo: "Gerencie a execução dos seus projetos"
- Botão: "+ Novo Projeto"
- KPIs e filtros mantêm a mesma lógica

**Arquivos:** `src/pages/Servicos.tsx`, `src/pages/ServicoDetalhes.tsx`, `src/components/layout/Sidebar.tsx`

---

#### 4. Limpar Cadastros — Remover Clientes

Remover a aba "Clientes e Propriedades" de Cadastros. Manter apenas:
- Tipos de Serviço (catálogo de serviços)
- Tipos de Despesa (categorias de custo)

Renomear título para "Cadastros e Configurações do Sistema".

**Arquivo:** `src/pages/Cadastros.tsx`

---

#### 5. Criar Página de Importação Centralizada

Nova página `/importacao` com o SmartImporter como protagonista. O usuário escolhe o que importar (Clientes, Projetos, Orçamentos, Despesas, Propriedades) num único fluxo.

Remover botões "Importar Planilha" de:
- Clientes.tsx
- Servicos.tsx
- Despesas.tsx
- ServicosOrcamentos.tsx

Manter apenas no módulo centralizado e no onboarding.

**Novo arquivo:** `src/pages/ImportacaoDados.tsx`
**Editar:** `src/App.tsx` (nova rota), páginas acima (remover botões)

---

#### 6. Atualizar Rotas

| Rota atual | Nova rota | Nota |
|------------|-----------|------|
| `/servicos` | `/projetos` | Renomear |
| `/servicos/:id` | `/projetos/:id` | Renomear |
| `/servicos-orcamentos` | `/orcamentos` | Simplificar |
| — | `/importacao` | Nova |
| `/clientes` | `/clientes` | Mantém |
| `/cadastros` | `/cadastros` | Mantém (sem clientes) |

Adicionar redirects de rotas antigas para novas.

**Arquivo:** `src/App.tsx`

---

#### 7. Padronizar Status Badges (Design System)

Criar utilitário centralizado `src/lib/statusColors.ts` com mapa global:

| Cor | Significado |
|-----|-------------|
| Verde (emerald) | Ativo, Concluído, Pago |
| Amarelo (amber) | Em Andamento, Pendente, Atenção |
| Vermelho (rose) | Atrasado, Cancelado, Inativo, Crítico |
| Azul (blue) | Planejado, Em Revisão |
| Cinza (slate) | Indefinido, Neutro |

Substituir badges inline espalhados por função centralizada. Os arquivos `serviceStatus.ts` e `budgetStatus.ts` já existem; criar um wrapper unificado.

**Novo arquivo:** `src/lib/statusColors.ts`
**Editar:** `src/pages/Clientes.tsx`, `src/pages/Cadastros.tsx` (remover badges inline)

---

#### 8. Atualizar Breadcrumbs e Referências Cruzadas

- ClienteDetalhes: breadcrumb "Base de Dados" → "Clientes"
- ServicoDetalhes: breadcrumb atualizado para "Projetos"
- OnboardingPageBanner: atualizar labels de "servico" para "projeto"
- OnboardingChecklist: atualizar microcopy

**Arquivos:** `src/pages/ClienteDetalhes.tsx`, `src/pages/ServicoDetalhes.tsx`, `src/hooks/useOnboarding.ts`, `src/components/onboarding/OnboardingChecklist.tsx`

---

### Resumo de Impacto

| Mudança | Prioridade | Complexidade |
|---------|-----------|-------------|
| Nova navegação Sidebar | Alta | Baixa |
| Limpar Cadastros (remover clientes) | Alta | Baixa |
| Renomear Serviços → Projetos | Alta | Média |
| Criar Importação Centralizada | Alta | Baixa |
| Remover botões import espalhados | Alta | Baixa |
| Enriquecer HUB Clientes | Média | Média |
| Padronizar status badges | Média | Baixa |
| Atualizar rotas + redirects | Alta | Média |
| Atualizar breadcrumbs/onboarding | Baixa | Baixa |

### Arquivos

| Ação | Arquivo |
|------|---------|
| Reescrever | `src/components/layout/Sidebar.tsx` |
| Editar | `src/pages/Clientes.tsx` |
| Editar | `src/pages/Servicos.tsx` |
| Editar | `src/pages/Cadastros.tsx` |
| Editar | `src/pages/ServicosOrcamentos.tsx` |
| Editar | `src/pages/Despesas.tsx` |
| Editar | `src/pages/ClienteDetalhes.tsx` |
| Editar | `src/pages/ServicoDetalhes.tsx` |
| Editar | `src/App.tsx` |
| Editar | `src/hooks/useOnboarding.ts` |
| Editar | `src/components/onboarding/OnboardingChecklist.tsx` |
| Editar | `src/components/onboarding/OnboardingPageBanner.tsx` |
| Criar | `src/pages/ImportacaoDados.tsx` |
| Criar | `src/lib/statusColors.ts` |

Nenhuma migração de banco necessária — todas as mudanças são de UI e nomenclatura.

