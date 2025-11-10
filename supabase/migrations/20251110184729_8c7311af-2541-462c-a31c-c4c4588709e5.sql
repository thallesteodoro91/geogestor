-- Adicionar relacionamento entre Propriedade e Cliente
ALTER TABLE public.dim_propriedade
ADD COLUMN id_cliente UUID REFERENCES public.dim_cliente(id_cliente) ON DELETE SET NULL;

-- Criar índice para melhor performance nas consultas
CREATE INDEX idx_propriedade_cliente ON public.dim_propriedade(id_cliente);

-- Comentário para documentação
COMMENT ON COLUMN public.dim_propriedade.id_cliente IS 'Cliente proprietário da propriedade';