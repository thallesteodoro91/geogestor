-- Tornar id_cliente obrigatório na tabela fato_orcamento
ALTER TABLE public.fato_orcamento ALTER COLUMN id_cliente SET NOT NULL;