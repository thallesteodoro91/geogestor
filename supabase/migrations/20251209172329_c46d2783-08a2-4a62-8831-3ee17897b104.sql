-- Adicionar coluna anotacoes à tabela fato_orcamento
ALTER TABLE public.fato_orcamento 
ADD COLUMN anotacoes text NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.fato_orcamento.anotacoes IS 'Anotações e observações do orçamento';