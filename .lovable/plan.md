

## Avaliação Critica do GeoGestor — Perspectiva de Cliente

Avaliei o sistema completo: código, banco de dados, arquitetura, navegação, UX e fluxos. Seguem os problemas organizados por severidade.

---

### SEVERIDADE CRITICA (Bloqueia uso real)

**1. Importação NÃO gera dados financeiros**
O banco tem 73 clientes, 144 propriedades, mas **0 orçamentos, 0 despesas, 0 serviços**. Isso significa que TODAS as importações até agora criaram apenas clientes/propriedades. O pipeline "completo" foi implementado no código, mas claramente não está funcionando na prática — os dados financeiros não chegam às tabelas `fato_orcamento` e `fato_despesas`. Resultado: **todos os KPIs, dashboards e relatórios mostram R$ 0,00**. O sistema parece vazio para o usuário apesar de ter dados importados.

**2. Página de Importação hardcoded como "clientes"**
`src/pages/ImportacaoDados.tsx` passa `entityType="clientes"` fixo para o SmartImporter. Mesmo que o auto-detect tente mudar para "completo", o componente é inicializado como clientes. O usuário que acessa a página dedicada de importação sempre começa no modo errado.

**3. Dashboard 360 (/) vs Dashboard Executivo (/financeiro) — confusão**
A rota `/` renderiza `GestaoEmpresa` (Dashboard 360). Existe também `/dashboard-financeiro` e a rota `/financeiro` que fazem coisas similares. Três dashboards diferentes, todos mostrando KPIs zerados. Um cliente novo fica perdido.

---

### SEVERIDADE ALTA (Prejudica experiência)

**4. Sidebar ainda mostra "SkyGeo" como fallback**
Linha 105 do Sidebar: `{tenant?.name || 'SkyGeo'}`. O brand é GeoGestor, mas se o tenant não carregar, o nome antigo aparece.

**5. Sem validação de dados obrigatórios na importação**
O campo `id_cliente` é NOT NULL em `fato_orcamento`. Se o pipeline falha ao vincular um cliente, o INSERT silenciosamente falha via RLS e o usuário não recebe feedback.

**6. Zero feedback visual quando importação "funciona" mas não gera impacto**
O painel de verificação financeira pós-importação foi implementado, mas se todas as inserções falharam silenciosamente, mostra "0 → 0" e o usuário não entende.

**7. Onboarding não guia para importação completa**
O `OnboardingChecklist` tem steps genéricos mas não ensina o usuário a importar uma planilha financeira completa. Para um SaaS de gestão, o primeiro valor percebido deveria ser: "importe seus dados e veja seus KPIs".

**8. Mobile (393px viewport)**: o menu hamburger funciona, mas os KPI cards e tabelas transbordam horizontalmente. A tabela de clientes com 7 colunas não é usável em mobile.

---

### SEVERIDADE MEDIA (Oportunidades de melhoria)

**9. Auth: `LAST_USER_KEY = "skygeo_last_user"`** — nome antigo no localStorage.

**10. Sem busca global / command palette**
O sistema tem 15+ páginas. Não há uma forma rápida de navegar (Ctrl+K). Para um SaaS profissional, isso é esperado.

**11. Dashboard sem "estado vazio" humanizado**
Quando KPIs estão zerados, o Dashboard 360 mostra "R$ 0,00" em todos os cards com variação "--". Deveria mostrar um estado vazio dedicado: "Comece importando seus dados" com CTA direto para importação.

**12. Duplicação de lógica de KPIs**
`src/services/kpi.service.ts` e `src/modules/finance/services/kpi.service.ts` têm funções similares (`fetchKPIs`, `getDefaultKPIs`, `fetchClienteKPIs`). Manutenção duplicada.

**13. Filtros globais no Dashboard não conectados**
Os filtros em `Dashboard.tsx` são capturados no state mas nunca passados aos queries de KPIs. O usuário muda filtros e nada acontece.

**14. Sem export de dados**
O sistema importa, mas não exporta. Não há botão "Exportar CSV" em nenhuma tabela. Para gestores, isso é essencial.

**15. CalendarioDetalhes, DashboardFinanceiro, Financeiro, Operacional** — múltiplas páginas que competem pelo mesmo espaço. A IA de negócio sugere consolidar.

---

### PLANO DE AÇÃO PRIORITÁRIO

Proponho executar as seguintes correções, em ordem:

| # | Correção | Arquivo |
|---|----------|---------|
| 1 | **Importação page: remover entityType hardcoded**, deixar auto-detect decidir | `src/pages/ImportacaoDados.tsx` |
| 2 | **Dashboard: estado vazio quando KPIs = 0**, com CTA "Importar dados" | `src/pages/GestaoEmpresa.tsx` |
| 3 | **Sidebar: trocar fallback "SkyGeo" → "GeoGestor"** | `src/components/layout/Sidebar.tsx` |
| 4 | **Auth localStorage key**: renomear para `geogestor_last_user` | `src/pages/Auth.tsx` |
| 5 | **Filtros globais do Dashboard**: conectar ao hook de KPIs ou remover | `src/pages/Dashboard.tsx` |
| 6 | **Mobile responsive**: adicionar scroll horizontal nas tabelas e stack vertical nos KPIs | Múltiplos |

Nenhuma migração necessária.

