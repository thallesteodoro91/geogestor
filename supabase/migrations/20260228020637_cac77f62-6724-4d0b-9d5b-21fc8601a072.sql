
-- Função trigger: ao converter orçamento, cria serviço automaticamente
CREATE OR REPLACE FUNCTION public.auto_criar_servico_ao_converter_orcamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só executa quando orcamento_convertido muda de false/null para true
  IF NEW.orcamento_convertido = true AND (OLD.orcamento_convertido IS NULL OR OLD.orcamento_convertido = false) THEN
    -- Verifica se já não existe serviço vinculado a este orçamento
    IF NOT EXISTS (SELECT 1 FROM fato_servico WHERE id_orcamento = NEW.id_orcamento) THEN
      INSERT INTO fato_servico (
        nome_do_servico,
        id_cliente,
        id_propriedade,
        id_empresa,
        id_orcamento,
        data_do_servico_inicio,
        receita_servico,
        situacao_do_servico,
        tenant_id
      )
      SELECT
        COALESCE(
          (SELECT nome_do_servico FROM fato_servico WHERE id_servico = NEW.id_servico),
          'Serviço - ' || COALESCE(NEW.codigo_orcamento, LEFT(NEW.id_orcamento::text, 8))
        ),
        NEW.id_cliente,
        NEW.id_propriedade,
        (SELECT id_empresa FROM dim_empresa WHERE tenant_id = NEW.tenant_id LIMIT 1),
        NEW.id_orcamento,
        COALESCE(NEW.data_inicio, NEW.data_orcamento),
        COALESCE(NEW.receita_esperada, 0),
        'Pendente',
        NEW.tenant_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger na tabela fato_orcamento
CREATE TRIGGER trg_auto_criar_servico_ao_converter
  AFTER UPDATE ON public.fato_orcamento
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_criar_servico_ao_converter_orcamento();
