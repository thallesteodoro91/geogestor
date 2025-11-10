-- Add celular field to dim_cliente table
ALTER TABLE public.dim_cliente 
ADD COLUMN IF NOT EXISTS celular text;