-- Adicionar colunas para Marco na tabela fato_orcamento
ALTER TABLE public.fato_orcamento 
ADD COLUMN IF NOT EXISTS incluir_marco boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS marco_quantidade integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS marco_valor_unitario numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS marco_valor_total numeric DEFAULT 0;

COMMENT ON COLUMN public.fato_orcamento.incluir_marco IS 'Indica se o orçamento inclui marcos topográficos';
COMMENT ON COLUMN public.fato_orcamento.marco_quantidade IS 'Quantidade de marcos incluídos no orçamento';
COMMENT ON COLUMN public.fato_orcamento.marco_valor_unitario IS 'Valor unitário de cada marco';
COMMENT ON COLUMN public.fato_orcamento.marco_valor_total IS 'Valor total dos marcos (quantidade x valor unitário)';