

## Diagnóstico

**Causa raiz encontrada**: A função de banco de dados `create_tenant_for_user` insere um registro na tabela `tenants` sem preencher a coluna `slug`, que é `NOT NULL` e não tem valor default. Isso faz com que toda criação de tenant para novos usuários falhe com:

```
null value in column "slug" of relation "tenants" violates not-null constraint
```

Os 2 tenants existentes no banco já têm slug preenchido (foram criados antes ou manualmente), por isso o erro só afeta **novos clientes** ao fazer primeiro login.

O erro é capturado no `TenantContext` e exibido como "Erro ao carregar dados do tenant".

## Correção

Uma única migração SQL que atualiza a função `create_tenant_for_user` para gerar o slug automaticamente a partir do nome da empresa (slugify: lowercase, remove acentos, substitui espaços por hífens):

```sql
CREATE OR REPLACE FUNCTION public.create_tenant_for_user(p_user_id uuid, p_company_name text)
RETURNS uuid ...
AS $$
  -- Gerar slug a partir do nome
  v_slug := lower(regexp_replace(
    translate(trim(p_company_name), 'áàãâéèêíìîóòõôúùûçÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ',
                                    'aaaaeeeiiioooouuucAAAAEEEIIIOOOOUUUC'),
    '[^a-z0-9]+', '-', 'g'));
  -- Remover hífens nas extremidades
  v_slug := trim(both '-' from v_slug);
  -- Garantir unicidade com sufixo aleatório
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);

  INSERT INTO tenants (name, slug) VALUES (p_company_name, v_slug) ...
$$
```

Adicionalmente, como medida de segurança, será adicionado um valor `DEFAULT` na coluna `slug` para evitar futuros problemas:

```sql
ALTER TABLE tenants ALTER COLUMN slug SET DEFAULT '';
```

**Nenhuma alteração no frontend é necessária** — o `TenantContext` e o `tenant.service.ts` já tratam o fluxo corretamente; o problema é exclusivamente no banco de dados.

## Impacto

- Corrige o bloqueio de login para todos os novos clientes
- Zero impacto nos 2 tenants existentes
- Garante slugs únicos e válidos automaticamente

