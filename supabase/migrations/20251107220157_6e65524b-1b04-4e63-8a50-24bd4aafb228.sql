-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policy for user_roles (users can see their own roles)
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Drop existing permissive policies on all tables
DROP POLICY IF EXISTS "Allow authenticated read dim_cliente" ON public.dim_cliente;
DROP POLICY IF EXISTS "Allow authenticated insert dim_cliente" ON public.dim_cliente;
DROP POLICY IF EXISTS "Allow authenticated update dim_cliente" ON public.dim_cliente;
DROP POLICY IF EXISTS "Allow authenticated delete dim_cliente" ON public.dim_cliente;

DROP POLICY IF EXISTS "Allow authenticated read dim_empresa" ON public.dim_empresa;
DROP POLICY IF EXISTS "Allow authenticated insert dim_empresa" ON public.dim_empresa;
DROP POLICY IF EXISTS "Allow authenticated update dim_empresa" ON public.dim_empresa;
DROP POLICY IF EXISTS "Allow authenticated delete dim_empresa" ON public.dim_empresa;

DROP POLICY IF EXISTS "Allow authenticated read dim_propriedade" ON public.dim_propriedade;
DROP POLICY IF EXISTS "Allow authenticated insert dim_propriedade" ON public.dim_propriedade;
DROP POLICY IF EXISTS "Allow authenticated update dim_propriedade" ON public.dim_propriedade;
DROP POLICY IF EXISTS "Allow authenticated delete dim_propriedade" ON public.dim_propriedade;

DROP POLICY IF EXISTS "Allow authenticated read dim_tipodespesa" ON public.dim_tipodespesa;
DROP POLICY IF EXISTS "Allow authenticated insert dim_tipodespesa" ON public.dim_tipodespesa;
DROP POLICY IF EXISTS "Allow authenticated update dim_tipodespesa" ON public.dim_tipodespesa;
DROP POLICY IF EXISTS "Allow authenticated delete dim_tipodespesa" ON public.dim_tipodespesa;

DROP POLICY IF EXISTS "Allow authenticated read fato_servico" ON public.fato_servico;
DROP POLICY IF EXISTS "Allow authenticated insert fato_servico" ON public.fato_servico;
DROP POLICY IF EXISTS "Allow authenticated update fato_servico" ON public.fato_servico;
DROP POLICY IF EXISTS "Allow authenticated delete fato_servico" ON public.fato_servico;

DROP POLICY IF EXISTS "Allow authenticated read fato_despesas" ON public.fato_despesas;
DROP POLICY IF EXISTS "Allow authenticated insert fato_despesas" ON public.fato_despesas;
DROP POLICY IF EXISTS "Allow authenticated update fato_despesas" ON public.fato_despesas;
DROP POLICY IF EXISTS "Allow authenticated delete fato_despesas" ON public.fato_despesas;

DROP POLICY IF EXISTS "Allow authenticated read fato_orcamento" ON public.fato_orcamento;
DROP POLICY IF EXISTS "Allow authenticated insert fato_orcamento" ON public.fato_orcamento;
DROP POLICY IF EXISTS "Allow authenticated update fato_orcamento" ON public.fato_orcamento;
DROP POLICY IF EXISTS "Allow authenticated delete fato_orcamento" ON public.fato_orcamento;

-- Create new restrictive policies for dim_cliente (requires admin or user role)
CREATE POLICY "Authenticated users can read dim_cliente"
ON public.dim_cliente FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Authenticated users can insert dim_cliente"
ON public.dim_cliente FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Authenticated users can update dim_cliente"
ON public.dim_cliente FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Admins can delete dim_cliente"
ON public.dim_cliente FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create new restrictive policies for dim_empresa
CREATE POLICY "Authenticated users can read dim_empresa"
ON public.dim_empresa FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Authenticated users can insert dim_empresa"
ON public.dim_empresa FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Authenticated users can update dim_empresa"
ON public.dim_empresa FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Admins can delete dim_empresa"
ON public.dim_empresa FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create new restrictive policies for dim_propriedade
CREATE POLICY "Authenticated users can read dim_propriedade"
ON public.dim_propriedade FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Authenticated users can insert dim_propriedade"
ON public.dim_propriedade FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Authenticated users can update dim_propriedade"
ON public.dim_propriedade FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Admins can delete dim_propriedade"
ON public.dim_propriedade FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create new restrictive policies for dim_tipodespesa
CREATE POLICY "Authenticated users can read dim_tipodespesa"
ON public.dim_tipodespesa FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Authenticated users can insert dim_tipodespesa"
ON public.dim_tipodespesa FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Authenticated users can update dim_tipodespesa"
ON public.dim_tipodespesa FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Admins can delete dim_tipodespesa"
ON public.dim_tipodespesa FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create new restrictive policies for fato_servico
CREATE POLICY "Authenticated users can read fato_servico"
ON public.fato_servico FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Authenticated users can insert fato_servico"
ON public.fato_servico FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Authenticated users can update fato_servico"
ON public.fato_servico FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Admins can delete fato_servico"
ON public.fato_servico FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create new restrictive policies for fato_despesas
CREATE POLICY "Authenticated users can read fato_despesas"
ON public.fato_despesas FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Authenticated users can insert fato_despesas"
ON public.fato_despesas FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Authenticated users can update fato_despesas"
ON public.fato_despesas FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Admins can delete fato_despesas"
ON public.fato_despesas FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create new restrictive policies for fato_orcamento
CREATE POLICY "Authenticated users can read fato_orcamento"
ON public.fato_orcamento FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Authenticated users can insert fato_orcamento"
ON public.fato_orcamento FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Authenticated users can update fato_orcamento"
ON public.fato_orcamento FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user'));

CREATE POLICY "Admins can delete fato_orcamento"
ON public.fato_orcamento FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));