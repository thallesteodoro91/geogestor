
ALTER TABLE public.dim_cliente
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.dim_propriedade
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.fato_servico
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.fato_orcamento
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;
