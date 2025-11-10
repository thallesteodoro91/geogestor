-- Add anotacoes field to dim_cliente table
ALTER TABLE public.dim_cliente 
ADD COLUMN IF NOT EXISTS anotacoes text;

-- Add anotacoes field to dim_propriedade table
ALTER TABLE public.dim_propriedade 
ADD COLUMN IF NOT EXISTS anotacoes text;