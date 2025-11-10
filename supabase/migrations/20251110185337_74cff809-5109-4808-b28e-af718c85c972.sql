-- Atualizar política de DELETE para permitir usuários autenticados
DROP POLICY IF EXISTS "Admins can delete dim_cliente" ON public.dim_cliente;

CREATE POLICY "Authenticated users can delete dim_cliente"
ON public.dim_cliente
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

-- Mesma correção para propriedades
DROP POLICY IF EXISTS "Admins can delete dim_propriedade" ON public.dim_propriedade;

CREATE POLICY "Authenticated users can delete dim_propriedade"
ON public.dim_propriedade
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

-- Mesma correção para tipos de despesa
DROP POLICY IF EXISTS "Admins can delete dim_tipodespesa" ON public.dim_tipodespesa;

CREATE POLICY "Authenticated users can delete dim_tipodespesa"
ON public.dim_tipodespesa
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));