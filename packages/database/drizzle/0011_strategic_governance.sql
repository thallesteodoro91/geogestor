ALTER TABLE objetivos_estrategicos ADD COLUMN ordem INTEGER DEFAULT 0 NOT NULL;

CREATE INDEX IF NOT EXISTS idx_objetivos_estrategicos_pilar_ordem
  ON objetivos_estrategicos(pilar_id, ordem);

CREATE TABLE IF NOT EXISTS decisoes_estrategicas (
  id TEXT PRIMARY KEY,
  ciclo_id TEXT NOT NULL REFERENCES ciclos_estrategicos(id) ON DELETE CASCADE,
  checkin_id TEXT REFERENCES checkins_estrategicos(id) ON DELETE SET NULL,
  objetivo_id TEXT REFERENCES objetivos_estrategicos(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  prazo TEXT NOT NULL,
  status TEXT DEFAULT 'pendente' NOT NULL,
  concluida_em TEXT,
  observacao_encerramento TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_decisoes_estrategicas_ciclo_status_prazo
  ON decisoes_estrategicas(ciclo_id, status, prazo);
CREATE INDEX IF NOT EXISTS idx_decisoes_estrategicas_checkin
  ON decisoes_estrategicas(checkin_id);
CREATE INDEX IF NOT EXISTS idx_decisoes_estrategicas_objetivo
  ON decisoes_estrategicas(objetivo_id);

CREATE TABLE IF NOT EXISTS snapshots_estrategicos (
  id TEXT PRIMARY KEY,
  ciclo_id TEXT NOT NULL REFERENCES ciclos_estrategicos(id) ON DELETE CASCADE,
  checkin_id TEXT NOT NULL REFERENCES checkins_estrategicos(id) ON DELETE CASCADE,
  capturado_em TEXT NOT NULL,
  progresso_geral REAL,
  objetivos_json TEXT NOT NULL,
  riscos_json TEXT NOT NULL,
  iniciativas_json TEXT NOT NULL,
  decisoes_json TEXT NOT NULL,
  dados_desatualizados INTEGER DEFAULT 0 NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_snapshots_estrategicos_ciclo_captura
  ON snapshots_estrategicos(ciclo_id, capturado_em);
CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_estrategicos_checkin_unique
  ON snapshots_estrategicos(checkin_id);

INSERT INTO decisoes_estrategicas (
  id, ciclo_id, checkin_id, objetivo_id, descricao, responsavel, prazo,
  status, concluida_em, observacao_encerramento, created_at, updated_at
)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
    lower(hex(randomblob(6))),
  checkin.ciclo_id,
  checkin.id,
  checkin.objetivo_id,
  trim(checkin.decisoes_pendentes),
  'Responsável não definido',
  coalesce(checkin.proxima_revisao, ciclo.proxima_revisao, checkin.data),
  'pendente',
  NULL,
  'Decisão migrada do campo textual de uma revisão anterior.',
  checkin.created_at,
  checkin.updated_at
FROM checkins_estrategicos checkin
JOIN ciclos_estrategicos ciclo ON ciclo.id = checkin.ciclo_id
WHERE checkin.deleted_at IS NULL
  AND trim(coalesce(checkin.decisoes_pendentes, '')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM decisoes_estrategicas decisao WHERE decisao.checkin_id = checkin.id
  );
