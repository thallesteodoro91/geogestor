-- Create cliente_eventos table for timeline
CREATE TABLE public.cliente_eventos (
  id_evento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cliente UUID NOT NULL REFERENCES public.dim_cliente(id_cliente) ON DELETE CASCADE,
  id_servico UUID REFERENCES public.fato_servico(id_servico) ON DELETE SET NULL,
  id_propriedade UUID REFERENCES public.dim_propriedade(id_propriedade) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  metadata JSONB DEFAULT '{}',
  manual BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  tenant_id UUID REFERENCES public.tenants(id)
);

-- Create cliente_tarefas table for checklist
CREATE TABLE public.cliente_tarefas (
  id_tarefa UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cliente UUID NOT NULL REFERENCES public.dim_cliente(id_cliente) ON DELETE CASCADE,
  id_servico UUID REFERENCES public.fato_servico(id_servico) ON DELETE SET NULL,
  id_propriedade UUID REFERENCES public.dim_propriedade(id_propriedade) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  prioridade TEXT DEFAULT 'media',
  concluida BOOLEAN DEFAULT false,
  data_conclusao TIMESTAMPTZ,
  data_vencimento DATE,
  responsavel TEXT,
  observacoes TEXT,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  tenant_id UUID REFERENCES public.tenants(id)
);

-- Create indexes for performance
CREATE INDEX idx_cliente_eventos_cliente ON public.cliente_eventos(id_cliente);
CREATE INDEX idx_cliente_eventos_servico ON public.cliente_eventos(id_servico);
CREATE INDEX idx_cliente_eventos_tenant ON public.cliente_eventos(tenant_id);
CREATE INDEX idx_cliente_tarefas_cliente ON public.cliente_tarefas(id_cliente);
CREATE INDEX idx_cliente_tarefas_servico ON public.cliente_tarefas(id_servico);
CREATE INDEX idx_cliente_tarefas_tenant ON public.cliente_tarefas(tenant_id);

-- Enable RLS
ALTER TABLE public.cliente_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_tarefas ENABLE ROW LEVEL SECURITY;

-- RLS policies for cliente_eventos
CREATE POLICY "Users can view cliente_eventos from their tenant"
ON public.cliente_eventos FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert cliente_eventos in their tenant"
ON public.cliente_eventos FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update cliente_eventos in their tenant"
ON public.cliente_eventos FOR UPDATE
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete manual cliente_eventos in their tenant"
ON public.cliente_eventos FOR DELETE
USING (tenant_id = get_user_tenant_id(auth.uid()) AND manual = true);

-- RLS policies for cliente_tarefas
CREATE POLICY "Users can view cliente_tarefas from their tenant"
ON public.cliente_tarefas FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert cliente_tarefas in their tenant"
ON public.cliente_tarefas FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update cliente_tarefas in their tenant"
ON public.cliente_tarefas FOR UPDATE
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete cliente_tarefas in their tenant"
ON public.cliente_tarefas FOR DELETE
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Add trigger for updated_at on cliente_tarefas
CREATE TRIGGER update_cliente_tarefas_updated_at
BEFORE UPDATE ON public.cliente_tarefas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.cliente_eventos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cliente_tarefas;