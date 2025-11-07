-- Tabela Dimensão: Clientes
CREATE TABLE public.dim_cliente (
  id_cliente UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  idade INTEGER,
  cpf TEXT,
  cnpj TEXT,
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  data_cadastro DATE DEFAULT CURRENT_DATE,
  categoria TEXT CHECK (categoria IN ('Pessoa Física', 'Pessoa Jurídica')),
  origem TEXT,
  situacao TEXT CHECK (situacao IN ('Ativo', 'Inativo', 'Pendente')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela Dimensão: Data
CREATE TABLE public.dim_data (
  id_data UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL UNIQUE,
  ano INTEGER,
  mes INTEGER,
  trimestre INTEGER,
  dia_semana TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela Dimensão: Empresa
CREATE TABLE public.dim_empresa (
  id_empresa UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  receita NUMERIC(15,2) DEFAULT 0,
  custo NUMERIC(15,2) DEFAULT 0,
  despesas NUMERIC(15,2) DEFAULT 0,
  lucro_bruto NUMERIC(15,2) GENERATED ALWAYS AS (receita - custo) STORED,
  lucro_liquido NUMERIC(15,2) GENERATED ALWAYS AS (receita - custo - despesas) STORED,
  margem_de_contribuicao NUMERIC(5,2),
  ponto_de_equilibrio NUMERIC(15,2),
  custos_variaveis NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela Dimensão: Propriedade
CREATE TABLE public.dim_propriedade (
  id_propriedade UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_da_propriedade TEXT NOT NULL,
  cidade TEXT,
  municipio TEXT,
  area_ha NUMERIC(10,2),
  tipo TEXT,
  latitude NUMERIC(10,6),
  longitude NUMERIC(10,6),
  situacao_imovel TEXT,
  tipo_de_documento TEXT,
  documentacao TEXT,
  averbacao TEXT,
  usucapiao TEXT,
  car TEXT,
  matricula TEXT,
  ccir TEXT,
  memorial_descritivo TEXT,
  itr TEXT,
  situacao TEXT,
  marco TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela Dimensão: Tipo de Despesa
CREATE TABLE public.dim_tipodespesa (
  id_tipodespesa UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela Fato: Serviços
CREATE TABLE public.fato_servico (
  id_servico UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_data UUID REFERENCES public.dim_data(id_data),
  nome_do_servico TEXT NOT NULL,
  categoria TEXT CHECK (categoria IN ('Topografia', 'Ambiental', 'Jurídico', 'Especial')),
  situacao_do_servico TEXT CHECK (situacao_do_servico IN ('Concluído', 'Em Andamento', 'Cancelado')),
  data_do_servico_inicio DATE,
  data_do_servico_fim DATE,
  id_cliente UUID REFERENCES public.dim_cliente(id_cliente),
  id_propriedade UUID REFERENCES public.dim_propriedade(id_propriedade),
  id_empresa UUID REFERENCES public.dim_empresa(id_empresa),
  numero_de_servicos_concluidos INTEGER DEFAULT 0,
  receita_servico NUMERIC(15,2) DEFAULT 0,
  custo_servico NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela Fato: Despesas
CREATE TABLE public.fato_despesas (
  id_despesas UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_data UUID REFERENCES public.dim_data(id_data),
  valor_da_despesa NUMERIC(15,2) NOT NULL,
  data_da_despesa DATE NOT NULL,
  id_servico UUID REFERENCES public.fato_servico(id_servico) ON DELETE SET NULL,
  id_tipodespesa UUID REFERENCES public.dim_tipodespesa(id_tipodespesa),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela Fato: Orçamento
CREATE TABLE public.fato_orcamento (
  id_orcamento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_data UUID REFERENCES public.dim_data(id_data),
  id_cliente UUID REFERENCES public.dim_cliente(id_cliente),
  id_servico UUID REFERENCES public.fato_servico(id_servico),
  data_orcamento DATE NOT NULL,
  valor_unitario NUMERIC(15,2) NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  desconto NUMERIC(15,2) DEFAULT 0,
  valor_imposto NUMERIC(15,2),
  receita_esperada NUMERIC(15,2),
  lucro_esperado NUMERIC(15,2),
  margem_esperada NUMERIC(5,2),
  receita_esperada_imposto NUMERIC(15,2),
  receita_realizada NUMERIC(15,2),
  orcamento_convertido BOOLEAN DEFAULT FALSE,
  data_do_faturamento DATE,
  valor_faturado NUMERIC(15,2),
  situacao_do_pagamento TEXT CHECK (situacao_do_pagamento IN ('Pendente', 'Pago', 'Atrasado', 'Cancelado')),
  forma_de_pagamento TEXT,
  faturamento BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dim_cliente_updated_at BEFORE UPDATE ON public.dim_cliente
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dim_empresa_updated_at BEFORE UPDATE ON public.dim_empresa
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dim_propriedade_updated_at BEFORE UPDATE ON public.dim_propriedade
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dim_tipodespesa_updated_at BEFORE UPDATE ON public.dim_tipodespesa
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fato_servico_updated_at BEFORE UPDATE ON public.fato_servico
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fato_despesas_updated_at BEFORE UPDATE ON public.fato_despesas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fato_orcamento_updated_at BEFORE UPDATE ON public.fato_orcamento
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Popular dim_data com datas
INSERT INTO public.dim_data (data, ano, mes, trimestre, dia_semana)
SELECT 
  date_series,
  EXTRACT(YEAR FROM date_series)::INTEGER,
  EXTRACT(MONTH FROM date_series)::INTEGER,
  CEIL(EXTRACT(MONTH FROM date_series) / 3.0)::INTEGER,
  TO_CHAR(date_series, 'Day')
FROM generate_series('2020-01-01'::date, '2030-12-31'::date, '1 day'::interval) AS date_series;

-- Popular dim_tipodespesa com categorias comuns
INSERT INTO public.dim_tipodespesa (categoria, subcategoria, descricao) VALUES
  ('Operacional', 'Combustível', 'Despesas com combustível de veículos'),
  ('Operacional', 'Manutenção', 'Manutenção de equipamentos'),
  ('Operacional', 'Aluguel', 'Aluguel de equipamentos'),
  ('Pessoal', 'Salários', 'Salários de funcionários'),
  ('Pessoal', 'Encargos', 'Encargos trabalhistas'),
  ('Pessoal', 'Vale Transporte', 'Vale transporte funcionários'),
  ('Pessoal', 'Vale Alimentação', 'Vale alimentação funcionários'),
  ('Administrativo', 'Material de Escritório', 'Material de escritório'),
  ('Administrativo', 'Telefone', 'Telefone e internet'),
  ('Administrativo', 'Aluguel', 'Aluguel de escritório'),
  ('Tecnologia', 'Software', 'Licenças de software'),
  ('Tecnologia', 'Hardware', 'Equipamentos de informática'),
  ('Marketing', 'Publicidade', 'Publicidade e propaganda'),
  ('Marketing', 'Marketing Digital', 'Marketing digital'),
  ('Financeiro', 'Taxas Bancárias', 'Taxas bancárias'),
  ('Financeiro', 'Impostos', 'Impostos e tributos'),
  ('Logística', 'Frete', 'Frete e transporte'),
  ('Logística', 'Armazenagem', 'Armazenagem de materiais');

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.dim_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_propriedade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_tipodespesa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fato_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fato_despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fato_orcamento ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (permitir acesso autenticado por enquanto)
CREATE POLICY "Allow authenticated read dim_cliente" ON public.dim_cliente FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert dim_cliente" ON public.dim_cliente FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update dim_cliente" ON public.dim_cliente FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete dim_cliente" ON public.dim_cliente FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read dim_data" ON public.dim_data FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read dim_empresa" ON public.dim_empresa FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert dim_empresa" ON public.dim_empresa FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update dim_empresa" ON public.dim_empresa FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete dim_empresa" ON public.dim_empresa FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read dim_propriedade" ON public.dim_propriedade FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert dim_propriedade" ON public.dim_propriedade FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update dim_propriedade" ON public.dim_propriedade FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete dim_propriedade" ON public.dim_propriedade FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read dim_tipodespesa" ON public.dim_tipodespesa FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert dim_tipodespesa" ON public.dim_tipodespesa FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update dim_tipodespesa" ON public.dim_tipodespesa FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete dim_tipodespesa" ON public.dim_tipodespesa FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read fato_servico" ON public.fato_servico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert fato_servico" ON public.fato_servico FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update fato_servico" ON public.fato_servico FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete fato_servico" ON public.fato_servico FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read fato_despesas" ON public.fato_despesas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert fato_despesas" ON public.fato_despesas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update fato_despesas" ON public.fato_despesas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete fato_despesas" ON public.fato_despesas FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read fato_orcamento" ON public.fato_orcamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert fato_orcamento" ON public.fato_orcamento FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update fato_orcamento" ON public.fato_orcamento FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete fato_orcamento" ON public.fato_orcamento FOR DELETE TO authenticated USING (true);

-- Função para calcular KPIs
CREATE OR REPLACE FUNCTION calcular_kpis()
RETURNS TABLE (
  receita_total NUMERIC,
  lucro_bruto NUMERIC,
  margem_bruta NUMERIC,
  lucro_liquido NUMERIC,
  margem_liquida NUMERIC,
  total_despesas NUMERIC,
  total_servicos BIGINT,
  servicos_concluidos BIGINT,
  taxa_conversao NUMERIC,
  ticket_medio NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(e.receita), 0) as receita_total,
    COALESCE(SUM(e.lucro_bruto), 0) as lucro_bruto,
    CASE 
      WHEN SUM(e.receita) > 0 THEN (SUM(e.lucro_bruto) / SUM(e.receita) * 100)
      ELSE 0
    END as margem_bruta,
    COALESCE(SUM(e.lucro_liquido), 0) as lucro_liquido,
    CASE 
      WHEN SUM(e.receita) > 0 THEN (SUM(e.lucro_liquido) / SUM(e.receita) * 100)
      ELSE 0
    END as margem_liquida,
    COALESCE(SUM(d.valor_da_despesa), 0) as total_despesas,
    COALESCE(COUNT(DISTINCT s.id_servico), 0) as total_servicos,
    COALESCE(COUNT(DISTINCT CASE WHEN s.situacao_do_servico = 'Concluído' THEN s.id_servico END), 0) as servicos_concluidos,
    CASE 
      WHEN COUNT(o.id_orcamento) > 0 THEN (COUNT(CASE WHEN o.orcamento_convertido = true THEN 1 END)::NUMERIC / COUNT(o.id_orcamento) * 100)
      ELSE 0
    END as taxa_conversao,
    CASE 
      WHEN COUNT(s.id_servico) > 0 THEN (SUM(e.receita) / COUNT(s.id_servico))
      ELSE 0
    END as ticket_medio
  FROM public.dim_empresa e
  LEFT JOIN public.fato_despesas d ON true
  LEFT JOIN public.fato_servico s ON e.id_empresa = s.id_empresa
  LEFT JOIN public.fato_orcamento o ON true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;