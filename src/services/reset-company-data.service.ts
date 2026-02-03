/**
 * @fileoverview Serviço para exclusão de todos os dados operacionais da empresa
 * Permite zerar o sistema para nova importação de informações
 */

import { supabase } from '@/integrations/supabase/client';

export interface DeleteResult {
  tabela: string;
  registrosExcluidos: number;
}

export interface DeleteAllDataResult {
  success: boolean;
  totalExcluido: number;
  detalhes: DeleteResult[];
  error?: string;
}

/**
 * Exclui todos os dados operacionais de uma empresa
 * Mantém: empresa, tipos de serviço/despesa, categorias, tenant, members, subscription
 * 
 * @param tenantId - ID do tenant cujos dados serão excluídos
 * @returns Resultado da exclusão com contagem de registros removidos
 */
export async function deleteAllCompanyData(tenantId: string): Promise<DeleteAllDataResult> {
  const detalhes: DeleteResult[] = [];
  let totalExcluido = 0;

  // Ordem de exclusão respeitando Foreign Keys (dependentes primeiro)
  const tabelasOrdenadas = [
    // 1. Tabelas de relacionamento (primeiro)
    { nome: 'servico_anexos', colunaTenant: 'tenant_id' },
    { nome: 'servico_eventos', colunaTenant: 'tenant_id' },
    { nome: 'servico_tarefas', colunaTenant: 'tenant_id' },
    { nome: 'servico_equipes', colunaTenant: 'tenant_id' },
    { nome: 'cliente_eventos', colunaTenant: 'tenant_id' },
    { nome: 'cliente_tarefas', colunaTenant: 'tenant_id' },
    { nome: 'propriedade_geometria', colunaTenant: 'tenant_id' },
    { nome: 'fato_orcamento_itens', colunaTenant: 'tenant_id' },
    
    // 2. Tabelas de fatos (segundo)
    { nome: 'fato_despesas', colunaTenant: 'tenant_id' },
    { nome: 'fato_orcamento', colunaTenant: 'tenant_id' },
    { nome: 'fato_servico', colunaTenant: 'tenant_id' },
    
    // 3. Tabelas de dimensões (terceiro)
    { nome: 'dim_propriedade', colunaTenant: 'tenant_id' },
    { nome: 'dim_cliente', colunaTenant: 'tenant_id' },
    
    // 4. Notificações
    { nome: 'notificacoes', colunaTenant: 'tenant_id' },
  ];

  try {
    for (const tabela of tabelasOrdenadas) {
      // Primeiro, contar quantos registros serão excluídos
      const { count, error: countError } = await supabase
        .from(tabela.nome as any)
        .select('*', { count: 'exact', head: true })
        .eq(tabela.colunaTenant, tenantId);

      if (countError) {
        console.warn(`Erro ao contar registros de ${tabela.nome}:`, countError);
        // Continuar mesmo com erro de contagem
      }

      // Executar a exclusão
      const { error: deleteError } = await supabase
        .from(tabela.nome as any)
        .delete()
        .eq(tabela.colunaTenant, tenantId);

      if (deleteError) {
        console.error(`Erro ao excluir ${tabela.nome}:`, deleteError);
        throw new Error(`Falha ao excluir dados de ${tabela.nome}: ${deleteError.message}`);
      }

      const registrosExcluidos = count || 0;
      detalhes.push({
        tabela: tabela.nome,
        registrosExcluidos,
      });
      totalExcluido += registrosExcluidos;
    }

    return {
      success: true,
      totalExcluido,
      detalhes,
    };
  } catch (error) {
    return {
      success: false,
      totalExcluido,
      detalhes,
      error: error instanceof Error ? error.message : 'Erro desconhecido durante a exclusão',
    };
  }
}
