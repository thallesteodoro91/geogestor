

## Revisao do Calendario -- Problemas Identificados e Melhorias Sugeridas

### Problemas Atuais

1. **Botao "Lembretes" nao faz nada** -- O estado `notificacoesAtivas` e toggle local sem persistencia nem efeito real
2. **Vista semanal fixa na semana atual** -- Nao permite navegar para semanas anteriores/futuras
3. **Cada aba faz sua propria query independente** -- Dados duplicados, sem compartilhamento de estado
4. **Servico criado pelo dialog sem nome** -- Hardcoded "Novo Servico" na mutation `createServico`
5. **Sem legenda de cores** no calendario mensal -- Usuario nao sabe o que cada cor significa
6. **Sem contador de eventos** -- Nao ha resumo visual de quantos eventos existem
7. **Tabela sem paginacao** -- Pode ficar lenta com muitos registros
8. **Filtros inconsistentes** -- Semanal tem 3 filtros, Tabela so tem busca, Mensal e Diario nenhum

---

### Melhorias Propostas

#### 1. Barra de resumo com KPIs do periodo
Adicionar cards compactos acima das abas mostrando: total de eventos, orcamentos pendentes, servicos em andamento, e valor total do periodo visivel.

**Arquivo:** `src/pages/Calendario.tsx` -- Adicionar componente de resumo que consume os dados ja buscados.

#### 2. Legenda de cores no calendario mensal
Adicionar uma legenda abaixo do calendario com as cores e seus significados (Servico = azul, Orcamento aprovado = verde, Cancelado = vermelho, etc).

**Arquivo:** `src/components/calendario/CalendarioMensal.tsx` -- Adicionar div com badges coloridos explicativos.

#### 3. Navegacao na vista semanal
Adicionar botoes "Semana anterior" / "Proxima semana" / "Esta semana" (igual ao CalendarioDiario que ja tem navegacao).

**Arquivo:** `src/components/calendario/CalendarioSemanal.tsx` -- Adicionar estado de semana selecionada e botoes de navegacao.

#### 4. Filtros unificados no nivel da pagina
Mover filtros (busca por cliente, status, tipo orcamento/servico) para a pagina principal, aplicando em todas as abas. Remover filtros duplicados dos sub-componentes.

**Arquivos:** `src/pages/Calendario.tsx`, todos os 4 sub-componentes -- Extrair filtros para cima e passar como props.

#### 5. Campo "Nome do Servico" no dialog de criacao
Adicionar input de texto para o nome do servico na aba "Servico" do CompromissoDialog, em vez de hardcodar "Novo Servico".

**Arquivo:** `src/components/calendario/CompromissoDialog.tsx` -- Adicionar campo `nome_do_servico` ao form.

#### 6. Paginacao na vista Tabela
Usar o componente `TablePagination` existente no projeto para paginar os resultados.

**Arquivo:** `src/components/calendario/CalendarioTabela.tsx` -- Integrar `usePagination` hook e `TablePagination`.

#### 7. Remover botao "Lembretes" sem funcionalidade
O botao nao persiste nem afeta nada. Remover ate que haja uma integracao real de lembretes (as configuracoes de alertas ja existem em Configuracoes).

**Arquivo:** `src/pages/Calendario.tsx` -- Remover botao e estado `notificacoesAtivas`.

#### 8. Exportar eventos (CSV)
Adicionar botao "Exportar" na vista Tabela para baixar os eventos filtrados como CSV.

**Arquivo:** `src/components/calendario/CalendarioTabela.tsx` -- Adicionar botao com funcao de download CSV.

---

### Detalhes Tecnicos

- Os KPIs usarao a mesma queryKey `calendario-eventos` ja existente via `useQuery`
- Filtros passados como props: `{ busca: string, filtroTipo: "todos" | "orcamento" | "servico", filtroStatus: string }`
- A legenda sera um array estatico de `{ cor, label }` renderizado como flex-wrap de badges
- Navegacao semanal: estado `semanaOffset` (number) para calcular `startOfWeek` / `endOfWeek` relativo
- Exportacao CSV: funcao utilitaria que converte array de objetos em blob CSV com `URL.createObjectURL`

### Prioridade sugerida
1. Legenda de cores (rapido, alto impacto visual)
2. Campo nome do servico no dialog (corrige bug)
3. Navegacao semanal (usabilidade critica)
4. KPIs de resumo (visao geral)
5. Filtros unificados (consistencia)
6. Paginacao na tabela (performance)
7. Remover botao Lembretes (limpeza)
8. Exportar CSV (ferramenta bonus)

