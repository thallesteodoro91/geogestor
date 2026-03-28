

## Plano: Central de Ajuda com Screenshots Reais do App

### Abordagem para imagens

Vou capturar screenshots reais de cada seção principal do GeoGestor usando o browser, salvá-los como assets estáticos no projeto (`public/help/`), e referenciá-los na página de ajuda.

### Screenshots a capturar (14 telas)

1. `gestao-empresa.png` — Dashboard principal
2. `dashboard-financeiro.png` — Gráficos financeiros
3. `operacional.png` — Visão operacional
4. `geobot.png` — Chat do GeoBot
5. `calendario.png` — Calendário mensal
6. `relatorio.png` — Relatório executivo
7. `servicos.png` — Lista de serviços
8. `orcamentos.png` — Orçamentos
9. `despesas.png` — Despesas
10. `clientes.png` — Lista de clientes
11. `cadastros.png` — Cadastros
12. `configuracoes.png` — Configurações
13. `novo-compromisso.png` — Dialog de novo compromisso
14. `kanban.png` — Quadro Kanban (se visível)

### Mudanças nos arquivos

**1. Capturar screenshots → salvar em `public/help/`**
- Navegar por cada página do app via browser
- Capturar screenshot de cada tela principal
- Salvar como PNGs otimizados em `public/help/`

**2. Criar `src/pages/Ajuda.tsx`**
- Página com AppLayout, busca no topo
- 14 seções com Accordion, cada uma contendo:
  - Screenshot da tela correspondente (com bordas arredondadas e sombra)
  - Descrição das funcionalidades
  - Dicas de uso
- Seção "Primeiros Passos" com passo-a-passo visual

**3. Atualizar `src/App.tsx`**
- Adicionar lazy import e rota `/ajuda` protegida

**4. Atualizar `src/components/layout/Sidebar.tsx`**
- Adicionar "Central de Ajuda" com ícone `HelpCircle` na seção Base de Dados

**5. Atualizar `src/components/layout/UserMenu.tsx`**
- Adicionar "Central de Ajuda" antes de "Política de Privacidade"

### Layout das imagens na página

Cada seção do accordion terá o screenshot em destaque (largura máxima ~800px, com `rounded-lg shadow-md border`), seguido do texto explicativo. As imagens ficam responsivas e reduzem em mobile.

