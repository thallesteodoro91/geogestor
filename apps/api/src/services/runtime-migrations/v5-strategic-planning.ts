import type { Client } from '@libsql/client';

export const STRATEGIC_PLANNING_MIGRATION = {
  version: 5,
  name: 'strategic-planning-2026-07-30'
} as const;

export async function ensureStrategicPlanning(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS ciclos_estrategicos (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      data_inicio TEXT NOT NULL,
      data_fim TEXT NOT NULL,
      visao TEXT NOT NULL,
      status TEXT DEFAULT 'rascunho' NOT NULL,
      proxima_revisao TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS pilares_estrategicos (
      id TEXT PRIMARY KEY,
      ciclo_id TEXT NOT NULL REFERENCES ciclos_estrategicos(id) ON DELETE CASCADE,
      nome TEXT NOT NULL,
      descricao TEXT,
      ordem INTEGER DEFAULT 0 NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS objetivos_estrategicos (
      id TEXT PRIMARY KEY,
      ciclo_id TEXT NOT NULL REFERENCES ciclos_estrategicos(id) ON DELETE CASCADE,
      pilar_id TEXT NOT NULL REFERENCES pilares_estrategicos(id) ON DELETE RESTRICT,
      titulo TEXT NOT NULL,
      descricao TEXT,
      responsavel TEXT NOT NULL,
      data_limite TEXT NOT NULL,
      status TEXT DEFAULT 'nao_iniciado' NOT NULL,
      prioridade TEXT DEFAULT 'media' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS resultados_chave (
      id TEXT PRIMARY KEY,
      objetivo_id TEXT NOT NULL REFERENCES objetivos_estrategicos(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      descricao TEXT,
      linha_base REAL NOT NULL,
      meta REAL NOT NULL,
      valor_atual REAL,
      unidade TEXT NOT NULL,
      direcao TEXT DEFAULT 'aumentar' NOT NULL,
      fonte_tipo TEXT DEFAULT 'manual' NOT NULL,
      fonte_codigo TEXT,
      fonte_regra TEXT,
      fonte_periodo TEXT,
      fonte_rota TEXT,
      frequencia TEXT DEFAULT 'mensal' NOT NULL,
      ultima_atualizacao TEXT,
      confianca TEXT DEFAULT 'media' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS iniciativas_estrategicas (
      id TEXT PRIMARY KEY,
      objetivo_id TEXT NOT NULL REFERENCES objetivos_estrategicos(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      descricao TEXT,
      responsavel TEXT NOT NULL,
      data_limite TEXT NOT NULL,
      progresso REAL DEFAULT 0 NOT NULL,
      status TEXT DEFAULT 'planejada' NOT NULL,
      orcamento_centavos INTEGER,
      dependencias TEXT,
      proximo_marco TEXT,
      projeto_id TEXT REFERENCES projetos(id) ON DELETE SET NULL,
      tarefa_id TEXT REFERENCES tarefas(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS checkins_estrategicos (
      id TEXT PRIMARY KEY,
      ciclo_id TEXT NOT NULL REFERENCES ciclos_estrategicos(id) ON DELETE CASCADE,
      objetivo_id TEXT REFERENCES objetivos_estrategicos(id) ON DELETE SET NULL,
      data TEXT NOT NULL,
      status TEXT NOT NULL,
      narrativa TEXT NOT NULL,
      confianca TEXT NOT NULL,
      bloqueios TEXT,
      decisoes TEXT,
      decisoes_pendentes TEXT,
      proximos_passos TEXT,
      proxima_revisao TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS riscos_estrategicos (
      id TEXT PRIMARY KEY,
      ciclo_id TEXT NOT NULL REFERENCES ciclos_estrategicos(id) ON DELETE CASCADE,
      objetivo_id TEXT REFERENCES objetivos_estrategicos(id) ON DELETE SET NULL,
      iniciativa_id TEXT REFERENCES iniciativas_estrategicas(id) ON DELETE SET NULL,
      descricao TEXT NOT NULL,
      impacto TEXT NOT NULL,
      probabilidade TEXT NOT NULL,
      mitigacao TEXT,
      responsavel TEXT NOT NULL,
      status TEXT DEFAULT 'aberto' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_ciclos_estrategicos_status_periodo ON ciclos_estrategicos(status, data_inicio, data_fim)',
    'CREATE INDEX IF NOT EXISTS idx_pilares_estrategicos_ciclo_ordem ON pilares_estrategicos(ciclo_id, ordem)',
    'CREATE INDEX IF NOT EXISTS idx_objetivos_estrategicos_ciclo_status ON objetivos_estrategicos(ciclo_id, status, data_limite)',
    'CREATE INDEX IF NOT EXISTS idx_objetivos_estrategicos_pilar ON objetivos_estrategicos(pilar_id)',
    'CREATE INDEX IF NOT EXISTS idx_resultados_chave_objetivo ON resultados_chave(objetivo_id)',
    'CREATE INDEX IF NOT EXISTS idx_resultados_chave_fonte ON resultados_chave(fonte_tipo, fonte_codigo)',
    'CREATE INDEX IF NOT EXISTS idx_iniciativas_estrategicas_objetivo_status ON iniciativas_estrategicas(objetivo_id, status, data_limite)',
    'CREATE INDEX IF NOT EXISTS idx_iniciativas_estrategicas_projeto ON iniciativas_estrategicas(projeto_id)',
    'CREATE INDEX IF NOT EXISTS idx_iniciativas_estrategicas_tarefa ON iniciativas_estrategicas(tarefa_id)',
    'CREATE INDEX IF NOT EXISTS idx_checkins_estrategicos_ciclo_data ON checkins_estrategicos(ciclo_id, data)',
    'CREATE INDEX IF NOT EXISTS idx_checkins_estrategicos_objetivo ON checkins_estrategicos(objetivo_id)',
    'CREATE INDEX IF NOT EXISTS idx_riscos_estrategicos_ciclo_status ON riscos_estrategicos(ciclo_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_riscos_estrategicos_objetivo ON riscos_estrategicos(objetivo_id)',
    'CREATE INDEX IF NOT EXISTS idx_riscos_estrategicos_iniciativa ON riscos_estrategicos(iniciativa_id)'
  ];
  for (const statement of indexes) await client.execute(statement);
}
