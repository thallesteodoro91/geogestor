-- Add tax fields to fato_orcamento (budget level instead of item level)
ALTER TABLE fato_orcamento 
ADD COLUMN IF NOT EXISTS incluir_imposto boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS percentual_imposto numeric DEFAULT 0;