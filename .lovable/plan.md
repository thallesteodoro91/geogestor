## Causa

Na área de configuração ("Importação"), ao subir uma planilha nova abre o dialog `UniversalImporter` com o passo de validação (`UniversalValidationPanel`). Esse painel contém:

1. **Mapeamento de colunas** — tabela 4 colunas com `<SelectTrigger className="w-[260px]">`.
2. **Pré-visualização (10 primeiras linhas)** — uma `<Table>` que renderiza **uma coluna por cabeçalho da planilha**, com `whitespace-nowrap` nas células.

O `DialogContent` está como:

```tsx
<DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
```

Só clipa o eixo Y. A tabela de preview, com muitas colunas e nowrap, infla a largura do conteúdo. Como nenhum nó intermediário tem `min-w-0`, o filho expande além do `max-w-6xl` do diálogo e empurra a página inteira para a direita — o usuário precisa rolar a tela para ver as colunas "Destino sugerido", "Confiança" e "Ação" do Mapeamento.

## Correção (somente CSS/layout, sem mudar lógica)

### 1. `src/components/import/UniversalImporter.tsx`
- Trocar `DialogContent` para conter o overflow horizontal e manter o vertical:
  ```diff
  - <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
  + <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
  ```

### 2. `src/components/import/UniversalValidationPanel.tsx`
- Raiz: adicionar `min-w-0 w-full` para impedir que o conteúdo force expansão:
  ```diff
  - <div className="space-y-4">
  + <div className="space-y-4 min-w-0 w-full">
  ```
- Card "Mapeamento de colunas": trocar `overflow-hidden` por `overflow-x-auto` no wrapper da tabela, garantindo que, se em algum caso (mobile/tablet) ela exceda a largura, a rolagem fique **dentro do card**, não na página:
  ```diff
  - <div className="rounded-md border overflow-hidden">
  + <div className="rounded-md border overflow-x-auto">
  ```
- Card "Pré-visualização": o `CardContent` precisa isolar o scroll horizontal e não permitir que a tabela infle o pai. Substituir:
  ```diff
  - <CardContent className="overflow-auto">
  -   <Table> … </Table>
  - </CardContent>
  + <CardContent className="p-0">
  +   <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
  +     <Table className="min-w-full">…</Table>
  +   </div>
  + </CardContent>
  ```
  - Mantém `whitespace-nowrap` nas células (não muda o conteúdo).
  - `max-h-[400px]` limita também a altura para o usuário não precisar rolar a página inteira para ver os botões "Voltar/Confirmar" do rodapé.

### 3. Defesa em profundidade (opcional, recomendado)
- Em `src/components/layout/AppLayout.tsx`, adicionar `overflow-x-hidden` ao `<main>` para prevenir que outras telas com tabelas largas causem o mesmo problema:
  ```diff
  - <main className="p-4 md:p-6 lg:p-8" …>
  + <main className="p-4 md:p-6 lg:p-8 min-w-0 overflow-x-hidden" …>
  ```

## Resultado esperado
- O diálogo permanece com `max-w-6xl` e nunca ultrapassa a largura da viewport.
- A tabela "Mapeamento de colunas" mostra todas as 4 colunas (Coluna da planilha · Destino sugerido · Confiança · Ação) sem rolagem horizontal da página.
- A "Pré-visualização" continua mostrando todas as colunas da planilha, mas com rolagem horizontal **interna ao card** e altura limitada.
- Nenhuma mudança em lógica de matching, mapeamento ou import.

## Arquivos editados
- `src/components/import/UniversalImporter.tsx` (1 linha)
- `src/components/import/UniversalValidationPanel.tsx` (3 trechos)
- `src/components/layout/AppLayout.tsx` (1 linha — opcional)
