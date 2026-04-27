## Contexto

A página `/faturas` recebeu várias melhorias incrementais no popover de **Limite de alerta** do card “Total em aberto”. Antes de adicionar novidades, fiz uma releitura completa de `src/pages/Faturas.tsx` e identifiquei **conflitos reais entre as funcionalidades já existentes** e **lacunas de consistência** que precisam ser resolvidas para que o conjunto funcione sem erros. Este plano trata tudo de uma vez, na ordem certa (correções primeiro, melhorias depois).

---

## 🔴 Prioridade 1 — Correções de bugs e conflitos (obrigatórias)

### 1.1 `aplicarPrevia` está sobrescrevendo o limite salvo
Hoje a função `aplicarPrevia` chama `setLimiteEmAberto(valor)` direto, igual ao `salvarLimite`. Isso cria três problemas:
- O “Limite atual” mostrado no badge muda imediatamente, então o botão **“Aplicar prévia” fica desabilitado** logo após o clique (porque `Number(limiteInput) === limiteEmAberto`), confundindo o usuário.
- O “Redefinir” passa a apagar a prévia como se fosse o valor salvo.
- Recarregar a página descarta a “prévia” silenciosamente, sem aviso — o usuário acha que salvou.

**Correção:** introduzir um estado separado `limitePrevia` (não persistido) e derivar o **limite efetivo** usado nos cálculos como `limitePrevia ?? limiteEmAberto`. `aplicarPrevia` passa a setar apenas `limitePrevia`. `salvarLimite` limpa `limitePrevia` e persiste em `limiteEmAberto`. `redefinirLimite` também limpa ambos.

### 1.2 Banner visual quando há prévia ativa
Como consequência de 1.1, adicionar um aviso discreto **abaixo do valor “Total em aberto”** quando `limitePrevia !== null`:
> “Visualizando prévia (R$ X). [Salvar] [Descartar]”

Botões inline para resolver a ambiguidade. “Descartar” limpa só a prévia.

### 1.3 Switch “Destacar apenas acima do limite” não respeita a prévia
A linha 803 calcula `eligibleForHighlight` usando `limiteEmAberto`. Após 1.1, isso passa a usar o **limite efetivo** (`limitePrevia ?? limiteEmAberto`) para que a prévia também respeite o switch.

### 1.4 Conflito visual: `previewMatches` + `pulseFlag` aplicam dois `ring-2 ring-inset` na mesma linha
Quando o usuário digita um valor (preview ativo) logo após salvar (pulse ativo), as duas regras Tailwind `ring-2 ring-inset` colidem na mesma `<TableRow>`. Resultado: o ring do pulse vence silenciosamente e o feedback de prévia some por ~1.6 s.

**Correção:** dar precedência ao `pulseFlag` (já é o feedback mais recente do usuário) **suprimindo** `previewMatches` enquanto `pulseFlag` estiver ativo. Pequeno ajuste condicional no `cn()` da linha 817.

### 1.5 `toast` em `toggleSomenteAcimaLimite` referencia `filteredSummary` antes da definição
Linha 133 lê `filteredSummary.currency` dentro do handler. Isso funciona em runtime (closure tardia), mas o handler é definido **antes** de `filteredSummary` (linha 337), o que torna a leitura em React Strict Mode arriscada se o handler for chamado durante a primeira render via `onCheckedChange` controlado. Mover a leitura de moeda para dentro do callback usando o estado mais recente é seguro hoje, mas precisa ser blindado com fallback `"brl"` explícito (já existe parcialmente). Vou padronizar **todos** os usos de `filteredSummary.currency` em toasts/handlers para `filteredSummary.currency || "brl"`.

### 1.6 Persistência do switch ignora o caso `limiteEmAberto = 0`
Se o usuário desativa o limite (salva 0) com `somenteAcimaLimite = true`, o switch fica visualmente “ligado” mas inerte. Ao reativar o limite depois, o comportamento volta sem aviso — usuário esquece do estado.

**Correção:** quando `salvarLimite` for chamado com `valor === 0`, **forçar** `somenteAcimaLimite = false` e persistir. O switch já está `disabled` quando limite é 0, então isso só formaliza o estado.

---

## 🟡 Prioridade 2 — Melhorias de UX que fecham lacunas existentes

### 2.1 Atalho “Usar valor sugerido” no popover
Sugerir automaticamente um limite baseado nos dados reais: a **mediana** dos valores em aberto, arredondada para múltiplos de 50. Mostrar como botão pequeno acima do input:
> 💡 Sugerido: R$ 350 *(baseado nas suas faturas em aberto)*

Clica → preenche `limiteInput`. Não salva sozinho.

### 2.2 Resumo do efeito atual no rodapé do popover
Adicionar uma linha resumindo **o que está valendo agora na lista** (estado salvo, ignorando prévia):
> Atualmente destacando: **3 faturas** em vermelho.

Calculado a partir de `filteredInvoices` + `limiteEmAberto` + `somenteAcimaLimite`. Ajuda o usuário a confirmar antes de fechar o popover.

### 2.3 Tecla Enter no input dispara “Salvar”
Pequena melhoria de teclado: `onKeyDown` no `Input` chama `salvarLimite()` quando `Enter` é pressionado e o valor é válido.

### 2.4 Fechar o popover automaticamente ao Salvar com sucesso
Hoje o popover fica aberto após salvar. Adicionar `setPreviewOpen(false)` no fim de `salvarLimite` quando a operação for válida (não em erro). O toast já confirma a ação.

---

## 🟢 Prioridade 3 — Polimento (sem risco, melhora coesão)

### 3.1 Ícone visual no banner de prévia ativa
Usar `Eye` (lucide) no banner de “Visualizando prévia” da seção 1.2 para reforçar que é apenas pré-visualização.

### 3.2 Texto consistente “em aberto acima de X”
Padronizar a frase usada em três lugares (toast de save, tooltip, banner de prévia, resumo do popover) para sempre dizer **“faturas com valor em aberto acima de R$ X”** — hoje varia entre “acima de”, “ultrapassar” e “excedem”.

---

## Ordem de execução

1. Refatorar estado: introduzir `limitePrevia` + `limiteEfetivo` (1.1, 1.3).
2. Atualizar `aplicarPrevia`, `salvarLimite`, `redefinirLimite` (1.1, 1.6, 2.4).
3. Adicionar banner de prévia ativa no card (1.2, 3.1).
4. Ajustar `cn()` da `TableRow` para resolver colisão de `ring` (1.4).
5. Padronizar fallback de moeda em handlers/toasts (1.5).
6. Adicionar atalho “Sugerido” + resumo no popover (2.1, 2.2).
7. Suportar Enter no input (2.3).
8. Padronizar copy (3.2).

## Arquivo afetado

- `src/pages/Faturas.tsx` — todas as mudanças concentradas neste arquivo. Sem migrações, sem novos componentes, sem alterações em outras páginas.

## Resultado esperado

Ao final: o conjunto **status badge + tooltip + helper text + toast de confirmação + pulse + switch acima-do-limite + prévia ao digitar + botão “Aplicar prévia”** funciona de forma coesa, sem ambiguidade entre “prévia” e “salvo”, sem conflitos visuais, com feedback claro do que está valendo agora e do que vai mudar.