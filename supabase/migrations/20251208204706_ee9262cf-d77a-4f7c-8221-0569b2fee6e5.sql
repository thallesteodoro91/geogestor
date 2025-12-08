-- Create table for service categories
CREATE TABLE public.dim_categoria_servico (
    id_categoria uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    descricao text,
    tenant_id uuid REFERENCES public.tenants(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create table for service types (catalog)
CREATE TABLE public.dim_tiposervico (
    id_tiposervico uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    id_categoria uuid REFERENCES public.dim_categoria_servico(id_categoria),
    descricao text,
    valor_sugerido numeric DEFAULT 0,
    ativo boolean DEFAULT true,
    tenant_id uuid REFERENCES public.tenants(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dim_categoria_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_tiposervico ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dim_categoria_servico
CREATE POLICY "Users can read own tenant categories"
ON public.dim_categoria_servico FOR SELECT
USING (tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert own tenant categories"
ON public.dim_categoria_servico FOR INSERT
WITH CHECK (tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update own tenant categories"
ON public.dim_categoria_servico FOR UPDATE
USING (tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete own tenant categories"
ON public.dim_categoria_servico FOR DELETE
USING (tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for dim_tiposervico
CREATE POLICY "Users can read own tenant service types"
ON public.dim_tiposervico FOR SELECT
USING (tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert own tenant service types"
ON public.dim_tiposervico FOR INSERT
WITH CHECK (tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update own tenant service types"
ON public.dim_tiposervico FOR UPDATE
USING (tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete own tenant service types"
ON public.dim_tiposervico FOR DELETE
USING (tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_dim_categoria_servico_tenant ON public.dim_categoria_servico(tenant_id);
CREATE INDEX idx_dim_tiposervico_tenant ON public.dim_tiposervico(tenant_id);
CREATE INDEX idx_dim_tiposervico_categoria ON public.dim_tiposervico(id_categoria);

-- Create triggers for updated_at
CREATE TRIGGER update_dim_categoria_servico_updated_at
BEFORE UPDATE ON public.dim_categoria_servico
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dim_tiposervico_updated_at
BEFORE UPDATE ON public.dim_tiposervico
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();