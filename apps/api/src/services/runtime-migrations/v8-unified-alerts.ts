import type { Client } from '@libsql/client';

export const UNIFIED_ALERTS_MIGRATION = {
  version: 8,
  name: 'unified-deadline-alerts-2026-08-01'
} as const;

export async function ensureUnifiedAlerts(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS alerta_configuracao (
      id TEXT PRIMARY KEY,
      habilitado INTEGER DEFAULT 1 NOT NULL,
      notificacao_nativa INTEGER DEFAULT 1 NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS alerta_categoria_configuracao (
      categoria TEXT PRIMARY KEY,
      habilitado INTEGER DEFAULT 1 NOT NULL,
      dias_antecedencia INTEGER DEFAULT 7 NOT NULL CHECK (dias_antecedencia BETWEEN 0 AND 365),
      recorrencia TEXT DEFAULT 'daily' NOT NULL CHECK (recorrencia IN ('daily', 'interval', 'once')),
      intervalo_dias INTEGER DEFAULT 1 NOT NULL CHECK (intervalo_dias BETWEEN 1 AND 90),
      alertar_no_vencimento INTEGER DEFAULT 1 NOT NULL,
      manter_vencidos INTEGER DEFAULT 1 NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS alerta_ocorrencias (
      id TEXT PRIMARY KEY,
      chave_ocorrencia TEXT NOT NULL UNIQUE,
      categoria TEXT NOT NULL,
      origem_id TEXT NOT NULL,
      data_vencimento TEXT NOT NULL,
      ciclo TEXT NOT NULL,
      lida_em TEXT,
      ocultada_em TEXT,
      notificada_nativamente_em TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute('CREATE INDEX IF NOT EXISTS idx_alerta_categoria_habilitado ON alerta_categoria_configuracao(habilitado, categoria)');
  await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS uq_alerta_ocorrencias_chave ON alerta_ocorrencias(chave_ocorrencia)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_alerta_ocorrencias_origem ON alerta_ocorrencias(categoria, origem_id, data_vencimento)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_alerta_ocorrencias_estado ON alerta_ocorrencias(ocultada_em, lida_em, created_at)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_projetos_alerta_prazo ON projetos(data_entrega, status) WHERE deleted_at IS NULL');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_clientes_alerta_servico ON clientes(previsao_entrega, situacao) WHERE deleted_at IS NULL');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_tarefas_alerta_prazo ON tarefas(data_limite, status) WHERE deleted_at IS NULL');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_parcelas_alerta_prazo ON parcelas(data_vencimento, status_pagamento) WHERE deleted_at IS NULL AND cancelada_em IS NULL');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_despesas_alerta_prazo ON despesas(data, status) WHERE deleted_at IS NULL AND cancelada_em IS NULL AND estornada_em IS NULL');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_orcamentos_alerta_validade ON orcamentos(validade_ate, status) WHERE deleted_at IS NULL');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_compromissos_alerta_data ON compromissos(data) WHERE deleted_at IS NULL');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_oportunidades_alerta_acao ON oportunidades(proxima_acao_em, estagio) WHERE deleted_at IS NULL');
}
