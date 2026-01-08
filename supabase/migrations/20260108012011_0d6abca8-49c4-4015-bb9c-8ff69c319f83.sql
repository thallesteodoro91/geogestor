-- Drop old constraint and add new one that supports all categories including comma-separated values
ALTER TABLE public.dim_cliente 
DROP CONSTRAINT IF EXISTS dim_cliente_categoria_check;

ALTER TABLE public.dim_cliente 
ADD CONSTRAINT dim_cliente_categoria_check 
CHECK (categoria IS NULL OR categoria ~ '^(Produtor Rural|Empresa|Pessoa Física|Pessoa Jurídica|Governo|ONG|Parceiro)(, (Produtor Rural|Empresa|Pessoa Física|Pessoa Jurídica|Governo|ONG|Parceiro))*$');