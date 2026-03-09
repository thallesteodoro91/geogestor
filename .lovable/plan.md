
## Plano: Corrigir erro do PDF e dar destaque visual ao botão

### Problema Identificado

**Erro**: `WinAnsi cannot encode "▼" (0x25bc)`

O `pdf-lib` usa fontes padrão (Helvetica) com codificação WinAnsi que **não suporta** caracteres Unicode como `▲` e `▼`. O erro ocorre na linha 289 do `pdfReportGenerator.ts`.

---

### Solução

**Arquivo 1: `src/lib/pdfReportGenerator.ts`**

Substituir os caracteres Unicode por texto ASCII compatível:
- `▲` → `(+)` ou símbolo de seta textual
- `▼` → `(-)` ou símbolo de seta textual

```typescript
// Antes (linha 289):
const arrow = kpi.variation >= 0 ? "▲" : "▼";

// Depois:
const arrow = kpi.variation >= 0 ? "(+)" : "(-)";
```

**Arquivo 2: `src/pages/RelatorioExecutivo.tsx`**

Transformar o botão "Baixar PDF" em um elemento visualmente destacado:
- Mudar de `variant="outline"` para `variant="default"` (cor primária)
- Adicionar tamanho maior e ícone mais proeminente
- Aplicar classes de destaque: `bg-primary text-primary-foreground shadow-lg`

```tsx
<Button 
  onClick={handleDownloadPDF} 
  disabled={isDownloading || data.isLoading} 
  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg px-6"
  size="lg"
>
  {isDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
  Baixar PDF
</Button>
```

---

### Resultado Esperado
- PDF gera sem erros (caracteres ASCII compatíveis)
- Botão "Baixar PDF" com destaque visual (cor primária, sombra, tamanho maior)
