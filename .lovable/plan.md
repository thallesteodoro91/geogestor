
# Plano: Botão para Excluir Todos os Dados da Empresa

## Objetivo
Adicionar um botão na página de Configurações que permite ao usuário excluir todos os dados operacionais da empresa, zerando o sistema para permitir uma nova importação de informações.

## Localização do Botão
O botão será adicionado no card "Dados e Backup" da página de Configurações (`src/pages/Configuracoes.tsx`), junto com os botões existentes de Importar CSV, Exportar Dados e Fazer Backup.

## Comportamento
1. **Botão vermelho com ícone de alerta** - Claramente identificado como ação destrutiva
2. **Confirmação em duas etapas** - Usando o padrão `ConfirmDialog` já existente no projeto
3. **Texto de confirmação claro** - Explicando exatamente o que será excluído
4. **Exclusão respeitando tenant_id** - Apenas dados do tenant atual serão removidos

## Dados que Serão Excluídos

A exclusão seguirá a ordem correta devido às Foreign Keys (tabelas dependentes primeiro):

1. **Tabelas de relacionamento (primeiro)**
   - `servico_anexos` - Anexos de serviços
   - `servico_eventos` - Eventos de serviços
   - `servico_tarefas` - Tarefas de serviços
   - `servico_equipes` - Equipes de serviços
   - `cliente_eventos` - Eventos de clientes
   - `cliente_tarefas` - Tarefas de clientes
   - `propriedade_geometrias` - Geometrias de propriedades
   - `fato_orcamento_itens` - Itens de orçamentos

2. **Tabelas de fatos (segundo)**
   - `fato_despesas` - Despesas
   - `fato_orcamento` - Orçamentos
   - `fato_servico` - Serviços

3. **Tabelas de dimensões (terceiro)**
   - `dim_propriedade` - Propriedades
   - `dim_cliente` - Clientes

4. **Notificações**
   - `notificacoes` - Notificações do sistema

## O que NÃO será excluído
- `dim_empresa` - Registro da empresa (mantido)
- `dim_tiposervico` - Tipos de serviço (mantido para reutilização)
- `dim_tipodespesa` - Tipos de despesa (mantido)
- `dim_categoria_*` - Categorias (mantidas)
- `tenants` - Dados do tenant
- `tenant_members` - Membros da equipe
- `tenant_subscriptions` - Assinatura/plano
- `profiles` - Perfis de usuários
- Template de orçamento da empresa

---

## Detalhes Técnicos

### 1. Componente de Confirmação
Usar o `ConfirmDialog` existente com confirmação extra para operações destrutivas:

```text
┌──────────────────────────────────────────────────┐
│  ⚠️ Excluir Todos os Dados                       │
├──────────────────────────────────────────────────┤
│  ATENÇÃO: Esta ação é irreversível!              │
│                                                  │
│  Serão excluídos permanentemente:                │
│  • Todos os clientes                             │
│  • Todas as propriedades                         │
│  • Todos os serviços e orçamentos                │
│  • Todas as despesas                             │
│  • Todos os eventos e tarefas                    │
│                                                  │
│  Os tipos de serviço, tipos de despesa e         │
│  configurações da empresa serão mantidos.        │
│                                                  │
│  [Cancelar]           [Excluir Tudo]             │
└──────────────────────────────────────────────────┘
```

### 2. Serviço de Exclusão
Criar `src/services/reset-company-data.service.ts`:
- Função `deleteAllCompanyData(tenantId: string)`
- Executa exclusões na ordem correta respeitando FKs
- Retorna contagem de registros removidos

### 3. Mutation React Query
Implementar mutation com:
- Estado de loading durante exclusão
- Toast de sucesso com resumo
- Invalidação de todas as queries relevantes
- Tratamento de erros

### 4. UI no Card "Dados e Backup"
Adicionar novo botão com separador visual:
- Cor destrutiva (vermelho)
- Ícone `Trash2`
- Texto "Excluir Todos os Dados"

## Arquivos a Serem Criados/Modificados

| Arquivo | Ação |
|---------|------|
| `src/services/reset-company-data.service.ts` | Criar - Lógica de exclusão |
| `src/pages/Configuracoes.tsx` | Modificar - Adicionar botão e dialog |

## Fluxo de Execução

```text
Usuário clica "Excluir Todos os Dados"
           │
           ▼
    Dialog de confirmação
           │
           ▼
  Usuário confirma exclusão
           │
           ▼
   Obter tenant_id atual
           │
           ▼
  Executar exclusões em ordem:
  1. servico_anexos
  2. servico_eventos
  3. servico_tarefas
  4. servico_equipes
  5. cliente_eventos
  6. cliente_tarefas
  7. propriedade_geometrias
  8. fato_orcamento_itens
  9. fato_despesas
  10. fato_orcamento
  11. fato_servico
  12. dim_propriedade
  13. dim_cliente
  14. notificacoes
           │
           ▼
  Invalidar queries do React Query
           │
           ▼
  Toast de sucesso com resumo
```

## Segurança
- Todas as exclusões filtradas por `tenant_id`
- Sem acesso a dados de outros tenants
- RLS do banco como segunda camada de proteção
