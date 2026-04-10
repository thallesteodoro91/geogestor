

## Plano: Importador Inteligente — Tolerante, Transparente e Acionável

### Diagnóstico

Após auditoria completa do `SmartImporter.tsx` (1093 linhas), identifiquei as causas raiz dos 429/629 erros:

1. **Validação rígida em campos opcionais**: Telefone com 8-9 dígitos (sem DDD) falha. CPF com 10 dígitos falha. Qualquer variação menor bloqueia a linha inteira.
2. **Sem normalização antes da validação**: O sistema valida ANTES de limpar os dados. Ex: "123.456.789-0" (CPF com 10 dígitos após limpeza) não é corrigido.
3. **Preview limitado a 10 linhas**: Com 429 erros, o usuário vê apenas 10 e não consegue entender o padrão.
4. **Sem filtro de erros**: Não há como ver "só as linhas com erro" ou "só as válidas".
5. **Mensagens sem sugestão de correção**: "CPF deve ter 11 dígitos" não diz o que fazer.
6. **Sem auto-correção**: O sistema detecta o erro mas não tenta corrigir automaticamente.

### Mudanças

#### 1. Validação tolerante com auto-correção

Reescrever validadores para serem tolerantes:

- **Telefone**: Aceitar 8-11 dígitos. Se 8-9, tentar adicionar DDD padrão (ou simplesmente aceitar). Não bloquear por formatação.
- **CPF**: Se tem 11 dígitos limpos, aceitar com ou sem máscara. Se tem menos, avisar mas NÃO bloquear (campo opcional).
- **CNPJ**: Mesma lógica — aceitar variações de formatação.
- **Campos opcionais com valor parcial**: Gerar WARNING (amarelo) em vez de ERROR (vermelho). Warnings não bloqueiam importação.

Novo tipo de validação:
```typescript
type ValidationSeverity = "error" | "warning";
interface FieldValidation { message: string; severity: ValidationSeverity; suggestion?: string; }
```

#### 2. Mensagens com contexto e sugestão

Cada erro/warning inclui 3 partes:
- **O que**: "CPF com 10 dígitos"
- **Por que**: "CPF válido precisa de 11 dígitos"  
- **Como corrigir**: "Verifique se não faltou um dígito. Valor recebido: 1234567890"

Exemplos:
| Antes | Depois |
|-------|--------|
| "CPF deve ter 11 dígitos" | "CPF com 10 dígitos — verifique se falta um número (recebido: 1234567890)" |
| "Telefone deve ter 10 ou 11 dígitos" | "Telefone com 8 dígitos — provavelmente falta o DDD. Será importado mesmo assim." |
| "Data inválida" | "Data não reconhecida: '31/13/2024' — mês 13 não existe" |
| "Valor deve ser um número" | "Não foi possível converter 'abc' em número" |

#### 3. Preview com filtro e paginação

- **Filtro**: Botões "Todas", "Só válidas", "Só com erro", "Só com aviso"
- **Paginação**: Mostrar 25 linhas por vez com navegação (em vez de apenas 10)
- **Contador por tipo de erro**: Badge resumo no topo (ex: "15x CPF inválido, 8x telefone incompleto")
- **Tooltip em cada célula com erro**: Hover mostra mensagem completa + sugestão

#### 4. Auto-normalização agressiva

Antes de validar, aplicar normalização inteligente:
- Remover espaços, pontos, traços de CPF/CNPJ/telefone
- Telefone com 8 dígitos: manter e marcar como warning
- Valores monetários: detectar e limpar automaticamente (já existe, reforçar)
- Datas: já funciona bem, manter

#### 5. Warnings vs Errors

- **Error** (vermelho, bloqueia): Campo obrigatório vazio, valor impossível de interpretar
- **Warning** (amarelo, NÃO bloqueia): Formatação atípica, campo parcialmente preenchido, possível dado incompleto

Na UI: linhas com apenas warnings são importáveis. Checkbox "Importar apenas as corretas" ignora errors mas aceita warnings.

#### 6. Resumo de erros agrupado na tela de resultado

Substituir lista genérica por resumo visual:
- Tabela agrupada: Tipo de erro | Quantidade | Exemplo | Sugestão
- Download CSV com coluna de erro detalhado por campo (já existe, melhorar)

### Detalhes técnicos

- `RowValidation.errors` muda de `Record<string, string>` para `Record<string, FieldValidation>`
- Novo campo `warnings` em `RowValidation` para separar severity
- `hasErrors` = tem pelo menos 1 error. `hasWarnings` = tem pelo menos 1 warning
- `errorCount` conta apenas errors (não warnings)
- Preview filter state: `"all" | "valid" | "errors" | "warnings"`
- Paginação: `previewPage` state com 25 items/page

### Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Reescrever | `src/components/import/SmartImporter.tsx` (validação, preview, resultado) |

Nenhum novo arquivo. Nenhuma migração. Apenas reescrita da lógica de validação e UI do preview/resultado.

