-- Corrigir FK de fato_orcamento_itens.id_servico para referenciar dim_tiposervico ao invés de fato_servico
-- O orçamento usa tipos de serviço do catálogo, não serviços executados

-- Remover FK antiga
ALTER TABLE public.fato_orcamento_itens
DROP CONSTRAINT IF EXISTS fato_orcamento_itens_id_servico_fkey;

-- Criar nova FK para dim_tiposervico
ALTER TABLE public.fato_orcamento_itens
ADD CONSTRAINT fato_orcamento_itens_id_servico_fkey
FOREIGN KEY (id_servico) REFERENCES public.dim_tiposervico(id_tiposervico)
ON DELETE SET NULL;