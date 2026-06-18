# Tooltips do GeoGestor

Sistema central para os ícones de informação (`Info`) do SaaS.

## Regra única

Use sempre o componente:

```tsx
import { InfoTooltip } from "@/components/ui/InfoTooltip";

<InfoTooltip termKey="finance.lucroLiquido" />
```

- **Preferência absoluta**: passar `termKey` apontando para uma entrada de `catalog.ts`.
- Use `content` apenas quando o texto é gerado dinamicamente (ex.: tipo de campo na importação de planilha).
- Nunca crie um tooltip inline com `Tooltip`/`TooltipContent` em componentes novos.
- Nunca use textos genéricos como "mais informações", "saiba mais" ou "clique aqui".

## Adicionar uma nova chave

1. Abra `src/lib/tooltips/catalog.ts`.
2. Adicione no grupo correto (`finance`, `projeto`, `orcamento`, etc.).
3. Garanta `description` clara e contextual; use `calculation` quando houver fórmula.
4. Use a chave via `<InfoTooltip termKey="..." />`.

Os testes em `catalog.test.ts` validam descrições não-vazias, ausência de texto genérico e padrão `dominio.campo`.

## Acessibilidade

O `InfoTooltip` renderiza um `<button>` com `aria-label`, atende foco por teclado e alterna a abertura no toque. Use `side` para reposicionar o popover quando o layout pedir.
