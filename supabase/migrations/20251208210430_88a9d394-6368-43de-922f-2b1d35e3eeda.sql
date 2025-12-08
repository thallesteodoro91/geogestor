-- Add categoria text column to dim_tiposervico
ALTER TABLE public.dim_tiposervico ADD COLUMN IF NOT EXISTS categoria text;

-- Migrate existing data from dim_categoria_servico to the new categoria column
UPDATE public.dim_tiposervico ts
SET categoria = cs.nome
FROM public.dim_categoria_servico cs
WHERE ts.id_categoria = cs.id_categoria
AND ts.categoria IS NULL;