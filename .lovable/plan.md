

## Plano: Simulação de importação com colunas diferentes e melhoria do auto-mapeamento

### Diagnóstico do mapeamento atual

A função `autoMap` (linha 303-315 do SmartImporter.tsx) faz matching assim:

```text
Cabeçalho CSV (normalizado) vs. field.key e field.label
Matching: igualdade exata OU substring (includes)
```

**Cenários que JA funcionam:**
- `Nome` → `nome` (exato)
- `telefone_celular` → `celular` (includes)
- `E-mail` → `email` (normalizado: `email`)

**Cenários que FALHAM (nomes comuns em planilhas reais):**
- `Contato` → deveria mapear para `telefone` ou `celular`
- `Fone` / `Tel` / `WhatsApp` → deveria mapear para `celular`
- `Razão Social` / `Nome Completo` / `Cliente` → deveria mapear para `nome`
- `Cidade` / `Localização` / `Local` → deveria mapear para `endereco`
- `Observação` / `Nota` / `Comentário` → deveria mapear para `anotacoes`
- `Status` / `Ativo/Inativo` → deveria mapear para `situacao`
- `Tipo` / `Segmento` → deveria mapear para `categoria`
- `Canal` / `Como conheceu` → deveria mapear para `origem`
- `Data` / `Cadastrado em` / `Dt Cadastro` → deveria mapear para `data_cadastro`
- `Documento` / `CPF/CNPJ` → deveria tentar CPF ou CNPJ

### Alterações propostas

**Arquivo:** `src/components/import/SmartImporter.tsx`

1. **Adicionar dicionário de sinônimos** para cada campo do sistema, contendo variações comuns em planilhas brasileiras:

```typescript
const FIELD_SYNONYMS: Record<string, string[]> = {
  nome: ["cliente", "razaosocial", "nomecompleto", "nomerazao", "contato", "nomefantasia"],
  cpf: ["documento", "cpfcnpj", "doc"],
  cnpj: ["documento", "cpfcnpj", "inscricao"],
  telefone: ["fone", "tel", "fixo", "telefonecontato"],
  celular: ["whatsapp", "zap", "mobile", "cel", "telefonemovil"],
  email: ["correio", "mail", "emailcontato"],
  endereco: ["local", "localizacao", "cidade", "rua", "logradouro", "end"],
  categoria: ["tipo", "segmento", "classificacao", "tipocliente"],
  origem: ["canal", "comoconheceu", "fonte", "indicacao", "prospeccao"],
  situacao: ["status", "ativo", "estado"],
  anotacoes: ["observacao", "obs", "nota", "comentario", "descricao"],
  data_cadastro: ["data", "datacadastro", "cadastradoem", "dtcadastro", "datacriacao"],
  idade: ["age"],
};
```

2. **Melhorar a função `autoMap`** para consultar o dicionário de sinônimos além do matching atual, aplicando normalização com remoção de acentos.

3. **Adicionar indicador visual** na etapa de mapeamento mostrando o nível de confiança do match (exato, sinônimo, parcial) para o usuário validar.

### Resultado esperado

Com essas mudanças, ao importar uma planilha com colunas como `"Cliente"`, `"Fone"`, `"WhatsApp"`, `"Cidade"`, `"Status"`, o sistema mapeará automaticamente para os campos corretos sem intervenção manual. O mapeamento manual ainda estará disponível para casos não cobertos.

### Resumo

| Arquivo | Mudança |
|---------|---------|
| `SmartImporter.tsx` | Adicionar dicionário de sinônimos e melhorar `autoMap` com matching fuzzy por sinônimos |
| `SmartImporter.tsx` | Indicador visual de confiança do mapeamento automático |

