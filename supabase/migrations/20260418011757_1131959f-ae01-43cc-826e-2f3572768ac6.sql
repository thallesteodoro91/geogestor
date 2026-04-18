
-- ============================================================
-- AUDITORIA BACKEND: PERFORMANCE, SEGURANÇA E ARQUITETURA
-- ============================================================

-- 1. ÍNDICES tenant_id e compostos para tabelas com seq_scan alto
CREATE INDEX IF NOT EXISTS idx_fato_orcamento_tenant_id ON public.fato_orcamento(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fato_orcamento_tenant_data ON public.fato_orcamento(tenant_id, data_orcamento);
CREATE INDEX IF NOT EXISTS idx_fato_despesas_tenant_id ON public.fato_despesas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fato_despesas_tenant_data ON public.fato_despesas(tenant_id, data_da_despesa);
CREATE INDEX IF NOT EXISTS idx_fato_servico_tenant_id ON public.fato_servico(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dim_tipodespesa_tenant_id ON public.dim_tipodespesa(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dim_cliente_tenant_id ON public.dim_cliente(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dim_propriedade_tenant_id ON public.dim_propriedade(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_tenant_lida ON public.notificacoes(tenant_id, lida);
CREATE INDEX IF NOT EXISTS idx_cliente_tarefas_tenant ON public.cliente_tarefas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cliente_eventos_tenant ON public.cliente_eventos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON public.audit_logs(tenant_id, created_at DESC);

-- 2. REMOVER FKs DUPLICADAS (manter as fk_* com ON DELETE definido)
-- fato_orcamento: remover as duplicatas sem ON DELETE
ALTER TABLE public.fato_orcamento DROP CONSTRAINT IF EXISTS fato_orcamento_id_cliente_fkey;
ALTER TABLE public.fato_orcamento DROP CONSTRAINT IF EXISTS fato_orcamento_id_propriedade_fkey;
ALTER TABLE public.fato_orcamento DROP CONSTRAINT IF EXISTS fato_orcamento_id_servico_fkey;
-- E remover fk_orcamento_cliente (conflita com NOT NULL em id_cliente)
ALTER TABLE public.fato_orcamento DROP CONSTRAINT IF EXISTS fk_orcamento_cliente;
-- Recriar id_cliente com RESTRICT (impede delete de cliente com orçamentos)
ALTER TABLE public.fato_orcamento
  ADD CONSTRAINT fk_orcamento_cliente
  FOREIGN KEY (id_cliente) REFERENCES public.dim_cliente(id_cliente) ON DELETE RESTRICT;

-- fato_servico: remover duplicatas
ALTER TABLE public.fato_servico DROP CONSTRAINT IF EXISTS fato_servico_id_cliente_fkey;
ALTER TABLE public.fato_servico DROP CONSTRAINT IF EXISTS fato_servico_id_propriedade_fkey;
ALTER TABLE public.fato_servico DROP CONSTRAINT IF EXISTS fato_servico_id_empresa_fkey;

-- fato_despesas: remover duplicatas
ALTER TABLE public.fato_despesas DROP CONSTRAINT IF EXISTS fato_despesas_id_orcamento_fkey;
ALTER TABLE public.fato_despesas DROP CONSTRAINT IF EXISTS fato_despesas_id_servico_fkey;
ALTER TABLE public.fato_despesas DROP CONSTRAINT IF EXISTS fato_despesas_id_tipodespesa_fkey;

-- fato_orcamento_itens: corrigir FK errada (apontava para dim_tiposervico)
ALTER TABLE public.fato_orcamento_itens DROP CONSTRAINT IF EXISTS fato_orcamento_itens_id_orcamento_fkey;
ALTER TABLE public.fato_orcamento_itens DROP CONSTRAINT IF EXISTS fato_orcamento_itens_id_servico_fkey;

-- 3. CRIAR TRIGGER AUSENTE: auto-criar serviço ao converter orçamento
DROP TRIGGER IF EXISTS trg_auto_criar_servico ON public.fato_orcamento;
CREATE TRIGGER trg_auto_criar_servico
AFTER UPDATE ON public.fato_orcamento
FOR EACH ROW
EXECUTE FUNCTION public.auto_criar_servico_ao_converter_orcamento();

-- 4. LIMPAR ÓRFÃO em dim_categoria_evento e tornar tenant_id NOT NULL
DELETE FROM public.dim_categoria_evento WHERE tenant_id IS NULL;

ALTER TABLE public.dim_cliente ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.dim_propriedade ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.dim_empresa ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.dim_tipodespesa ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.dim_tiposervico ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.dim_categoria_despesa ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.dim_categoria_servico ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.dim_categoria_evento ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.fato_orcamento ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.fato_despesas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.fato_servico ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.fato_orcamento_itens ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.cliente_tarefas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.cliente_eventos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.notificacoes ALTER COLUMN tenant_id SET NOT NULL;

-- 5. CHECK CONSTRAINTS de integridade
ALTER TABLE public.fato_orcamento DROP CONSTRAINT IF EXISTS chk_percentual_imposto_range;
ALTER TABLE public.fato_orcamento ADD CONSTRAINT chk_percentual_imposto_range
  CHECK (percentual_imposto IS NULL OR (percentual_imposto >= 0 AND percentual_imposto <= 100));

ALTER TABLE public.fato_orcamento DROP CONSTRAINT IF EXISTS chk_quantidade_positiva;
ALTER TABLE public.fato_orcamento ADD CONSTRAINT chk_quantidade_positiva
  CHECK (quantidade > 0);

ALTER TABLE public.fato_servico DROP CONSTRAINT IF EXISTS chk_progresso_range;
ALTER TABLE public.fato_servico ADD CONSTRAINT chk_progresso_range
  CHECK (progresso IS NULL OR (progresso >= 0 AND progresso <= 100));

ALTER TABLE public.subscription_plans DROP CONSTRAINT IF EXISTS chk_price_cents_nao_negativo;
ALTER TABLE public.subscription_plans ADD CONSTRAINT chk_price_cents_nao_negativo
  CHECK (price_cents >= 0);

ALTER TABLE public.fato_despesas DROP CONSTRAINT IF EXISTS chk_valor_despesa_positivo;
ALTER TABLE public.fato_despesas ADD CONSTRAINT chk_valor_despesa_positivo
  CHECK (valor_da_despesa >= 0);

-- 6. REMOVER FUNÇÃO LEGADA calcular_kpis() v1
DROP FUNCTION IF EXISTS public.calcular_kpis();

-- 7. RETENÇÃO DE AUDIT LOGS (>180 dias) — função invocável por cron
CREATE OR REPLACE FUNCTION public.purge_old_audit_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '180 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_audit_logs() FROM PUBLIC, anon, authenticated;
