
# Plano: Sistema de Logs de Auditoria

## Visao Geral

Criar um sistema completo de rastreabilidade que registra acoes criticas (INSERT, UPDATE, DELETE) realizadas pelos usuarios, permitindo que administradores saibam exatamente "quem fez o que e quando".

## Etapas de Implementacao

### 1. Criar tabela `audit_logs` (Migracao SQL)

```sql
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,          -- INSERT, UPDATE, DELETE
  entity TEXT NOT NULL,          -- Orcamento, Despesa, Servico, Cliente, etc.
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indice para consultas por tenant + data
CREATE INDEX idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);

-- RLS: somente admins do tenant podem ler
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- Qualquer usuario autenticado do tenant pode inserir logs
CREATE POLICY "Users can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
```

### 2. Criar servico `AuditService` no frontend

Arquivo: `src/services/audit.service.ts`

- Funcao `logAuditEvent(action, entity, entityId, oldData?, newData?)` que insere na tabela `audit_logs` com `tenant_id` e `user_id` automaticos.
- Sera chamado em pontos criticos do sistema:
  - Aprovacao/edicao/exclusao de orcamentos
  - Criacao/edicao/exclusao de despesas
  - Criacao/edicao/exclusao de servicos
  - Criacao/edicao/exclusao de clientes

### 3. Criar pagina `AuditLogs.tsx`

Arquivo: `src/pages/AuditLogs.tsx`

- Acessivel apenas para admins (verificacao via `has_role`)
- Tabela cronologica com colunas: Data/Hora, Usuario, Acao, Entidade, Detalhes
- Filtros por: periodo, tipo de acao, entidade
- Badges coloridos para acoes (verde=INSERT, azul=UPDATE, vermelho=DELETE)
- Paginacao usando o hook `usePagination` existente
- Usa `ResponsiveTable` para compatibilidade mobile
- Botao para expandir e ver old_data/new_data em JSON formatado

### 4. Adicionar rota e navegacao

- Rota `/audit-logs` em `App.tsx` (protegida)
- Link na Sidebar dentro da secao "Base de Dados" com icone `Shield`

### 5. Integrar AuditService nos servicos existentes

Adicionar chamadas ao `logAuditEvent` nos pontos criticos ja existentes:
- `OrcamentoDialog.tsx` - ao salvar/editar orcamento
- `DespesasPendentes.tsx` - ao confirmar/excluir despesas
- Pagina `Despesas.tsx` - ao criar/editar/excluir
- `NovoServicoDialog.tsx` - ao criar servico
- `ClienteDialog.tsx` - ao criar/editar cliente

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| Migracao SQL | Criar | Tabela audit_logs com RLS |
| `src/services/audit.service.ts` | Criar | Servico de auditoria |
| `src/pages/AuditLogs.tsx` | Criar | Pagina de logs (admin only) |
| `src/App.tsx` | Modificar | Adicionar rota /audit-logs |
| `src/components/layout/Sidebar.tsx` | Modificar | Link para Logs de Auditoria |
| `src/components/cadastros/OrcamentoDialog.tsx` | Modificar | Registrar audit log |
| `src/components/despesas/DespesasPendentes.tsx` | Modificar | Registrar audit log |
| `src/components/servicos/NovoServicoDialog.tsx` | Modificar | Registrar audit log |
| `src/components/cadastros/ClienteDialog.tsx` | Modificar | Registrar audit log |

---

## Detalhes Tecnicos

### AuditService API

```typescript
// src/services/audit.service.ts
export async function logAuditEvent(params: {
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  entity: string;
  entityId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}): Promise<void>
```

### Verificacao de Admin na Pagina

A pagina usara uma query para verificar se o usuario tem role `admin` via `user_roles`. Usuarios sem permissao verao uma mensagem de acesso negado.

### Filtros da Pagina

- Seletor de periodo (data inicio / data fim)
- Dropdown de acao (INSERT, UPDATE, DELETE, Todos)
- Dropdown de entidade (Orcamento, Despesa, Servico, Cliente, Todos)
- Busca por nome de usuario

### Exemplo Visual da Tabela

```text
Data/Hora          | Usuario      | Acao    | Entidade   | Detalhes
2026-02-07 14:30   | Joao Silva   | UPDATE  | Orcamento  | [Ver detalhes]
2026-02-07 13:15   | Maria Santos | DELETE  | Despesa    | [Ver detalhes]
2026-02-07 12:00   | Joao Silva   | INSERT  | Servico    | [Ver detalhes]
```
