

## Plano: Importação Composta — Uma Linha = Múltiplas Entidades

### Diagnóstico

O SmartImporter atual opera em modo **single-entity**: o usuário escolhe "Clientes" ou "Orçamentos" e cada linha cria apenas esse tipo de registro. Quando a planilha do usuário contém dados mistos (nome do cliente + propriedade + serviço + valor), apenas UMA entidade é criada e todo o restante é descartado.

O problema é estrutural: não existe um `entityType = "completo"` que interprete cada linha como uma entidade composta.

### Mudanças

#### 1. Novo tipo de entidade: "completo" (Importação Completa)

Adicionar `"completo"` ao `ImportEntityType`. Quando selecionado (ou auto-detectado quando a planilha tem colunas de múltiplas entidades), cada linha é processada como:

```text
Linha da planilha
  ├─ dim_cliente      (nome, cpf, telefone, email)
  ├─ dim_propriedade  (nome, município, área) → vinculada ao cliente
  ├─ fato_servico     (nome do serviço, status) → vinculado ao cliente + propriedade
  └─ fato_orcamento   (valor, data) → vinculado ao cliente + propriedade + serviço
      ou fato_despesas (valor, data) → vinculado ao serviço
```

#### 2. Campo de mapeamento unificado (COMPLETO_FIELDS)

Criar um `COMPLETO_FIELDS` que agrupa campos de todas as entidades com prefixo visual:

- **Cliente**: nome, cpf, telefone, email, endereco
- **Propriedade**: nome_da_propriedade, municipio, area_ha
- **Projeto**: nome_do_servico, categoria, situacao_do_servico
- **Financeiro**: valor_unitario, receita_esperada, data_orcamento, custo_servico

Com sinônimos unificados (`COMPLETO_SYNONYMS`) que combinam todos os sinônimos existentes.

#### 3. Pipeline de importação composta no `handleImport`

Quando `entityType === "completo"`:

1. **Deduplicar clientes**: Agrupar linhas por nome de cliente. Criar cada cliente UMA vez.
2. **Criar propriedades**: Para cada combinação única (cliente + nome_propriedade), criar propriedade vinculada.
3. **Criar serviços**: Para cada linha com nome_do_servico, criar serviço vinculado ao cliente + propriedade.
4. **Criar registros financeiros**: Se há valor monetário, criar orçamento (receita) ou despesa conforme classificação.

Pipeline sequencial com Maps de deduplicação:
```text
Map<nome_cliente, id_cliente>
Map<nome_cliente+nome_prop, id_propriedade>
Map<nome_servico+id_cliente, id_servico>
```

#### 4. Auto-detecção melhorada

Modificar `detectEntityType` para retornar `"completo"` quando a planilha pontua alto em 3+ entidades diferentes (ex: tem colunas de cliente E propriedade E valor).

#### 5. Resumo pós-importação expandido

Na tela de resultado, mostrar resumo completo:
- X clientes criados/reutilizados
- X propriedades criadas
- X projetos criados
- R$ X em receita importada
- R$ X em despesas importadas

#### 6. Tratamento de dados incompletos

Se uma linha tem cliente mas não tem propriedade → criar apenas cliente.
Se uma linha tem valor mas não tem nome de serviço → criar serviço genérico "Serviço Importado".
Nunca descartar valores financeiros.

### Detalhes técnicos

- `ImportEntityType` passa de union de 5 para 6 valores (adiciona `"completo"`)
- `COMPLETO_FIELDS` combina subconjuntos das 4 entidades, sem duplicar campos ambíguos
- Pipeline usa `createClientesBatch` → `createPropriedadesBatch` → `createServicosBatch` → `createOrcamentosBatch` em sequência
- Deduplicação por nome normalizado (lowercase + trim) antes de inserir
- Fallbacks existentes (Cliente Importação, Sem classificação) continuam funcionando como última linha de defesa

### Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/import/SmartImporter.tsx` (novo entityType "completo", pipeline composta, detecção, resumo) |

Nenhuma migração necessária.

