

## Plano: Diagnóstico e Correção da Integração Financeira na Importação

### Diagnóstico

Após auditoria completa do código e banco de dados, confirmei que:

- **73 clientes existem** no banco, mas **0 orçamentos, 0 despesas, 0 serviços**
- O KPI view (`vw_kpis_financeiros`) calcula `receita_total` a partir de `fato_orcamento.receita_esperada` — sem orçamentos, receita = R$ 0

**Causas raiz identificadas:**

1. **Auto-detecção escolhe "clientes" quando a planilha tem nome + valor**: O scoring privilegia a entidade com mais campos matched. Como CLIENTE_FIELDS tem 13 campos (nome, cpf, telefone, email, etc.) e colunas como "nome", "telefone" são comuns, "clientes" ganha sempre. O modo "completo" só ativa quando 3+ entidades pontuam >= 4, o que raramente ocorre.

2. **Importação como "clientes" ignora colunas financeiras**: CLIENTE_FIELDS não inclui nenhum campo monetário. Colunas como "valor", "receita", "custo" são completamente descartadas.

3. **`linkToClients` exclui o modo "completo"** (linha 874): `if (entityType !== "propriedades" && entityType !== "servicos" && entityType !== "orcamentos") return records;` — o completo nunca passa por auto-link.

4. **No pipeline "completo", linha 1231**: `if (!clienteId) continue;` silenciosamente descarta orçamentos sem vínculo de cliente, em vez de usar o fallback "Cliente Importação".

### Mudanças

#### 1. Auto-detecção mais agressiva para "completo"

Reduzir threshold de 3 entidades com score >= 4 para **2 entidades com score >= 3, sendo pelo menos uma financeira** (orcamentos ou despesas). Isso garante que uma planilha com "nome" + "valor" já acione o modo completo.

#### 2. Detecção de colunas financeiras no modo "clientes"

Após auto-detect retornar "clientes", verificar se existem headers que matcham sinônimos financeiros (valor, receita, custo, total, preço, faturamento). Se sim, mostrar um **alerta proativo** sugerindo trocar para "Importação Completa" ou, no mínimo, para "Orçamentos".

#### 3. Fallback de `id_cliente` no pipeline "completo"

Na step 4 do pipeline completo (linha 1231), em vez de `if (!clienteId) continue;`, usar o mesmo fallback "Cliente Importação" que já existe para o modo "orcamentos". Assim nenhum valor financeiro é descartado.

#### 4. Incluir "completo" no `linkToClients`

Adicionar `entityType === "completo"` à condição da linha 874 para que o auto-link de clientes funcione também no modo completo.

#### 5. Alerta pós-importação quando KPIs permanecem zerados

Se após a importação os KPIs continuam com receita_total = 0 mas registros foram criados, mostrar alerta vermelho explicando: "Os valores importados não estão refletidos nos KPIs. Causa provável: dados foram importados como clientes sem registros financeiros. Reimporte selecionando 'Importação Completa'."

#### 6. Botão "Reimportar como Completo" na tela de resultado

Quando a importação de clientes detecta que havia colunas financeiras não mapeadas, adicionar botão de ação rápida para reimportar o mesmo arquivo no modo "completo".

### Detalhes técnicos

- `detectEntityType`: adicionar check `hasFinancialHeaders` que verifica se headers matcham sinônimos de valor/receita/custo. Se `hasFinancialHeaders && highScoring.length >= 2`, retornar "completo"
- Pipeline completo step 4: substituir `if (!clienteId) continue;` por buscar/criar "Cliente Importação" (reutilizar lógica das linhas 996-1026)
- `linkToClients` linha 874: adicionar `|| entityType === "completo"` (embora no completo o pipeline já crie clientes, isso é uma rede de segurança)
- Alerta: componente condicional no step "result" que compara `kpiSnapshot` com `currentKpis`

### Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/import/SmartImporter.tsx` (detecção, fallbacks, alertas) |

Nenhuma migração necessária.

