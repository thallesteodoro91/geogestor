
## Objetivo
Remover o ícone “☰” (botão de menu mobile) que está aparecendo por cima do relatório na exportação/geração do PDF, e garantir que o layout de impressão não esconda o cabeçalho do próprio relatório.

## 1) Diagnóstico (causa raiz)
- O ícone “☰” vem do botão de menu mobile do `AppLayout`:
  - `src/components/layout/AppLayout.tsx` cria um `<Button className="fixed top-4 left-4 z-50 md:hidden"> ... <Menu/>`
- Em modo impressão (`@media print`), as regras responsivas do Tailwind (`md:hidden`) **não são aplicadas como no screen**, então o botão pode aparecer mesmo no desktop.
- Além disso, o CSS de impressão atual esconde **todo** `<header>` (`src/index.css`), o que também pode esconder o cabeçalho do `PrintableReport` (que usa `<header>`).

## 2) Correção principal (remover o ☰ do PDF)
### 2.1. Esconder explicitamente o botão no modo impressão
**Arquivo:** `src/components/layout/AppLayout.tsx`
- Adicionar a classe `print:hidden` no botão do menu mobile (o botão fixo no topo-esquerdo).
- (Opcional, mas recomendado) adicionar também um identificador semântico para manutenção, ex.: `data-print="hide"`.

**Resultado esperado:** o botão “☰” não aparece nem na prévia nem no PDF final.

## 3) Ajuste de robustez do CSS de impressão (evitar esconder cabeçalho do relatório)
**Arquivo:** `src/index.css` (bloco `@media print`)
- Alterar o seletor que hoje esconde `header` globalmente para algo específico do header do app.
  - Trocar `header,` por `header.sticky,` (o header do app tem classe `sticky` em `src/components/layout/Header.tsx`)
- Manter `nav`, `aside`, etc. como estão para continuar removendo o “chrome” do app na impressão.

**Resultado esperado:** o cabeçalho do `PrintableReport` (logo/ID/emissão) volta a ser renderizado no PDF, melhorando a qualidade do relatório.

## 4) Verificação (checklist objetivo)
1. Abrir `/relatorio-executivo` e clicar em **Exportar PDF**.
2. Conferir na prévia e no PDF salvo:
   - Ícone “☰” não aparece em nenhuma página.
   - Cabeçalho do relatório (SkyGeo + ID/Emissão/Responsável) aparece normalmente.
   - A data/período não tem sobreposição visual.

## Arquivos que serão alterados
- `src/components/layout/AppLayout.tsx` (adicionar `print:hidden` ao botão do menu)
- `src/index.css` (ajustar regra de impressão para não esconder todo `<header>`, apenas o header “sticky” do app)
