

## Plano: Refatoração Completa do Sistema de Importação

### Diagnóstico Confirmado

Banco de dados: **73 clientes, 144 propriedades, 0 serviços, 0 orçamentos, 0 despesas**. KPIs = R$ 0,00.

O código do pipeline "completo" existe e parece correto em teoria, mas falha na prática porque:

1. **Conflito de sinônimos no auto-map**: `COMPLETO_SYNONYMS` usa spread de 4 objetos (`...CLIENTE_SYNONYMS, ...PROPRIEDADE_SYNONYMS, ...SERVICO_SYNONYMS, ...ORCAMENTO_SYNONYMS`). Chaves duplicadas se sobrescrevem silenciosamente. Por exemplo, `situacao` existe em CLIENTE, PROPRIEDADE e SERVICO — apenas a última sobrevive. Mais crítico: campos como `endereco` em CLIENTE_SYNONYMS tem sinônimo "cidade" que conflita com `cidade` em PROPRIEDADE_SYNONYMS. O resultado é mapeamentos errados.

2. **Auto-map greedy**: O `autoMap` atribui o primeiro header que faz match. Se "valor" casa com `valor_unitario`, ele não fica disponível para `receita_esperada`. Mas se a planilha tem UMA coluna "valor", precisa ser mapeada ao campo correto — hoje pode mapear para o campo errado.

3. **`nome` é required mas o matching é ambíguo**: Em COMPLETO_SYNONYMS, `nome` tem sinônimos como "cliente", "contato". Mas se o header da planilha é "Nome do Cliente", o normalize resulta em "nomedocliente" que precisa match exato com o sinônimo. Se não encontrar, a linha inteira é marcada como erro e descartada.

4. **Valores financeiros parseados como null**: Se `sanitizeCurrency` recebe "R$ 5.000,00" de uma célula XLSX já processada pelo XLSX.utils como número (5000), funciona. Mas se chega como string "5000.00" sem vírgula, o regex de detecção `/\d\.\d{3}/` não ativa e o valor é tratado corretamente. O problema real é quando o XLSX parser entrega a célula como `undefined` ou string vazia para campos numéricos.

### Mudanças Propostas

#### 1. Refatorar COMPLETO_SYNONYMS sem spread conflitante

Reescrever `COMPLETO_SYNONYMS` manualmente sem `...spread`, garantindo que cada campo tem sinônimos únicos e não-conflitantes. Adicionar sinônimos compostos reais do mundo do agro/topografia brasileiro:
- `nome`: "cliente", "proprietario", "nomedocliente", "nomeproprietario", "contratante"
- `nome_da_propriedade`: "propriedade", "fazenda", "imovel", "nomeimovel", "nomefazenda"  
- `valor_unitario`: "valor", "vlr", "preco", "valorunitario", "valorha"
- `receita_esperada`: "receita", "valortotal", "total", "faturamento", "valorcontrato"

Eliminar ambiguidades onde "cidade" pode casar com campo de cliente OU propriedade.

#### 2. Auto-map com prioridade de entidade

Modificar `autoMap` para que, no modo "completo", headers ambíguos (ex: "cidade") priorizem a entidade mais específica (propriedade > cliente). Implementar um sistema de peso onde campos financeiros têm prioridade sobre campos textuais quando o header contém keywords monetários.

#### 3. Relaxar validação do campo `nome` em "completo"

Se `nome` não tem match, mas a planilha tem uma coluna "proprietario" ou "contratante", o sinônimo deve cobrir. Caso nenhum match exista, usar o nome da propriedade ou gerar "Cliente [nome_propriedade]" automaticamente como fallback — não descartar a linha.

#### 4. Pipeline de importação com logging detalhado

Adicionar `console.log` em cada step do pipeline (clientes, propriedades, serviços, orçamentos) mostrando exatamente quantos registros tentam ser inseridos e quantos falharam, com o erro específico. Mostrar esses logs no painel de resultado como "Debug da Importação".

#### 5. Painel de resultado expandido (nível premium)

Redesenhar o step "result" com:
- **Resumo visual**: Cards com ícones mostrando X clientes, X propriedades, X projetos, R$ X receita, R$ X despesas
- **Tabela de debug**: Valores classificados como receita vs despesa vs não classificados
- **Before/After KPIs**: Já existe mas melhorar com destaque visual quando valores mudam
- **CTA claro**: "Ir para Dashboard" como botão principal

#### 6. Detecção forçada para "completo"

Se a planilha tem **qualquer** header financeiro (valor, receita, custo, total, preço, faturamento) E pelo menos um header de nome/cliente, forçar modo "completo" independente do scoring. O threshold atual (2 entidades ≥3) é muito restritivo.

#### 7. Fallback para linhas sem serviço

Se uma linha tem valor monetário mas nenhum nome de serviço mapeado, criar serviço com nome "Serviço - [nome_propriedade]" ou "Serviço - [nome_cliente]" em vez do genérico "Serviço Importado".

### Detalhes técnicos

- Arquivo principal: `src/components/import/SmartImporter.tsx`
- Reescrever `COMPLETO_SYNONYMS` (~20 linhas)
- Modificar `detectEntityType` (~10 linhas)
- Modificar `autoMap` para prioridade (~15 linhas)
- Expandir pipeline logging no `handleImport` (~20 linhas)
- Redesenhar resultado no render (~60 linhas)
- Fallback `nome` no validate (~10 linhas)

Nenhuma migração necessária — o modelo de dados (dim_cliente, dim_propriedade, fato_servico, fato_orcamento, fato_despesas) já é correto e suporta todas as relações descritas.

