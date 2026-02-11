

## Auditoria Completa do GeoGestor

---

### 1. DADOS - Integridade e Consistencia

#### 1.1 Dados Mock Hardcoded (CRITICO)
- **Pagina Financeiro (`Financeiro.tsx`)**: DRE, despesas por categoria e metricas de receita usam dados mock estaticos (`financial-mock-data.ts`). Valores como "R$ 2,34M", "+12,5%" e "R$ 18,5K" sao fixos e nao refletem dados reais do banco.
- **Pagina Gestao da Empresa (`GestaoEmpresa.tsx`)**: Graficos de "Orcado x Realizado", "Desvio Orcamentario", "Ponto de Equilibrio" e "Custos Fixos vs Variaveis" usam arrays hardcoded (linhas 37-72). Os dados nao vem do banco.
- **Pagina Gestao da Empresa - KPIs**: As variacoes percentuais nos KPIs sao hardcoded ("+12.5%", "+10.3%", "+8.7%", etc.) ao inves de calculadas dinamicamente como na pagina Dashboard.
- **Pipeline de Vendas**: O funil `pipelineData` (linha 67-72) com "150 Leads, 85 Propostas..." e estatico.
- **StoryCards no Dashboard**: Os insights narrativos sao textos fixos (linhas 221-251), nao gerados a partir dos dados reais.

#### 1.2 Queries sem Filtro de Tenant (CRITICO)
- **Cadastros.tsx (linhas 50-55)**: As queries de `fetchData()` nao filtram por `tenant_id`. Usa `supabase.from('dim_cliente').select('*')` direto, sem isolamento. Se o RLS estiver cobrindo, funciona, mas e inconsistente com o padrao dos services que sempre adicionam `.eq('tenant_id', tenantId)`.
- **Dashboard.tsx (linhas 44-62)**: Queries de clientes e empresas nao filtram por tenant.
- **GestaoEmpresa.tsx (linhas 86-108)**: Mesmo problema.
- **Orcamentos.tsx (linhas 48-86)**: Queries de orcamentos, clientes e servicos sem filtro de tenant.
- **Despesas.tsx (linhas 95-136)**: Queries sem filtro de tenant explicito.

#### 1.3 Inconsistencia Campo Observacoes
- O campo "anotacoes" na tabela `dim_cliente` e exibido como "Observacoes" na interface -- ok, mas pode causar confusao na manutencao.

---

### 2. FUNCIONALIDADES - Bugs e Problemas

#### 2.1 Switches de Configuracoes Nao Funcionam (CRITICO)
- **Configuracoes.tsx**: Os switches de "Modo Escuro", "Animacoes", "Story Cards Automaticos", "Alertas de Desvio" e "Relatorios Mensais" sao decorativos. Nenhum deles persiste estado ou altera comportamento real. O switch de Modo Escuro nao esta conectado ao `ThemeProvider` do `next-themes`.

#### 2.2 Filtros Globais sem Efeito (IMPORTANTE)
- **Dashboard.tsx**: O `GlobalFilters` coleta filtros (`setFilters`), mas o estado `filters` nunca e usado para filtrar dados. Os KPIs e graficos ignoram os filtros completados.
- **GestaoEmpresa.tsx**: Mesmo problema -- filtros sao coletados mas nao aplicados aos KPIs.

#### 2.3 Auditoria Ausente no Dialog Unificado
- **ClientePropriedadeUnificadoDialog.tsx**: Nao registra eventos de auditoria (`logAuditEvent`) ao criar/editar clientes e propriedades, ao contrario do `ClienteDialog.tsx` que registra.

#### 2.4 Orcamentos sem Paginacao
- **Orcamentos.tsx**: Nao tem paginacao na tabela. Se houver muitos orcamentos, a performance degrada. Contrasta com Servicos.tsx que ja tem paginacao implementada.

#### 2.5 Orcamentos sem Busca
- **Orcamentos.tsx**: Nao tem campo de busca para filtrar orcamentos, diferente das paginas de Servicos e Cadastros.

#### 2.6 Exclusao de Cliente sem Verificacao de Dependencias
- **Cadastros.tsx**: Ao excluir um cliente, nao verifica se existem servicos, orcamentos ou propriedades vinculados. O banco pode retornar erro de FK, mas a mensagem para o usuario nao e clara.

---

### 3. EXPERIENCIA DO USUARIO (UX)

#### 3.1 Navegacao Confusa - Paginas Duplicadas
- "Clientes e Projetos" (`/clientes`) e "Cadastros" (`/cadastros`) tem funcionalidades sobrepostas. A pagina Clientes mostra analytics (Pareto, LTV), enquanto Cadastros mostra a lista CRUD. O usuario pode se confundir sobre onde gerenciar clientes.

#### 3.2 Pagina Dashboard vs Gestao Empresa
- A rota `/` carrega `GestaoEmpresa` (nao `Dashboard`). O `Dashboard.tsx` nao tem rota direta no Sidebar. Pode existir codigo orfao.

#### 3.3 Label Inconsistente
- **ClienteDialog.tsx linha 208**: O campo "Situacao" tem label "Situacao do Servico" quando deveria ser "Situacao do Cliente".

#### 3.4 Falta de Loading nos Dialogs
- **ClientePropriedadeUnificadoDialog.tsx**: Ao carregar propriedades no modo edicao (fetch assincrono), nao mostra indicador de carregamento na aba Propriedades.

#### 3.5 Responsividade da Tabela de Cadastros
- A tabela de clientes com 8 colunas pode ficar apertada em telas menores. Nao tem scroll horizontal explicito.

#### 3.6 Feedback de Exclusao em Cascata
- Quando o usuario exclui uma propriedade pelo dialog unificado (removendo do array e salvando), nao ha confirmacao antes da exclusao.

---

### 4. CORRECOES PRIORITARIAS (Ordenadas por Impacto)

#### Prioridade 1 - Criticas
1. **Substituir dados mock por dados reais** em `Financeiro.tsx` e `GestaoEmpresa.tsx` -- os graficos DRE, Orcado vs Realizado e Pipeline devem consumir dados do banco via hooks/RPC existentes
2. **Adicionar filtro de tenant** nas queries diretas de `Cadastros.tsx`, `Dashboard.tsx`, `GestaoEmpresa.tsx`, `Orcamentos.tsx` e `Despesas.tsx`
3. **Conectar filtros globais** aos dados nas paginas Dashboard e Gestao Empresa

#### Prioridade 2 - Importantes
4. **Funcionalizar switches** de Configuracoes (principalmente Modo Escuro) ou remove-los
5. **Adicionar auditoria** no `ClientePropriedadeUnificadoDialog`
6. **Corrigir label** "Situacao do Servico" para "Situacao" no `ClienteDialog.tsx`
7. **Adicionar paginacao e busca** na pagina de Orcamentos

#### Prioridade 3 - Melhorias
8. **Adicionar loading** na aba Propriedades ao carregar dados no modo edicao
9. **Adicionar confirmacao** antes de remover propriedade no dialog unificado
10. **Mensagem amigavel** quando exclusao falha por FK (propriedades/servicos vinculados)
11. **Scroll horizontal** na tabela de Cadastros para telas menores
12. **Gerar StoryCards dinamicos** no Dashboard baseados nos KPIs reais

---

### Resumo Tecnico

| Categoria | Criticos | Importantes | Melhorias |
|-----------|----------|-------------|-----------|
| Dados     | 3        | 0           | 1         |
| Funcional | 1        | 4           | 2         |
| UX        | 0        | 2           | 4         |
| **Total** | **4**    | **6**       | **7**     |

A maior fraqueza do sistema e o uso extensivo de dados mock em paginas que deveriam mostrar dados reais do banco. Isso faz com que as paginas "Gestao Financeira" e "Gestao da Empresa" exibam informacoes falsas, podendo levar a decisoes erradas. A segunda preocupacao e a falta de filtro de tenant explicito em algumas queries, embora o RLS possa estar protegendo.

