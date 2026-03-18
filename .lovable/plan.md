

## Plano: Botão "Minha Assinatura" nas Configurações

### O que será feito

Adicionar um botão "Minha Assinatura" no card de Plano & Assinatura (seção 4 das Configurações) que navega para a página `/assinatura`. A página `/assinatura` já existe e é uma landing page completa com benefícios, planos de preço, FAQ e CTAs — exatamente o mesmo destino usado quando a assinatura expira (`SubscriptionExpiredScreen` redireciona para `/assinatura`).

### Alteração

**`src/components/plan/PlanInfoCard.tsx`**
- Adicionar um botão "Minha Assinatura" com ícone `Crown` no topo do card ou junto aos botões existentes
- O botão navega para `/assinatura` onde o usuário vê toda a landing page com funcionalidades, ferramentas, planos e preços
- Visível para todos os usuários (inclusive owner), funcionando como vitrine do SaaS

### Detalhes técnicos

O componente `PlanInfoCard` já possui `useNavigate` e um botão que navega para `/assinatura` (o botão "Fazer Upgrade" / "Alterar Plano"). A adição será um botão dedicado "Minha Assinatura" mais proeminente, separado da lógica de upgrade, para que o usuário acesse a landing page completa a qualquer momento.

