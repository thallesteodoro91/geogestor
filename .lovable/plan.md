
## Análise e Melhorias da Página de Assinatura

### Problemas Identificados

**1. Badge "Melhor Valor" com canto cortado (visual inconsistente)**
O card anual usa `rounded-tl-none` para "grudar" no badge, mas como o badge é centralizado com `flex justify-center`, o canto esquerdo do card fica cortado de forma incorreta. Deveria usar `rounded-t-none` (ambos os cantos superiores) para alinhar corretamente com o badge centralizado.

**2. Cartões de preço sem indicador de desconto percentual**
Os planos trimestral, semestral e anual não mostram o desconto de forma clara. Um usuário não sabe que o plano anual economiza 28% em relação ao mensal. Adicionar badges de economia ("Economize 11%", "Economize 18%", "Economize 28%") dentro de cada card aumenta a percepção de valor.

**3. Título do benefício "Geração de Contratos PDF" está incorreto**
O título do card diz "Geração de Contratos PDF" mas a descrição diz apenas orçamentos. Deve-se alinhar para "Geração de Orçamentos PDF" para consistência com a descrição atual.

**4. Seção "Incluso em todos os planos" sem destaque visual**
A lista de features ao final da página é simples demais — fundo branco sem separação visual. Adicionar um fundo sutil (`bg-muted/30 rounded-2xl p-8`) faz a seção parecer um componente finalizado e não um item solto.

**5. Falta de CTA final (Call to Action) após a lista de features**
A página termina abruptamente na lista de features. Uma boa landing page sempre fecha com um CTA reforçado. Adicionar um botão "Começar Agora" centralizado ao fim da página, repetindo o gradiente premium.

**6. Preço mensal sem contexto de economia no card anual**
O card anual mostra R$70/mês mas não informa "você economiza R$324/ano" ou "vs R$97/mês". Adicionar esse dado diretamente no card anual reforça a decisão de compra.

**7. Glassmorphism incompleto no tema claro**
`bg-white/60` funciona bem no dark mode mas no tema claro os cards ficam com fundo quase totalmente branco, perdendo o efeito de profundidade. Ajustar para `bg-card/80` garante consistência visual em ambos os temas.

---

### Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/Assinatura.tsx` | Corrigir badge corner, adicionar % de desconto, corrigir título, melhorar seção final, adicionar CTA de fechamento |

---

### Detalhes Técnicos das Mudanças

**Badge corner fix:**
```
rounded-tl-none → rounded-t-none
```
(badge centralizado requer ambos os cantos superiores removidos)

**Desconto por plano (calculado sobre R$97/mês):**
- Trimestral R$86/mês → "Economize 11%"
- Semestral R$80/mês → "Economize 18%"
- Anual R$70/mês → "Economize 28%"

Mostrar como badge pequeno `text-xs` em verde dentro do card, abaixo do preço.

**Comparativo no card anual:**
Adicionar linha `text-xs text-muted-foreground`: "vs R$97/mês no plano mensal — você economiza R$324/ano"

**Seção de features com fundo:**
```tsx
<section className="max-w-2xl mx-auto bg-muted/30 rounded-2xl p-8 space-y-4">
```

**CTA final:**
```tsx
<section className="text-center space-y-4 py-8">
  <p className="text-muted-foreground">Pronto para transformar sua gestão rural?</p>
  <Button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-10 py-6 text-lg hover:opacity-90">
    <Sparkles /> Começar Agora com Melhor Valor
  </Button>
</section>
```

**Glassmorphism ajustado:**
```
bg-white/60 dark:bg-gray-900/60 → bg-card/80 backdrop-blur-xl
```
