-- Adicionar coluna codigo_orcamento na tabela fato_orcamento
ALTER TABLE public.fato_orcamento 
ADD COLUMN codigo_orcamento text;

-- Criar índice para buscas rápidas por código
CREATE INDEX idx_fato_orcamento_codigo ON public.fato_orcamento(codigo_orcamento);

-- Criar função para gerar próximo código de orçamento baseado nas iniciais do cliente
CREATE OR REPLACE FUNCTION public.gerar_codigo_orcamento(p_cliente_nome text, p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_iniciais text;
  v_partes text[];
  v_ultimo_numero integer;
  v_novo_codigo text;
BEGIN
  -- Extrair iniciais do nome (primeira letra do primeiro nome + primeira letra do último nome)
  v_partes := string_to_array(trim(p_cliente_nome), ' ');
  
  IF array_length(v_partes, 1) >= 2 THEN
    v_iniciais := upper(left(v_partes[1], 1) || left(v_partes[array_length(v_partes, 1)], 1));
  ELSIF array_length(v_partes, 1) = 1 THEN
    v_iniciais := upper(left(v_partes[1], 2));
  ELSE
    v_iniciais := 'XX';
  END IF;
  
  -- Buscar o maior número usado para essas iniciais no tenant
  SELECT COALESCE(MAX(CAST(right(codigo_orcamento, 3) AS integer)), 0)
  INTO v_ultimo_numero
  FROM public.fato_orcamento
  WHERE tenant_id = p_tenant_id
    AND codigo_orcamento LIKE v_iniciais || '%'
    AND length(codigo_orcamento) = 5
    AND right(codigo_orcamento, 3) ~ '^\d{3}$';
  
  -- Gerar novo código
  v_novo_codigo := v_iniciais || lpad((v_ultimo_numero + 1)::text, 3, '0');
  
  RETURN v_novo_codigo;
END;
$$;