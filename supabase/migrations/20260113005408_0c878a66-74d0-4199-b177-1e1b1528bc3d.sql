-- =====================================================
-- FOREIGN KEYS PARA RELACIONAMENTOS PRINCIPAIS
-- =====================================================

-- fato_servico -> dim_cliente
ALTER TABLE public.fato_servico
ADD CONSTRAINT fk_servico_cliente
FOREIGN KEY (id_cliente) REFERENCES public.dim_cliente(id_cliente)
ON DELETE SET NULL;

-- fato_servico -> dim_propriedade
ALTER TABLE public.fato_servico
ADD CONSTRAINT fk_servico_propriedade
FOREIGN KEY (id_propriedade) REFERENCES public.dim_propriedade(id_propriedade)
ON DELETE SET NULL;

-- fato_servico -> dim_empresa
ALTER TABLE public.fato_servico
ADD CONSTRAINT fk_servico_empresa
FOREIGN KEY (id_empresa) REFERENCES public.dim_empresa(id_empresa)
ON DELETE SET NULL;

-- fato_orcamento -> dim_cliente
ALTER TABLE public.fato_orcamento
ADD CONSTRAINT fk_orcamento_cliente
FOREIGN KEY (id_cliente) REFERENCES public.dim_cliente(id_cliente)
ON DELETE SET NULL;

-- fato_orcamento -> dim_propriedade
ALTER TABLE public.fato_orcamento
ADD CONSTRAINT fk_orcamento_propriedade
FOREIGN KEY (id_propriedade) REFERENCES public.dim_propriedade(id_propriedade)
ON DELETE SET NULL;

-- fato_orcamento -> fato_servico
ALTER TABLE public.fato_orcamento
ADD CONSTRAINT fk_orcamento_servico
FOREIGN KEY (id_servico) REFERENCES public.fato_servico(id_servico)
ON DELETE SET NULL;

-- =====================================================
-- FOREIGN KEYS PARA TABELAS DE CLIENTE
-- =====================================================

-- cliente_eventos -> dim_cliente
ALTER TABLE public.cliente_eventos
ADD CONSTRAINT fk_cliente_eventos_cliente
FOREIGN KEY (id_cliente) REFERENCES public.dim_cliente(id_cliente)
ON DELETE CASCADE;

-- cliente_eventos -> fato_servico
ALTER TABLE public.cliente_eventos
ADD CONSTRAINT fk_cliente_eventos_servico
FOREIGN KEY (id_servico) REFERENCES public.fato_servico(id_servico)
ON DELETE SET NULL;

-- cliente_eventos -> dim_propriedade
ALTER TABLE public.cliente_eventos
ADD CONSTRAINT fk_cliente_eventos_propriedade
FOREIGN KEY (id_propriedade) REFERENCES public.dim_propriedade(id_propriedade)
ON DELETE SET NULL;

-- cliente_tarefas -> dim_cliente
ALTER TABLE public.cliente_tarefas
ADD CONSTRAINT fk_cliente_tarefas_cliente
FOREIGN KEY (id_cliente) REFERENCES public.dim_cliente(id_cliente)
ON DELETE CASCADE;

-- cliente_tarefas -> fato_servico
ALTER TABLE public.cliente_tarefas
ADD CONSTRAINT fk_cliente_tarefas_servico
FOREIGN KEY (id_servico) REFERENCES public.fato_servico(id_servico)
ON DELETE SET NULL;

-- cliente_tarefas -> dim_propriedade
ALTER TABLE public.cliente_tarefas
ADD CONSTRAINT fk_cliente_tarefas_propriedade
FOREIGN KEY (id_propriedade) REFERENCES public.dim_propriedade(id_propriedade)
ON DELETE SET NULL;

-- =====================================================
-- FOREIGN KEYS PARA TABELAS DE SERVIÇO
-- =====================================================

-- servico_tarefas -> fato_servico
ALTER TABLE public.servico_tarefas
ADD CONSTRAINT fk_servico_tarefas_servico
FOREIGN KEY (id_servico) REFERENCES public.fato_servico(id_servico)
ON DELETE CASCADE;

-- servico_anexos -> fato_servico
ALTER TABLE public.servico_anexos
ADD CONSTRAINT fk_servico_anexos_servico
FOREIGN KEY (id_servico) REFERENCES public.fato_servico(id_servico)
ON DELETE CASCADE;

-- servico_equipes -> fato_servico
ALTER TABLE public.servico_equipes
ADD CONSTRAINT fk_servico_equipes_servico
FOREIGN KEY (id_servico) REFERENCES public.fato_servico(id_servico)
ON DELETE CASCADE;

-- servico_eventos -> fato_servico
ALTER TABLE public.servico_eventos
ADD CONSTRAINT fk_servico_eventos_servico
FOREIGN KEY (id_servico) REFERENCES public.fato_servico(id_servico)
ON DELETE CASCADE;

-- =====================================================
-- FOREIGN KEYS PARA TABELAS DE PROPRIEDADE
-- =====================================================

-- propriedade_geometria -> dim_propriedade
ALTER TABLE public.propriedade_geometria
ADD CONSTRAINT fk_geometria_propriedade
FOREIGN KEY (id_propriedade) REFERENCES public.dim_propriedade(id_propriedade)
ON DELETE CASCADE;

-- dim_propriedade -> dim_cliente
ALTER TABLE public.dim_propriedade
ADD CONSTRAINT fk_propriedade_cliente
FOREIGN KEY (id_cliente) REFERENCES public.dim_cliente(id_cliente)
ON DELETE SET NULL;

-- =====================================================
-- FOREIGN KEYS PARA TABELAS DE DESPESAS E TIPOS
-- =====================================================

-- fato_despesas -> fato_servico
ALTER TABLE public.fato_despesas
ADD CONSTRAINT fk_despesas_servico
FOREIGN KEY (id_servico) REFERENCES public.fato_servico(id_servico)
ON DELETE SET NULL;

-- fato_despesas -> fato_orcamento
ALTER TABLE public.fato_despesas
ADD CONSTRAINT fk_despesas_orcamento
FOREIGN KEY (id_orcamento) REFERENCES public.fato_orcamento(id_orcamento)
ON DELETE SET NULL;

-- fato_despesas -> dim_tipodespesa
ALTER TABLE public.fato_despesas
ADD CONSTRAINT fk_despesas_tipodespesa
FOREIGN KEY (id_tipodespesa) REFERENCES public.dim_tipodespesa(id_tipodespesa)
ON DELETE SET NULL;

-- dim_tipodespesa -> dim_categoria_despesa
ALTER TABLE public.dim_tipodespesa
ADD CONSTRAINT fk_tipodespesa_categoria
FOREIGN KEY (id_categoria_despesa) REFERENCES public.dim_categoria_despesa(id_categoria_despesa)
ON DELETE SET NULL;

-- dim_tiposervico -> dim_categoria_servico
ALTER TABLE public.dim_tiposervico
ADD CONSTRAINT fk_tiposervico_categoria
FOREIGN KEY (id_categoria) REFERENCES public.dim_categoria_servico(id_categoria)
ON DELETE SET NULL;

-- fato_orcamento_itens -> fato_orcamento
ALTER TABLE public.fato_orcamento_itens
ADD CONSTRAINT fk_orcamento_itens_orcamento
FOREIGN KEY (id_orcamento) REFERENCES public.fato_orcamento(id_orcamento)
ON DELETE CASCADE;

-- fato_orcamento_itens -> fato_servico
ALTER TABLE public.fato_orcamento_itens
ADD CONSTRAINT fk_orcamento_itens_servico
FOREIGN KEY (id_servico) REFERENCES public.fato_servico(id_servico)
ON DELETE SET NULL;