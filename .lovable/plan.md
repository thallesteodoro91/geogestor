
## Plano: refatoração completa da página de preços para maximizar conversão

### Objetivo da nova página
Transformar `/assinatura` em uma página de decisão rápida, com apenas 2 opções claras, eliminando fricção de escolha e reforçando o valor percebido do plano anual.

### Diagnóstico do estado atual
A página atual reduz conversão por 4 motivos principais:
1. Existem 4 planos, o que aumenta indecisão.
2. O anual está comunicado como preço mensal, não como compromisso anual total.
3. A hierarquia visual divide atenção entre muitos blocos e reduz foco no CTA.
4. Parte da comunicação ainda é mais “lista de recursos” do que “resultado para o cliente”.

### O que será refatorado

#### 1) Simplificação total da oferta
Remover completamente:
- plano trimestral
- plano semestral

Manter apenas:
- Plano Mensal
- Plano Anual

Isso vale para:
- UI da página `/assinatura`
- seleção padrão
- CTA final
- lógica de destaque de “plano atual”
- integração de checkout que hoje aceita 4 `planId`s

#### 2) Reestruturação da seção hero para conversão
Substituir o topo atual por um hero mais direto e orientado a valor, com:
- headline principal forte
- subheadline curta
- 3 benefícios reais e não técnicos
- prova de segurança/baixo risco logo acima ou ao lado dos planos

Estrutura proposta:
```text
[Headline]
Tenha controle total do seu negócio em um único lugar

[Subheadline]
Organize financeiro, operação, clientes e equipe sem planilhas soltas nem retrabalho.

[3 benefícios]
- Mais clareza para decidir
- Menos tempo perdido na operação
- Tudo centralizado em um só sistema
```

#### 3) Nova arquitetura dos cards de preço
Os cards vão virar um comparativo simples de 2 colunas, com foco claro no anual.

##### Plano Mensal
- nome: Plano Mensal
- preço: R$ 97/mês
- descrição curta: para começar com flexibilidade
- CTA: “Começar agora”

##### Plano Anual
- badge de destaque: “Mais escolhido”
- preço principal: R$ 970/ano
- economia visível: “2 meses grátis”
- equivalente mensal: “equivalente a R$ 81/mês”
- reforço de economia vs mensal: “economize R$ 194 por ano”
- CTA: “Começar com desconto”

Observação:
- com mensal em R$ 97, o anual em R$ 970 equivale a cerca de 10 meses pagos
- o cálculo de economia será comunicado com clareza e consistência em toda a página

#### 4) Hierarquia visual orientada à decisão em menos de 5 segundos
A seção de preços será reorganizada para:
- reduzir texto secundário dentro dos cards
- destacar tipografia de preço
- separar visualmente “preço total anual” de “equivalente mensal”
- usar contraste mais forte no anual
- deixar o mensal neutro e o anual dominante

Direção visual:
- card anual com borda forte, fundo/sombra diferenciados e badge superior
- card mensal mais contido, como opção alternativa
- mesma estrutura, mesma altura e CTA alinhado no rodapé

#### 5) Reescrita dos CTAs e microcopy
Substituir textos genéricos como:
- “Assinar”
- “Assinar — R$ X/mês”

Por CTAs mais persuasivos:
- Mensal: “Começar agora”
- Anual: “Começar com desconto”

Adicionar abaixo dos botões:
- Cancele quando quiser
- Sem contrato
- Acesso imediato

Se o usuário já tiver assinatura ativa:
- manter o comportamento de gerenciamento
- adaptar o copy para “Gerenciar assinatura”
- preservar a lógica de plano atual

#### 6) Proposta de valor acima, prova e redução de risco abaixo
A página vai seguir esta ordem:

```text
1. Hero de valor
2. Sinais de confiança
3. Cards de preço
4. Lista curta do que está incluído
5. Bloco de redução de risco
6. FAQ enxuto
7. CTA final
```

Sinais de confiança:
- Pagamento seguro
- Cancele quando quiser
- Acesso imediato

Bloco de risco:
- Sem contrato
- 7 dias de garantia
- Seus dados permanecem salvos

#### 7) Limpeza de conteúdo que hoje dispersa atenção
Vou condensar e refinar:
- grid de benefícios
- lista de funcionalidades
- FAQ
- CTA final

A ideia não é remover valor, e sim reduzir excesso cognitivo.  
A página atual mostra muita informação antes da decisão; a nova versão mostrará apenas o necessário para converter.

#### 8) Consistência com o design system atual
A nova página seguirá o padrão já consolidado no projeto:
- `PageHeader` mantido
- variantes de `Button` alinhadas ao Dashboard 360
- tokens semânticos e dark mode existentes
- contraste revisado para textos secundários
- badges, cards e estados visuais sem classes “soltas” ou cores arbitrárias

### Arquivos que precisarão ser ajustados

#### `src/pages/Assinatura.tsx`
Refatoração principal:
- substituir array de 4 planos por estrutura de 2 planos
- reescrever hero, pricing section, CTAs, prova social e risco
- ajustar copy, layout e destaque visual
- corrigir comunicação do anual para total anual + equivalente mensal
- manter tratamento de assinante ativo, mas com apresentação mais limpa

#### `supabase/functions/create-checkout/index.ts`
Atualizar o mapa `PRICE_IDS` para refletir apenas:
- `mensal`
- `anual`

Se o preço anual real em produção ainda for o antigo, será necessário também alinhar o `priceId` correto ao novo valor de R$ 970/ano.

### Dependências de pricing
Para que a página e o checkout fiquem coerentes, existem 2 cenários possíveis:

#### Cenário A — já existe um preço anual de R$ 970
- apenas atualizo o frontend e o mapeamento para usar esse `priceId`

#### Cenário B — ainda não existe preço anual de R$ 970
- será necessário criar ou selecionar o preço anual correto no Stripe
- depois atualizar o `priceId` usado pelo checkout e pela identificação do plano atual

### Critérios de sucesso
A nova página estará correta quando:
- houver apenas 2 planos visíveis
- o anual estiver destacado como “Mais escolhido”
- o anual mostrar `R$ 970/ano`
- a economia estiver explícita como `2 meses grátis`
- o equivalente mensal aparecer como `R$ 81/mês`
- os CTAs estiverem reescritos para conversão
- a leitura estiver clara em dark mode
- o usuário conseguir comparar e decidir sem interpretar cálculos sozinho

### Detalhes técnicos
- Sem mudança de schema no banco.
- Sem necessidade de novas tabelas.
- Pode exigir ajuste dos `priceId`s de pagamento.
- A lógica de assinatura ativa continuará usando `useStripeSubscription`.
- O plano atual continuará sendo identificado por `price_id`.
- Se necessário, a integração de pagamento será alinhada ao catálogo atual de preços antes da UI final.
