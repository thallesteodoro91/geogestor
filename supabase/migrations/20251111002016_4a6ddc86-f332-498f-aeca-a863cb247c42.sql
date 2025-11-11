-- Criar view para alertas financeiros automáticos
CREATE OR REPLACE VIEW public.vw_alertas_financeiros
WITH (security_invoker=on)
AS
SELECT 
  -- Alerta de Margem Baixa
  CASE 
    WHEN AVG(o.margem_esperada) < 10 AND COUNT(*) > 0
    THEN jsonb_build_object(
      'tipo', 'margem_baixa',
      'nivel', 'warning',
      'titulo', 'Margem Baixa Detectada',
      'mensagem', 'Margem esperada média abaixo de 10%. Revisar precificação.',
      'valor', ROUND(AVG(o.margem_esperada), 2),
      'icon', '⚠️',
      'sugestao', 'Revisar custos diretos e preços praticados nos orçamentos.'
    )
  END as alerta_margem,
  
  -- Alerta de Receita Abaixo do Ponto de Equilíbrio
  CASE 
    WHEN SUM(o.receita_esperada) > 0 AND 
         (SELECT SUM(ponto_de_equilibrio) FROM dim_empresa) > SUM(o.receita_esperada)
    THEN jsonb_build_object(
      'tipo', 'ponto_equilibrio',
      'nivel', 'error',
      'titulo', 'Receita Abaixo do Ponto de Equilíbrio',
      'mensagem', 'A receita atual não cobre os custos fixos.',
      'valor', ROUND(SUM(o.receita_esperada), 2),
      'icon', '⚠️',
      'sugestao', 'Aumentar volume de vendas ou reduzir custos fixos urgentemente.'
    )
  END as alerta_equilibrio,
  
  -- Alerta de Custos Altos
  CASE 
    WHEN AVG(d.valor_da_despesa) > (
      SELECT AVG(valor_da_despesa) * 1.2 FROM fato_despesas
    )
    THEN jsonb_build_object(
      'tipo', 'custo_alto',
      'nivel', 'warning',
      'titulo', 'Custos Acima da Média',
      'mensagem', 'Despesas 20% acima da média histórica.',
      'valor', ROUND(AVG(d.valor_da_despesa), 2),
      'icon', '📉',
      'sugestao', 'Revisar despesas operacionais e identificar oportunidades de redução.'
    )
  END as alerta_custos,
  
  -- Alerta de Taxa de Conversão Baixa
  CASE 
    WHEN COUNT(o.id_orcamento) > 0 AND
         (COUNT(CASE WHEN o.orcamento_convertido THEN 1 END)::NUMERIC / COUNT(o.id_orcamento) * 100) < 50
    THEN jsonb_build_object(
      'tipo', 'conversao_baixa',
      'nivel', 'info',
      'titulo', 'Taxa de Conversão Abaixo do Ideal',
      'mensagem', 'Taxa de conversão de orçamentos inferior a 50%.',
      'valor', ROUND((COUNT(CASE WHEN o.orcamento_convertido THEN 1 END)::NUMERIC / COUNT(o.id_orcamento) * 100), 2),
      'icon', '🎯',
      'sugestao', 'Revisar follow-up comercial e qualidade dos orçamentos enviados.'
    )
  END as alerta_conversao

FROM fato_orcamento o
LEFT JOIN fato_despesas d ON true
WHERE o.created_at >= NOW() - INTERVAL '30 days';

-- Conceder permissões
GRANT SELECT ON public.vw_alertas_financeiros TO authenticated;