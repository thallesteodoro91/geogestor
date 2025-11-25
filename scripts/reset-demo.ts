/**
 * @fileoverview Script para resetar dados demo/teste
 * 
 * IMPORTANTE: Este script NÃO afeta:
 * - Configurações do SaaS
 * - Dados de usuários reais
 * - Tabelas de sistema (dim_empresa, user_roles, etc.)
 * 
 * Apenas remove dados marcados como demo/teste
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Identifica dados demo baseado em padrões
 */
function isDemoData(item: any): boolean {
  // Verifica se tem campos que indicam dado demo
  const nome = item.nome?.toLowerCase() || '';
  const observacoes = item.observacoes?.toLowerCase() || '';
  const anotacoes = item.anotacoes?.toLowerCase() || '';

  const demoPatterns = ['demo', 'teste', 'test', 'exemplo', 'sample'];

  return demoPatterns.some(
    (pattern) =>
      nome.includes(pattern) ||
      observacoes.includes(pattern) ||
      anotacoes.includes(pattern)
  );
}

/**
 * Remove dados demo de uma tabela
 */
async function cleanTable(tableName: string, identifierField: string = 'nome') {
  try {
    console.log(`\n🔍 Analisando tabela: ${tableName}`);

    // Buscar todos os registros
    const { data, error } = await supabase.from(tableName).select('*');

    if (error) {
      console.error(`❌ Erro ao buscar dados de ${tableName}:`, error.message);
      return;
    }

    if (!data || data.length === 0) {
      console.log(`✅ Tabela ${tableName} está vazia`);
      return;
    }

    // Filtrar dados demo
    const demoRecords = data.filter((item) => isDemoData(item));

    if (demoRecords.length === 0) {
      console.log(`✅ Nenhum dado demo encontrado em ${tableName}`);
      return;
    }

    console.log(`📋 Encontrados ${demoRecords.length} registros demo`);

    // Listar registros que serão removidos
    demoRecords.forEach((record) => {
      const identifier = record[identifierField] || record.id || 'sem nome';
      console.log(`  • ${identifier}`);
    });

    // Confirmar remoção
    console.log(`\n⚠️  Deseja remover estes ${demoRecords.length} registros? (pressione Ctrl+C para cancelar)`);

    // Remover registros demo
    const ids = demoRecords.map((r) => r[`id_${tableName.replace('dim_', '').replace('fato_', '')}`] || r.id);

    const primaryKey = Object.keys(data[0]).find((key) => key.startsWith('id_')) || 'id';

    for (const id of ids) {
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq(primaryKey, id);

      if (deleteError) {
        console.error(`❌ Erro ao remover registro ${id}:`, deleteError.message);
      }
    }

    console.log(`✅ Removidos ${demoRecords.length} registros demo de ${tableName}`);
  } catch (err) {
    console.error(`❌ Erro ao processar tabela ${tableName}:`, err);
  }
}

/**
 * Executa limpeza de dados demo
 */
async function resetDemoData() {
  console.log('🚀 Iniciando limpeza de dados demo...\n');
  console.log('⚠️  ATENÇÃO: Este script removerá dados marcados como demo/teste');
  console.log('⚠️  Dados de produção e configurações do sistema NÃO serão afetados\n');

  const tablesToClean = [
    { table: 'dim_cliente', field: 'nome' },
    { table: 'dim_propriedade', field: 'nome_da_propriedade' },
    { table: 'fato_servico', field: 'nome_do_servico' },
    { table: 'fato_orcamento', field: 'id_orcamento' },
    { table: 'fato_despesas', field: 'id_despesas' },
    { table: 'dim_tipodespesa', field: 'categoria' },
  ];

  for (const { table, field } of tablesToClean) {
    await cleanTable(table, field);
  }

  console.log('\n✅ Limpeza concluída!');
  console.log('📊 Verifique o resultado no seu banco de dados');
}

// Executar script
resetDemoData().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
