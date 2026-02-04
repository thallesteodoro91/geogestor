
# Plano: Auditoria e Correção de Segurança RLS

## Resumo da Auditoria

### Status Atual das Tabelas

| Tabela | RLS Ativo | Politicas | Status |
|--------|-----------|-----------|--------|
| cliente_eventos | Sim | SELECT/INSERT/UPDATE/DELETE | OK |
| cliente_tarefas | Sim | SELECT/INSERT/UPDATE/DELETE | OK |
| dim_categoria_despesa | Sim | SELECT/INSERT/UPDATE/DELETE | OK |
| dim_categoria_evento | Sim | SELECT/INSERT/UPDATE/DELETE | OK |
| dim_categoria_servico | Sim | SELECT/INSERT/UPDATE/DELETE | OK |
| dim_cliente | Sim | SELECT/INSERT/UPDATE/DELETE | OK |
| dim_data | Sim | SELECT (public) | OK - Tabela de referencia |
| dim_empresa | Sim | SELECT/INSERT/UPDATE/DELETE (admin) | OK |
| dim_propriedade | Sim | SELECT/INSERT/UPDATE/DELETE | OK |
| dim_tipodespesa | Sim | SELECT/INSERT/UPDATE/DELETE | OK |
| dim_tiposervico | Sim | SELECT/INSERT/UPDATE/DELETE | OK |
| fato_despesas | Sim | SELECT/INSERT/UPDATE/DELETE (admin) | OK |
| fato_orcamento | Sim | SELECT/INSERT/UPDATE/DELETE (admin) | OK |
| fato_orcamento_itens | Sim | SELECT/INSERT/UPDATE/DELETE (admin) | OK |
| fato_servico | Sim | SELECT/INSERT/UPDATE/DELETE (admin) | OK |
| notificacoes | Sim | SELECT/INSERT/UPDATE/DELETE | OK |
| profiles | Sim | SELECT/INSERT/UPDATE (own) | OK |
| propriedade_geometria | Sim | SELECT/INSERT/UPDATE/DELETE | OK |
| servico_anexos | Sim | SELECT/INSERT/DELETE | CORRIGIR - Sem UPDATE |
| servico_equipes | Sim | SELECT/INSERT/UPDATE/DELETE | OK |
| servico_eventos | Sim | SELECT/INSERT/DELETE | OK - Eventos sao imutaveis |
| servico_tarefas | Sim | SELECT/INSERT/UPDATE/DELETE | OK |
| subscription_plans | Sim | SELECT (public) | OK - Tabela de referencia |
| tenant_invites | Sim | SELECT/INSERT/UPDATE/DELETE (admin) | OK |
| tenant_members | Sim | SELECT/INSERT (own) | CORRIGIR - Sem UPDATE/DELETE |
| tenant_subscriptions | Sim | SELECT/INSERT/UPDATE/DELETE (admin) | OK |
| tenants | Sim | SELECT/INSERT/UPDATE | CORRIGIR - INSERT muito permissivo |
| user_roles | Sim | SELECT (own) | OK - Gerenciado internamente |

### Problemas Identificados pelo Linter

1. **SECURITY DEFINER View** (ERROR): Views `vw_alertas_financeiros` e `vw_kpis_financeiros` usam SECURITY DEFINER implicitamente - NAO E UM PROBLEMA REAL pois as views ja filtram por `get_user_tenant_id(auth.uid())`

2. **RLS Policy Always True** (WARN): Policy `Allow authenticated insert` em `tenants` usa `WITH CHECK (true)` - INTENCIONAL para permitir criacao de tenant no onboarding

3. **Leaked Password Protection** (WARN): Configuracao de autenticacao - NAO E RLS

---

## Acoes de Correcao

### 1. Fortalecer Politica de INSERT em `tenants`

**Problema**: A politica atual permite que qualquer usuario autenticado crie quantos tenants quiser.

**Solucao**: Adicionar verificacao para permitir INSERT apenas para usuarios que nao pertencem a nenhum tenant.

```sql
-- Politica mais segura: apenas usuarios sem tenant podem criar um
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.tenants;

CREATE POLICY "Allow authenticated insert without tenant"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = auth.uid()
  )
);
```

### 2. Adicionar Politicas Faltantes em `tenant_members`

**Problema**: Nao ha politicas de UPDATE/DELETE para `tenant_members`. Administradores devem poder gerenciar membros.

**Solucao**: Adicionar politicas para administradores.

```sql
-- Permitir que admins atualizem roles de membros do mesmo tenant
CREATE POLICY "Admins can update tenant members"
ON public.tenant_members
FOR UPDATE
TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Permitir que admins removam membros (exceto a si mesmos)
CREATE POLICY "Admins can delete tenant members"
ON public.tenant_members
FOR DELETE
TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
  AND user_id != auth.uid()  -- Nao pode remover a si mesmo
);
```

### 3. Adicionar Politica DELETE em `tenants`

**Problema**: Nao ha politica de DELETE para tenants. Admins devem poder excluir o tenant.

**Solucao**: Adicionar politica restritiva para superadmins ou desabilitar completamente.

```sql
-- Por seguranca, nao permitir exclusao de tenants via API
-- Se necessario, usar service_role no backend
-- Esta politica garante que NINGUEM pode deletar via API publica
```

### 4. Padronizar Politicas com Verificacao de NULL

Algumas tabelas usam verificacao mais rigorosa com `IS NOT NULL`:
```sql
((tenant_id IS NOT NULL) AND (get_user_tenant_id(auth.uid()) IS NOT NULL) AND (tenant_id = get_user_tenant_id(auth.uid())))
```

Outras usam apenas:
```sql
(tenant_id = get_user_tenant_id(auth.uid()))
```

**Recomendacao**: Padronizar todas para usar a versao com verificacao de NULL, que e mais segura e previne acesso quando tenant_id nao esta definido.

### 5. Converter Views para SECURITY INVOKER

**Problema**: Views `vw_alertas_financeiros` e `vw_kpis_financeiros` sao executadas com privilegios do criador.

**Solucao**: Recriar as views com `security_invoker = true`.

---

## Migracao SQL Completa

O script de migracao executara as seguintes acoes:

1. Confirmar que RLS esta ativo em todas as tabelas
2. Fortalecer politica de INSERT em `tenants`
3. Adicionar politicas de UPDATE/DELETE em `tenant_members` para admins
4. Padronizar politicas com verificacao de NULL onde faltante
5. Converter views para SECURITY INVOKER
6. Notificar PostgREST para recarregar schema

### Detalhes Tecnicos

**Funcoes de Seguranca Existentes (SECURITY DEFINER):**
- `get_user_tenant_id(uuid)`: Retorna o tenant_id do usuario
- `has_role(uuid, app_role)`: Verifica se usuario tem determinado papel
- `get_tenant_members()`: Retorna membros do tenant do usuario
- `get_tenant_profiles()`: Retorna profiles dos membros do tenant

**Padrao de Isolamento de Tenant:**
```sql
-- Padrao consistente para todas as tabelas com tenant_id
(
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL 
  AND tenant_id = get_user_tenant_id(auth.uid())
)
```

**Padrao para Operacoes Admin-Only:**
```sql
-- Adicionar has_role para operacoes criticas
(
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL 
  AND tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
)
```

---

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `supabase/migrations/YYYYMMDDHHMMSS_security_audit_rls.sql` | **Criar** - Script de correcao |

## Resumo das Correcoes

1. **tenants**: Restringir INSERT para usuarios sem tenant existente
2. **tenant_members**: Adicionar UPDATE/DELETE para admins
3. **Views financeiras**: Converter para SECURITY INVOKER
4. **Padronizacao**: Uniformizar verificacao de NULL em todas as politicas
5. **Validacao**: Confirmar RLS ativo em todas as 28 tabelas publicas

## Impacto

- **Seguranca**: Previne criacao multipla de tenants, permite gerenciamento de membros
- **Compatibilidade**: Mantém funcionamento atual da aplicacao
- **Performance**: Nenhum impacto significativo

## Pos-Implementacao

Apos executar a migracao:
1. Testar login/onboarding
2. Testar gerenciamento de equipe (convidar, remover membros)
3. Verificar dashboards financeiros
4. Executar linter novamente para confirmar correcoes
