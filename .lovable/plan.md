

## Plano: Teste End-to-End — Jornada Completa do Usuário

### Cenário simulado

Um novo usuário se cadastra, assina o plano, importa dados via planilha (com colunas renomeadas), realiza operações CRUD, gera orçamento e relatório.

### Etapas de teste

**1. Cadastro e Autenticação**
- Criar conta via `/auth` com email e senha
- Verificar redirecionamento para o dashboard
- Confirmar trial de 7 dias ativo no banner

**2. Assinatura (simulada)**
- Navegar até `/assinatura` via botão "Minha Assinatura" nas configurações
- Verificar exibição dos planos (Mensal R$97, Trimestral, Semestral, Anual)
- Simular ativação via `simulate-expiry` (restore → owner) para desbloquear acesso completo

**3. Importação de planilha com colunas renomeadas**
- Abrir Smart Importer em `/configuracoes`
- Importar CSV de clientes com colunas como "Nome Completo" (em vez de "nome"), "E-mail" (em vez de "email"), "Fone" (em vez de "telefone")
- Verificar auto-mapping por sinônimos
- Confirmar preview e executar importação
- Repetir para propriedades com colunas como "Fazenda" (→ nome_da_propriedade), "Cidade" (→ municipio)

**4. CRUD de Clientes e Propriedades**
- Adicionar cliente manualmente via Cadastros
- Editar dados do cliente
- Adicionar propriedade vinculada
- Excluir propriedade e cliente

**5. Despesas**
- Adicionar despesa com tipo e valor
- Editar despesa
- Excluir despesa

**6. Gerar Orçamento**
- Criar orçamento via wizard com cliente, propriedade, serviços e despesas
- Verificar código automático gerado
- Confirmar cálculos financeiros (receita, impostos, lucro, margem)

**7. Relatório Mensal**
- Navegar para `/relatorio-executivo`
- Verificar KPIs, gráficos semanais, tabelas
- Gerar PDF do relatório

### Método

Usarei o browser automation para navegar pela aplicação, preencher formulários, verificar resultados e reportar qualquer bug encontrado. Cada etapa será documentada com screenshots.

### Limitações

- O cadastro real requer confirmação de email — usarei uma conta já existente ou simularei via `simulate-expiry`
- O checkout Stripe não será testado com pagamento real
- Importação CSV requer upload de arquivo, que pode ter limitações no browser automation

