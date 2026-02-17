

## Pagina de Assinatura e Botao de Upgrade no GeoGestor

---

### Resumo

Criar uma pagina de vendas/assinatura em `/assinatura` com hero section, grid de beneficios, cards de precos com glassmorphism e botoes de CTA. Adicionar botao premium de upgrade no `PlanInfoCard` das Configuracoes. Registrar a nova rota no App.tsx.

---

### Arquivos envolvidos

| Arquivo | Acao |
|---------|------|
| `src/pages/Assinatura.tsx` | **Novo** - Pagina completa de vendas/assinatura |
| `src/components/plan/PlanInfoCard.tsx` | Adicionar botao gradiente "Fazer Upgrade / Ver Planos" |
| `src/App.tsx` | Registrar rota `/assinatura` protegida |

---

### Detalhes tecnicos

#### 1. Nova pagina `src/pages/Assinatura.tsx`

**Hero Section:**
- Titulo: "Desbloqueie todo o potencial do GeoGestor" com gradiente de texto (purple-500 to pink-500)
- Subtitulo persuasivo sobre produtividade e gestao rural
- Fundo com gradiente sutil usando `bg-gradient-to-br from-purple-50/50 to-pink-50/50` (dark mode: `dark:from-purple-950/20 dark:to-pink-950/20`)
- Botao "Voltar" no topo com icone ArrowLeft navegando para `/configuracoes`

**Grid de Beneficios (3 colunas, responsivo):**
Cards usando componente `<Card>` com hover `hover:scale-[1.02] hover:shadow-lg transition-all`:
1. Gestao Financeira Completa (DollarSign) - cor emerald
2. Mapas via Satelite Ilimitados (Globe) - cor blue
3. Geracao de Contratos PDF (FileText) - cor amber
4. Suporte Prioritario (HeadsetIcon/Headphones) - cor purple
5. Acesso Offline - App (Wifi/WifiOff) - cor cyan
6. Multi-usuarios (Users) - cor rose

Cada card tera icone grande (h-10 w-10), titulo em negrito e descricao curta.

**Secao de Precos (4 cards lado a lado, grid responsivo):**

Cards com estilo glassmorphism: `bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border border-white/20 shadow-lg`

| Plano | Preco/mes | Total | Destaque |
|-------|-----------|-------|----------|
| Mensal | R$97 | R$97 | - |
| Trimestral | R$86 | R$260 | - |
| Semestral | R$80 | R$480 | - |
| Anual | R$70 | R$840 | Badge "Melhor Valor" + borda gradiente purple-pink |

- Estado local `selectedPlan` para destacar o card selecionado
- Card anual com `ring-2 ring-purple-500` e Badge posicionada no topo

**Botao CTA em cada card:**
- Texto "Assinar Agora"
- Card anual: botao com gradiente `bg-gradient-to-r from-purple-500 to-pink-500 text-white`
- Demais: botao outline
- `onClick`: toast via sonner "Redirecionando para o gateway de pagamento..." (placeholder futuro)

#### 2. Botao no `PlanInfoCard.tsx`

- Importar `Sparkles` de lucide-react e `useNavigate` de react-router-dom
- Apos a secao de funcionalidades, adicionar botao condicional (oculto para `planSlug === 'owner'`):

```text
+------------------------------------------------------+
| [Sparkles] Fazer Upgrade / Ver Planos                |
| bg-gradient-to-r from-purple-500 to-pink-500         |
| text-white, w-full, hover:opacity-90                 |
+------------------------------------------------------+
```

- Texto dinamico: "Fazer Upgrade" se trial/inativo, "Gerenciar Assinatura" se ativo
- Navega para `/assinatura`

#### 3. Rota no `App.tsx`

- Adicionar lazy import: `const Assinatura = lazy(() => import("./pages/Assinatura"));`
- Registrar rota protegida entre as rotas existentes:
  `<Route path="/assinatura" element={<ProtectedRoute><Assinatura /></ProtectedRoute>} />`

---

### Responsividade

- Hero: padding ajustado para mobile (`px-4 py-12` mobile, `px-8 py-20` desktop)
- Grid de beneficios: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Grid de precos: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Todos os cards com `min-h` para alinhamento visual

