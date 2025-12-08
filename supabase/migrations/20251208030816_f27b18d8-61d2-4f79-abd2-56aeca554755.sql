
-- Recriar view vw_kpis_financeiros com filtro de tenant
DROP VIEW IF EXISTS public.vw_kpis_financeiros;

CREATE OR REPLACE VIEW public.vw_kpis_financeiros
WITH (security_invoker=on) AS
SELECT 
    COALESCE(sum(o.receita_esperada), 0::numeric) AS receita_total,
    COALESCE(sum(o.receita_realizada), 0::numeric) AS receita_realizada_total,
    COALESCE(sum(o.valor_faturado), 0::numeric) AS valor_faturado_total,
    COALESCE(sum(d.valor_da_despesa), 0::numeric) AS total_despesas,
    COALESCE(sum(e.custo), 0::numeric) AS custo_total,
    COALESCE(sum(e.custos_variaveis), 0::numeric) AS custos_variaveis_total,
    COALESCE(sum(e.despesas), 0::numeric) AS despesas_fixas_total,
    COALESCE(sum(e.lucro_bruto), 0::numeric) AS lucro_bruto,
    COALESCE(sum(e.lucro_liquido), 0::numeric) AS lucro_liquido,
    CASE
        WHEN sum(o.receita_esperada) > 0 THEN sum(e.lucro_bruto) / sum(o.receita_esperada) * 100
        ELSE 0
    END AS margem_bruta_percent,
    CASE
        WHEN sum(o.receita_esperada) > 0 THEN sum(e.lucro_liquido) / sum(o.receita_esperada) * 100
        ELSE 0
    END AS margem_liquida_percent,
    CASE
        WHEN sum(o.receita_esperada) > 0 THEN (sum(o.receita_esperada) - sum(e.custos_variaveis)) / sum(o.receita_esperada) * 100
        ELSE 0
    END AS margem_contribuicao_percent,
    CASE
        WHEN (sum(o.receita_esperada) - sum(e.custos_variaveis)) > 0 THEN sum(e.despesas) / ((sum(o.receita_esperada) - sum(e.custos_variaveis)) / sum(o.receita_esperada))
        ELSE 0
    END AS ponto_equilibrio_receita,
    count(DISTINCT s.id_servico) AS total_servicos,
    count(DISTINCT CASE WHEN s.situacao_do_servico = 'Concluído' THEN s.id_servico END) AS servicos_concluidos,
    count(DISTINCT c.id_cliente) AS total_clientes,
    count(DISTINCT o.id_orcamento) AS total_orcamentos,
    CASE
        WHEN count(o.id_orcamento) > 0 THEN count(CASE WHEN o.orcamento_convertido = true THEN 1 END)::numeric / count(o.id_orcamento)::numeric * 100
        ELSE 0
    END AS taxa_conversao_percent,
    CASE
        WHEN count(DISTINCT o.id_orcamento) > 0 THEN sum(o.receita_esperada) / count(DISTINCT o.id_orcamento)
        ELSE 0
    END AS ticket_medio,
    CASE
        WHEN sum(o.receita_esperada) > 0 THEN ((sum(o.receita_realizada) - sum(o.receita_esperada)) / sum(o.receita_esperada)) * 100
        ELSE 0
    END AS desvio_orcamentario_percent
FROM dim_empresa e
LEFT JOIN fato_orcamento o ON o.tenant_id = e.tenant_id
LEFT JOIN fato_servico s ON s.tenant_id = e.tenant_id
LEFT JOIN dim_cliente c ON c.tenant_id = e.tenant_id
LEFT JOIN fato_despesas d ON d.tenant_id = e.tenant_id
WHERE e.tenant_id = get_user_tenant_id(auth.uid());

-- Recriar view vw_alertas_financeiros com filtro de tenant
DROP VIEW IF EXISTS public.vw_alertas_financeiros;

CREATE OR REPLACE VIEW public.vw_alertas_financeiros
WITH (security_invoker=on) AS
SELECT
    CASE
        WHEN avg(o.margem_esperada) < 10 AND count(*) > 0 THEN jsonb_build_object(
            'tipo', 'margem_baixa',
            'nivel', 'warning',
            'titulo', 'Margem Baixa Detectada',
            'mensagem', 'Margem esperada média abaixo de 10%. Revisar precificação.',
            'valor', round(avg(o.margem_esperada), 2),
            'icon', '⚠️',
            'sugestao', 'Revisar custos diretos e preços praticados nos orçamentos.'
        )
        ELSE NULL
    END AS alerta_margem,
    CASE
        WHEN sum(o.receita_esperada) > 0 AND (
            SELECT sum(ponto_de_equilibrio) FROM dim_empresa WHERE tenant_id = get_user_tenant_id(auth.uid())
        ) > sum(o.receita_esperada) THEN jsonb_build_object(
            'tipo', 'ponto_equilibrio',
            'nivel', 'error',
            'titulo', 'Receita Abaixo do Ponto de Equilíbrio',
            'mensagem', 'A receita atual não cobre os custos fixos.',
            'valor', round(sum(o.receita_esperada), 2),
            'icon', '⚠️',
            'sugestao', 'Aumentar volume de vendas ou reduzir custos fixos urgentemente.'
        )
        ELSE NULL
    END AS alerta_equilibrio,
    CASE
        WHEN avg(d.valor_da_despesa) > (
            SELECT avg(valor_da_despesa) * 1.2 FROM fato_despesas WHERE tenant_id = get_user_tenant_id(auth.uid())
        ) THEN jsonb_build_object(
            'tipo', 'custo_alto',
            'nivel', 'warning',
            'titulo', 'Custos Acima da Média',
            'mensagem', 'Despesas 20% acima da média histórica.',
            'valor', round(avg(d.valor_da_despesa), 2),
            'icon', '📉',
            'sugestao', 'Revisar despesas operacionais e identificar oportunidades de redução.'
        )
        ELSE NULL
    END AS alerta_custos,
    CASE
        WHEN count(o.id_orcamento) > 0 AND (
            count(CASE WHEN o.orcamento_convertido THEN 1 END)::numeric / count(o.id_orcamento)::numeric * 100
        ) < 50 THEN jsonb_build_object(
            'tipo', 'conversao_baixa',
            'nivel', 'info',
            'titulo', 'Taxa de Conversão Abaixo do Ideal',
            'mensagem', 'Taxa de conversão de orçamentos inferior a 50%.',
            'valor', round(count(CASE WHEN o.orcamento_convertido THEN 1 END)::numeric / count(o.id_orcamento)::numeric * 100, 2),
            'icon', '🎯',
            'sugestao', 'Revisar follow-up comercial e qualidade dos orçamentos enviados.'
        )
        ELSE NULL
    END AS alerta_conversao
FROM fato_orcamento o
LEFT JOIN fato_despesas d ON d.tenant_id = o.tenant_id
WHERE o.tenant_id = get_user_tenant_id(auth.uid())
  AND o.created_at >= (now() - interval '30 days');

-- Notificar PostgREST para recarregar schema
NOTIFY pgrst, 'reload schema';
