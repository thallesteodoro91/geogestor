
User says "ainda na tela principal estão as funções" — referring to the dashboard sidebar/page still showing items that were moved elsewhere. Need to check what's still on the main screen.

Looking at Sidebar.tsx, the "Configurações" section has:
- Cadastros
- Importação de Dados
- Configurações
- Central de Ajuda
- Logs de Auditoria

User wants to remove duplicates since they were moved to UserMenu (avatar). Keep "Logs de Auditoria" (audit).

Let me check UserMenu to see what's there now.
