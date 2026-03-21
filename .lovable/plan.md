

## Plano: Criar página de Política de Privacidade

### O que será feito

Criar uma página pública (`/politica-de-privacidade`) com a política de privacidade do GeoGestor, acessível sem autenticação. Essa URL poderá ser usada no formulário de verificação OAuth do Google.

### Mudanças

**1. Criar `src/pages/PoliticaPrivacidade.tsx`**
- Página pública com layout limpo (sem sidebar/header do app)
- Conteúdo completo de política de privacidade cobrindo: coleta de dados, uso, armazenamento, compartilhamento, integração com Google Calendar, direitos do usuário, cookies, contato
- Botão de voltar para a home
- Design responsivo usando componentes existentes (Card, etc.)

**2. Atualizar `src/App.tsx`**
- Adicionar rota pública `/politica-de-privacidade` (sem ProtectedRoute)
- Lazy import do novo componente

**3. Opcional: link no rodapé da página de Auth**
- Adicionar link para a política de privacidade na página de login/cadastro

