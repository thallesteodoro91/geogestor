import crypto from 'node:crypto';
import type { Client } from '@libsql/client';

export const SHARED_WORKSPACE_POLISH_MIGRATION = {
  version: 15,
  name: 'shared-workspace-polish-2026-09-05'
} as const;

const DEFAULT_MODELS = [
  { key: 'car', name: 'Cadastro Ambiental Rural — CAR', type: 'CAR', steps: ['Reunir documentos do imóvel e do proprietário', 'Conferir matrícula, CCIR e ITR', 'Delimitar área e uso do solo', 'Cadastrar ou retificar o CAR', 'Revisar e entregar o recibo do CAR'] },
  { key: 'georreferenciamento_rural', name: 'Georreferenciamento rural', type: 'Georreferenciamento', steps: ['Reunir matrícula e documentos dos confrontantes', 'Planejar o levantamento de campo', 'Executar levantamento geodésico', 'Processar e ajustar as coordenadas', 'Elaborar peças técnicas e memorial', 'Protocolar certificação no SIGEF'] },
  { key: 'levantamento_topografico', name: 'Levantamento topográfico', type: 'Topografia', steps: ['Definir escopo e sistema de referência', 'Planejar apoio e levantamento de campo', 'Executar levantamento topográfico', 'Processar e verificar os dados', 'Elaborar planta e relatório técnico', 'Realizar conferência e entrega final'] },
  { key: 'desmembramento', name: 'Desmembramento', type: 'Desmembramento', steps: ['Analisar matrícula e legislação aplicável', 'Executar levantamento do imóvel', 'Definir parcelas do desmembramento', 'Elaborar plantas e memoriais descritivos', 'Providenciar aprovações e anuências', 'Preparar documentação para registro'] },
  { key: 'generico', name: 'Projeto genérico', type: null, steps: ['Confirmar escopo e documentos necessários', 'Planejar execução do serviço', 'Executar atividades técnicas', 'Revisar resultados e pendências', 'Entregar produtos finais ao cliente'] }
] as const;

async function hasColumn(client: Client, table: string, column: string) {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((row) => row.name === column);
}

export async function ensureSharedWorkspacePolish(client: Client) {
  if (!(await hasColumn(client, 'despesas', 'subcategoria'))) {
    await client.execute('ALTER TABLE despesas ADD COLUMN subcategoria TEXT');
  }
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_despesas_active_subcategoria
    ON despesas(subcategoria COLLATE NOCASE)
    WHERE deleted_at IS NULL`);

  await client.execute(`CREATE TABLE IF NOT EXISTS checklist_modelos (
    id TEXT PRIMARY KEY,
    chave TEXT UNIQUE,
    nome TEXT NOT NULL,
    descricao TEXT,
    tipo_projeto TEXT,
    ativo INTEGER DEFAULT 1 NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS checklist_modelo_etapas (
    id TEXT PRIMARY KEY,
    modelo_id TEXT NOT NULL REFERENCES checklist_modelos(id),
    titulo TEXT NOT NULL,
    descricao TEXT,
    prioridade TEXT DEFAULT 'Média' NOT NULL,
    ordem INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS checklist_modelo_aplicacoes (
    id TEXT PRIMARY KEY,
    modelo_id TEXT NOT NULL REFERENCES checklist_modelos(id),
    projeto_id TEXT NOT NULL REFERENCES projetos(id),
    tarefas_criadas INTEGER DEFAULT 0 NOT NULL,
    tarefas_ignoradas INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`);
  await client.execute('CREATE INDEX IF NOT EXISTS idx_checklist_modelo_etapas_modelo_ordem ON checklist_modelo_etapas(modelo_id, ordem) WHERE deleted_at IS NULL');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_checklist_modelo_aplicacoes_projeto ON checklist_modelo_aplicacoes(projeto_id, created_at DESC)');

  for (const model of DEFAULT_MODELS) {
    const existing = await client.execute({ sql: 'SELECT id FROM checklist_modelos WHERE chave = ? LIMIT 1', args: [model.key] });
    const modelId = existing.rows[0]?.id ? String(existing.rows[0].id) : crypto.randomUUID();
    if (!existing.rows.length) {
      await client.execute({
        sql: 'INSERT INTO checklist_modelos (id, chave, nome, descricao, tipo_projeto, ativo) VALUES (?, ?, ?, ?, ?, 1)',
        args: [modelId, model.key, model.name, 'Modelo padrão do GeoGestor.', model.type]
      });
    }
    const stepCount = await client.execute({
      sql: 'SELECT count(*) AS total FROM checklist_modelo_etapas WHERE modelo_id = ? AND deleted_at IS NULL',
      args: [modelId]
    });
    if (Number(stepCount.rows[0]?.total || 0) > 0) continue;
    for (const [index, title] of model.steps.entries()) {
      await client.execute({
        sql: 'INSERT INTO checklist_modelo_etapas (id, modelo_id, titulo, prioridade, ordem) VALUES (?, ?, ?, ?, ?)',
        args: [crypto.randomUUID(), modelId, title, 'Média', index]
      });
    }
  }
}
