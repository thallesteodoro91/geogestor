

## Plano: Correção Definitiva do Fluxo Importação → KPIs

### Diagnóstico Crítico (confirmado via análise)

O banco tem **73 clientes, 144 propriedades, mas 0 orçamentos/0 despesas/0 serviços**. Isso prova que NENHUMA importação anterior conseguiu inserir dados financeiros, apesar das tentativas de correção. Causas raízes confirmadas:

**1. Pipeline "completo" silenciosamente descarta linhas financeiras**
No `SmartImporter.tsx`, mesmo com fallbacks implementados, o pipeline tem múltiplos pontos de falha silenciosa:
- Linha de propriedade sem `nome_da_propriedade` é descartada (mas deveria gerar fallback "Propriedade - [Cliente]")
- Linha de orçamento sem `id_servico` válido é aceita, mas o trigger `auto_criar_servico_ao_converter_orcamento` só roda quando `orcamento_convertido = true` — ou seja, nenhum serviço é criado a partir de orçamentos importados
- `receita_esperada` é calculado apenas se `valor_unitario` for válido; se a planilha tem só "Total" ou "Receita", esse valor não é mapeado para `receita_esperada` diretamente

**2. KPI view depende de `data_orcamento` no ano corrente**
A view `vw_kpis_financeiros` (e `get_financial_dashboard_metrics`) filtra por período. Se a planilha importada tem datas de 2023/2024, KPIs do ano corrente (2026) ficam zerados mesmo com dados inseridos corretamente.

**3. Sem registro de erros visível ao usuário**
Quando RLS bloqueia INSERT (ex: `tenant_id` ausente, `id_cliente` NULL em fato_orcamento), o erro é capturado mas não mostrado de forma actionável.

### Mudanças (escopo restrito a importação + KPIs)

#### 1. Pipeline robusto sem descarte silencioso

No `SmartImporter.tsx`, refatorar o pipeline "completo" para que **CADA linha com valor monetário** garantidamente gere a cadeia: Cliente → Propriedade → Serviço → Orçamento + Despesa.

- **Cliente**: se `nome` ausente, usar "Cliente - [propriedade]" ou "Cliente Importação #N"
- **Propriedade**: se `nome_da_propriedade` ausente mas há cliente, criar "Propriedade - [cliente]"
- **Serviço**: SEMPRE criar um `fato_servico` para cada linha com valor (não depender do trigger). Nome: coluna mapeada OU "Serviço - [propriedade]" OU "Serviço Importado #N"
- **Orçamento**: vincular ao serviço criado, com `orcamento_convertido = true` e `data_orcamento` = data da linha OU `CURRENT_DATE` como fallback
- **Despesa**: se houver coluna de custo, criar `fato_despesas` vinculada ao serviço

#### 2. Mapeamento financeiro ampliado

Aceitar "valor", "total", "receita", "faturamento" como sinônimos diretos de `receita_esperada` (não só `valor_unitario`). Se ambos existirem, `receita_esperada` ganha precedência. Se só houver `valor_unitario` + `quantidade`, calcular `receita = valor * qtd`.

#### 3. Conversão monetária à prova de erros

Centralizar `parseMonetaryValue(raw)` que aceita:
- Números puros (5000)
- Strings BR ("R$ 5.000,00", "5.000,00")
- Strings US ("5,000.00", "5000.00")
- Vazios/null → retorna `null` (não 0, para não poluir cálculos)

Aplicar em TODAS as colunas financeiras antes de inserir.

#### 4. Data de orçamento sempre válida

Se a planilha não tem coluna de data ou a data é inválida, usar `new Date().toISOString().split('T')[0]` (hoje). Isso garante que o orçamento aparece no período corrente dos KPIs.

#### 5. Painel de debug pós-importação

Após importação, mostrar tabela com:
- Total de linhas processadas
- Linhas com valor financeiro detectado
- Receitas criadas (count + soma R$)
- Despesas criadas (count + soma R$)
- Linhas descartadas (com motivo: "sem cliente", "sem valor", etc)
- Erros de INSERT (mensagem RLS/SQL exata)

#### 6. Validação imediata dos KPIs

Após importação bem-sucedida, fazer query direta a `calcular_kpis_v2` e comparar com snapshot anterior. Mostrar:
- Receita Total: R$ X → R$ Y (variação +R$ Z)
- Despesas: R$ X → R$ Y
- Lucro Líquido: R$ X → R$ Y

Se receita pós-importação continua 0 mas linhas com valor foram detectadas, mostrar alerta vermelho com diagnóstico específico ("dados podem ter datas fora do período corrente — mude o filtro de ano").

### Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `src/components/import/SmartImporter.tsx` | Refatorar pipeline "completo": forçar criação de serviço para cada linha financeira, ampliar mapeamento de receita, fallback de data, parseMonetaryValue centralizado, painel debug expandido |

Sem migrações de banco. Schema atual já suporta todo o fluxo.

### Princípio de garantia

Cada linha da planilha com qualquer valor monetário > 0 **DEVE** resultar em pelo menos: 1 cliente + 1 propriedade + 1 serviço + 1 orçamento. Se algum step falha, o erro é capturado e exibido — nunca silenciado.

