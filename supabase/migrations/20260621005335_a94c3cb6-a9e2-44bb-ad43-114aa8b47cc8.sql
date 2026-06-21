ALTER TABLE public.fato_orcamento
  ADD COLUMN IF NOT EXISTS incluir_art boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_art numeric NOT NULL DEFAULT 0;