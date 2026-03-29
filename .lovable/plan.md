

## Plano: Revisão e Otimização Completa da Central de Ajuda

### ETAPA 1 — Diagnóstico da Versão Atual

**Problemas identificados:**

1. **Conteúdo superficial** — Os tópicos são parágrafos genéricos sem passo-a-passo real. Ex: "Cadastre clientes com CPF/CNPJ, contato..." não ensina *como* fazer.
2. **Sem hierarquia clara** — Todos os tópicos têm a mesma profundidade (título + parágrafo). Falta: alertas, dicas, erros comuns, exemplos.
3. **Ordem não segue jornada** — "Gestão da Empresa" (dashboard avançado) aparece antes de "Cadastros" (pré-requisito básico).
4. **Redundância** — "Filtros por período" aparece em 3 seções com texto quase idêntico. "Gestão da Empresa" e "Dashboard Financeiro" sobrepõem métricas.
5. **Falta de cobertura** — Não documenta: Assinatura/Planos, Importação CSV (detalhada), Permissões por função, Mapa de propriedades, KML upload, Logs de Auditoria, Política de Privacidade.
6. **UX Writing fraco** — Textos longos em parágrafos, sem bullets, sem destaques visuais, sem alertas de atenção.
7. **Seção "Primeiros Passos" sem imagem** — Justamente a mais importante para onboarding.
8. **Link do GeoBot no rodapé aponta para `/geobot`** — Correto, mas poderia ser mais integrado.
9. **Busca funcional mas básica** — Sem destaque dos termos encontrados, sem sugestões.

**Impacto:** Usuários novos não conseguem seguir um fluxo de onboarding claro. Usuários existentes não encontram respostas detalhadas, gerando tickets de suporte desnecessários.

---

### ETAPA 2 — Nova Arquitetura da Informação

Reorganização em **6 categorias** seguindo a jornada do usuário:

```text
1. 🚀 Primeiros Passos (onboarding)
   ├── Criando sua conta
   ├── Configurando a empresa
   ├── Cadastrando dados iniciais
   ├── Convidando sua equipe
   └── Entendendo as permissões

2. 📊 Dashboards e Análises (uso diário - visão)
   ├── Gestão da Empresa
   ├── Dashboard Financeiro
   ├── Gestão Operacional
   └── Relatório Executivo

3. ⚙️ Operações do Dia a Dia (uso diário - ação)
   ├── Serviços (lista, kanban, detalhes)
   ├── Orçamentos (criar, PDF, status)
   ├── Despesas (registrar, categorizar)
   └── Calendário (visões, compromissos)

4. 👥 Clientes e Projetos
   ├── Gestão de clientes
   ├── Propriedades e mapa
   ├── Upload KML
   └── Análise de rentabilidade

5. 🤖 Ferramentas Inteligentes
   ├── GeoBot (assistente IA)
   ├── Insights automáticos
   ├── Alertas financeiros
   └── Importação inteligente (CSV)

6. ⚙️ Configurações e Conta
   ├── Perfil e aparência
   ├── Gestão de equipe
   ├── Notificações
   ├── Google Calendar
   ├── Template de orçamento
   ├── Assinatura e planos
   └── Logs de auditoria
```

---

### ETAPA 3 — Reescrita dos Conteúdos (UX Writing)

**Novo formato padronizado para cada tópico:**

```text
interface HelpTopic {
  title: string;          // Título claro e orientado à ação
  description: string;    // 1 frase: "o que isso resolve"
  steps: string[];        // Passo a passo numerado
  tips?: string[];        // Dicas práticas (ícone 💡)
  warnings?: string[];    // Alertas importantes (ícone ⚠️)
  commonErrors?: string[];// Erros comuns (ícone ❌)
}
```

**Princípios aplicados:**
- Frases curtas (max 2 linhas)
- Verbos no imperativo ("Clique", "Selecione", "Acesse")
- Bullets em vez de parágrafos
- Destaques visuais: badges coloridos para dicas/alertas/erros
- Exemplos concretos quando relevante

**Exemplo de reescrita — "Criar novo serviço":**

Antes (atual):
> Clique em "+ Novo Serviço" e preencha: nome, tipo de serviço, cliente, propriedade, datas de início/fim e valor. Vincule a um orçamento existente se houver.

Depois:
> **O que resolve:** Registrar um novo serviço para acompanhar progresso e faturamento.
>
> **Passo a passo:**
> 1. Acesse **Serviços** no menu lateral
> 2. Clique em **"+ Novo Serviço"**
> 3. Preencha: nome do serviço, tipo, cliente e propriedade
> 4. Defina as datas de início e previsão de término
> 5. Informe o valor do serviço
> 6. *(Opcional)* Vincule a um orçamento existente
> 7. Clique em **Salvar**
>
> 💡 **Dica:** Após criar, adicione tarefas internas e membros da equipe na tela de detalhes.
>
> ⚠️ **Atenção:** O tipo de serviço precisa estar cadastrado previamente em Cadastros.

---

### ETAPA 4 — Sugestões de Recursos Adicionais

**Para implementar agora:**
1. **Highlight na busca** — Destacar termos encontrados em amarelo
2. **Feedback "Isso ajudou?"** — Botões 👍/👎 ao final de cada seção (salva no banco para analytics)
3. **Links cruzados** — "Artigos relacionados" ao final de cada seção
4. **Contagem de resultados** — Mostrar "X resultados encontrados" na busca

**Para implementar futuramente:**
- Tooltips contextuais dentro do produto (ex: "?" nos KPIs linkando para a seção relevante)
- FAQ dinâmico baseado nas buscas mais frequentes
- Vídeos curtos/GIFs animados demonstrando ações
- Chatbot de suporte integrado ao GeoBot

---

### Mudanças nos Arquivos

**1. `src/pages/Ajuda.tsx`** — Reescrita completa:
- Novo tipo `HelpTopic` com `steps`, `tips`, `warnings`, `commonErrors`
- 6 categorias reorganizadas na ordem da jornada do usuário
- Conteúdo reescrito em formato escaneável (passo-a-passo + dicas + alertas)
- Visual: badges coloridos para 💡 Dicas, ⚠️ Atenção, ❌ Erros comuns
- Busca com highlight dos termos encontrados
- Contagem de resultados
- Seção "Isso ajudou?" com botões de feedback
- Links "Artigos relacionados" ao final de cada seção
- Cobertura de features faltantes: Assinatura, KML, Permissões, Auditoria, Importação CSV

**2. Nenhum outro arquivo precisa mudar** — Rotas e navegação já existem.

