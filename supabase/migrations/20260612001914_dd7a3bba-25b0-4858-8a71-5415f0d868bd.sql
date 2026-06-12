
ALTER TABLE public.dim_propriedade DROP CONSTRAINT IF EXISTS dim_propriedade_id_cliente_fkey;

ALTER TABLE public.fato_servico
  ADD CONSTRAINT fk_servico_orcamento
  FOREIGN KEY (id_orcamento) REFERENCES public.fato_orcamento(id_orcamento) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fato_servico_id_orcamento ON public.fato_servico(id_orcamento);
CREATE INDEX IF NOT EXISTS idx_fato_servico_data_inicio ON public.fato_servico(data_do_servico_inicio);
CREATE INDEX IF NOT EXISTS idx_fato_servico_tenant_data ON public.fato_servico(tenant_id, data_do_servico_inicio);
CREATE INDEX IF NOT EXISTS idx_fato_orcamento_situacao ON public.fato_orcamento(situacao);
CREATE INDEX IF NOT EXISTS idx_fato_orcamento_situacao_pagamento ON public.fato_orcamento(situacao_do_pagamento);

ALTER TABLE public.notificacao_dismissals ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.propriedade_geometria  ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.servico_anexos         ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.servico_equipes        ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.servico_eventos        ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.servico_tarefas        ALTER COLUMN tenant_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_same_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_t uuid;
BEGIN
  IF TG_TABLE_NAME = 'fato_orcamento' THEN
    IF NEW.id_cliente IS NOT NULL THEN
      SELECT tenant_id INTO v_t FROM dim_cliente WHERE id_cliente = NEW.id_cliente;
      IF v_t IS NOT NULL AND v_t <> NEW.tenant_id THEN
        RAISE EXCEPTION 'Cross-tenant: cliente fora do tenant';
      END IF;
    END IF;
    IF NEW.id_propriedade IS NOT NULL THEN
      SELECT tenant_id INTO v_t FROM dim_propriedade WHERE id_propriedade = NEW.id_propriedade;
      IF v_t IS NOT NULL AND v_t <> NEW.tenant_id THEN
        RAISE EXCEPTION 'Cross-tenant: propriedade fora do tenant';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'fato_servico' THEN
    IF NEW.id_cliente IS NOT NULL THEN
      SELECT tenant_id INTO v_t FROM dim_cliente WHERE id_cliente = NEW.id_cliente;
      IF v_t IS NOT NULL AND v_t <> NEW.tenant_id THEN
        RAISE EXCEPTION 'Cross-tenant: cliente fora do tenant';
      END IF;
    END IF;
    IF NEW.id_propriedade IS NOT NULL THEN
      SELECT tenant_id INTO v_t FROM dim_propriedade WHERE id_propriedade = NEW.id_propriedade;
      IF v_t IS NOT NULL AND v_t <> NEW.tenant_id THEN
        RAISE EXCEPTION 'Cross-tenant: propriedade fora do tenant';
      END IF;
    END IF;
    IF NEW.id_orcamento IS NOT NULL THEN
      SELECT tenant_id INTO v_t FROM fato_orcamento WHERE id_orcamento = NEW.id_orcamento;
      IF v_t IS NOT NULL AND v_t <> NEW.tenant_id THEN
        RAISE EXCEPTION 'Cross-tenant: orcamento fora do tenant';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'fato_despesas' THEN
    IF NEW.id_servico IS NOT NULL THEN
      SELECT tenant_id INTO v_t FROM fato_servico WHERE id_servico = NEW.id_servico;
      IF v_t IS NOT NULL AND v_t <> NEW.tenant_id THEN
        RAISE EXCEPTION 'Cross-tenant: servico fora do tenant';
      END IF;
    END IF;
    IF NEW.id_orcamento IS NOT NULL THEN
      SELECT tenant_id INTO v_t FROM fato_orcamento WHERE id_orcamento = NEW.id_orcamento;
      IF v_t IS NOT NULL AND v_t <> NEW.tenant_id THEN
        RAISE EXCEPTION 'Cross-tenant: orcamento fora do tenant';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_enforce_tenant_orcamento ON public.fato_orcamento;
CREATE TRIGGER trg_enforce_tenant_orcamento
  BEFORE INSERT OR UPDATE ON public.fato_orcamento
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_tenant();

DROP TRIGGER IF EXISTS trg_enforce_tenant_servico ON public.fato_servico;
CREATE TRIGGER trg_enforce_tenant_servico
  BEFORE INSERT OR UPDATE ON public.fato_servico
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_tenant();

DROP TRIGGER IF EXISTS trg_enforce_tenant_despesa ON public.fato_despesas;
CREATE TRIGGER trg_enforce_tenant_despesa
  BEFORE INSERT OR UPDATE ON public.fato_despesas
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_tenant();
