
## Scroll e Campo de Observacoes nos Dialogos de Cliente e Propriedade

### Problema
Os dialogos de cadastro/edicao de Cliente e Propriedade ficam cortados na parte inferior, sem barra de scroll visivel. Alem disso, falta o campo "Observacoes" em ambos.

### Mudancas

#### 1. `src/components/cadastros/ClientePropriedadeUnificadoDialog.tsx`

**Scroll**: O `ScrollArea` ja existe (linha 309), mas precisa de ajuste. Trocar o wrapper para usar `overflow-y-auto` diretamente no container do conteudo das tabs em vez do `ScrollArea` do Radix (que tem problemas conhecidos de calculo de altura em containers flex). Alternativa: manter o `ScrollArea` mas garantir que o `DialogContent` tenha `overflow-hidden` e o scroll funcione corretamente.

**Campo Observacoes no Cliente** (aba Cliente, apos a secao de Prospeccao/Categoria):
- Adicionar um `Textarea` com label "Observacoes" e placeholder "Observacoes sobre o cliente..."
- Vinculado ao campo `anotacoes` do form (que e o nome da coluna no banco)

**Campo Observacoes na Propriedade** (dentro de cada card de propriedade, apos Longitude):
- Adicionar um `Textarea` com label "Observacoes" e placeholder "Observacoes sobre a propriedade..."
- Vinculado ao campo `observacoes` da propriedade via `updatePropriedade`

**Correcao de scroll**: Substituir `ScrollArea` (Radix) por um `div` com `overflow-y-auto` e `max-h-[calc(90vh-200px)]` para garantir scroll nativo funcional.

#### 2. `src/components/cadastros/ClienteDialog.tsx`

**Scroll**: O `DialogContent` ja tem `overflow-y-auto` (linha 136), mas adicionar `ScrollArea` ou garantir que o scroll nativo funcione com o conteudo expandido.

**Campo Observacoes** (apos a secao de Prospeccao/Categoria, antes do `DialogFooter`):
- Adicionar import de `Textarea`
- Adicionar campo `Textarea` com label "Observacoes", placeholder "Observacoes sobre o cliente..."
- Vinculado via `register("anotacoes")`

### Detalhes tecnicos

- O campo no banco de dados `dim_cliente` se chama `anotacoes`, mas o label exibido sera "Observacoes"
- O campo no banco de dados `dim_propriedade` se chama `observacoes`
- A correcao de scroll usa `overflow-y-auto` nativo em vez do `ScrollArea` do Radix, que tem problemas de calculo de altura em layouts flex
- O `DialogFooter` ficara fora da area de scroll para permanecer sempre visivel
