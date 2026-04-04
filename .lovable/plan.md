

## Plano: Onboarding Completo e Guiado

### Diagnostico do Estado Atual

O sistema ja possui:
- `OnboardingChecklist` com 5 passos (empresa, cliente, servico, orcamento, dashboard) exibido na home
- `FlowGuide` com pills horizontais (redundante com o checklist)
- `useOnboarding` hook verificando dados reais do banco
- Botoes de importar planilha nos modulos (Clientes, Servicos, Despesas, Orcamentos)
- SmartImporter premium integrado

**Problemas:**
1. **Sem despesa no onboarding** — etapa critica para valor financeiro faltante
2. **Redundancia** — FlowGuide e OnboardingChecklist mostram a mesma coisa de formas diferentes
3. **Sem orientacao contextual** — usuario clica no passo, chega na pagina e nao sabe o que fazer
4. **Sem opcao de importacao no checklist** — cada passo so tem um CTA (ir para pagina), sem sugerir importar
5. **Sem "pular" para usuario avancado** — unico jeito de sair e o X discreto
6. **Etapa "empresa"** e pouco acionavel como primeiro passo — usuario quer ver valor rapido, nao configurar logotipo

### Mudancas Planejadas

---

#### 1. Redesign do OnboardingChecklist (alta prioridade)

Reescrever `OnboardingChecklist.tsx` com:
- **Dual-action por passo**: cada etapa mostra 2 botoes ("Importar planilha" + "Cadastrar manualmente")
- **Icones por etapa** para reforco visual
- **Microcopy acionavel** focada em resultado, nao descricao
- **Botao "Pular configuracao"** visivel no header (nao so o X)
- **Progresso textual**: "Sua empresa esta 40% configurada"

Microcopy por etapa:
| Passo | Titulo | Descricao | CTA Primario | CTA Secundario |
|-------|--------|-----------|-------------|----------------|
| 1 | Adicione seus clientes | Importe sua base de clientes para comecar | Importar planilha | Cadastrar cliente |
| 2 | Crie um servico | Registre o primeiro projeto para acompanhar | Criar servico | — |
| 3 | Gere um orcamento | Crie uma proposta comercial | Gerar orcamento | — |
| 4 | Registre uma despesa | Controle os custos do seu negocio | Registrar despesa | Importar planilha |
| 5 | Veja seu painel | Acompanhe os resultados da empresa | Ver dashboard | — |

---

#### 2. Atualizar useOnboarding (alta prioridade)

- Adicionar passo "despesa" (verificar `fato_despesas` count > 0)
- Remover passo "empresa" (pouco relevante para aha moment, fica em configuracoes)
- Atualizar etapa "dashboard" para depender de clientes + servicos + despesas
- Adicionar campo `actionType` por step: `"import" | "create" | "view"`
- Adicionar `secondaryHref` para steps que suportam importacao

---

#### 3. Banner contextual nas paginas destino (media prioridade)

Criar `OnboardingPageBanner.tsx` — componente que aparece no topo de cada pagina quando o passo correspondente esta pendente no onboarding.

```text
┌─────────────────────────────────────────────────┐
│ 📋 Passo 1 de 5: Adicione seus clientes         │
│ Importe uma planilha ou cadastre manualmente    │
│ [Importar planilha]  [Cadastrar cliente]  [×]   │
└─────────────────────────────────────────────────┘
```

Renderizado condicionalmente em:
- `Clientes.tsx` (passo "cliente")
- `Servicos.tsx` (passo "servico")
- `ServicosOrcamentos.tsx` (passo "orcamento")
- `Despesas.tsx` (passo "despesa")

So aparece enquanto o passo nao esta concluido E o onboarding nao foi dismissado.

---

#### 4. Remover FlowGuide (limpeza)

Eliminar `FlowGuide.tsx` — e redundante com o checklist redesenhado. Remover import de `GestaoEmpresa.tsx`.

---

### Arquivos

| Acao | Arquivo |
|------|---------|
| Reescrever | `src/components/onboarding/OnboardingChecklist.tsx` |
| Criar | `src/components/onboarding/OnboardingPageBanner.tsx` |
| Editar | `src/hooks/useOnboarding.ts` |
| Editar | `src/pages/GestaoEmpresa.tsx` (remover FlowGuide) |
| Editar | `src/pages/Clientes.tsx` (add banner) |
| Editar | `src/pages/Servicos.tsx` (add banner) |
| Editar | `src/pages/ServicosOrcamentos.tsx` (add banner) |
| Editar | `src/pages/Despesas.tsx` (add banner) |
| Deletar | `src/components/onboarding/FlowGuide.tsx` |

Nenhuma migracao de banco necessaria — usa dados existentes.

