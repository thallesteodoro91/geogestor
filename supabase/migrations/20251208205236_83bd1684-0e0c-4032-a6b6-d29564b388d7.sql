-- Create dim_categoria_despesa table
CREATE TABLE public.dim_categoria_despesa (
  id_categoria_despesa uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dim_categoria_despesa ENABLE ROW LEVEL SECURITY;

-- RLS policies for dim_categoria_despesa
CREATE POLICY "Users can read own tenant expense categories"
ON public.dim_categoria_despesa FOR SELECT
USING (tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert own tenant expense categories"
ON public.dim_categoria_despesa FOR INSERT
WITH CHECK (tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update own tenant expense categories"
ON public.dim_categoria_despesa FOR UPDATE
USING (tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete own tenant expense categories"
ON public.dim_categoria_despesa FOR DELETE
USING (tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid()));

-- Add FK column to dim_tipodespesa
ALTER TABLE public.dim_tipodespesa 
ADD COLUMN id_categoria_despesa uuid REFERENCES public.dim_categoria_despesa(id_categoria_despesa);

-- Create index for performance
CREATE INDEX idx_dim_tipodespesa_categoria ON public.dim_tipodespesa(id_categoria_despesa);
CREATE INDEX idx_dim_categoria_despesa_tenant ON public.dim_categoria_despesa(tenant_id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';