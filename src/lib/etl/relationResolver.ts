/**
 * In-memory relationship resolver.
 *
 * Given exploded rows (one per spreadsheet row, each carrying partial
 * cliente / propriedade / orcamento / servico payloads) and the current
 * known entities from the DB, produce:
 *
 *  - `clientesNovos` to insert (deduped by natural key)
 *  - `propriedadesNovas` to insert (deduped by (nome, id_cliente) or matricula)
 *  - per-row resolved FKs (`id_cliente`, `id_propriedade`) so the caller can
 *    batch the orçamento/serviço inserts in the right order.
 *
 * Order is strict: Cliente → Propriedade → Orçamento → Serviço.
 */

import type { ExplodedRow } from "./rowExploder";
import { clientNaturalKey, buildClientIndex, lookupClient } from "./clientDedup";

const normName = (s: unknown) =>
  String(s ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

export interface ExistingCliente {
  id_cliente: string;
  nome?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
  email?: string | null;
}

export interface ExistingPropriedade {
  id_propriedade: string;
  nome_da_propriedade?: string | null;
  matricula?: string | null;
  id_cliente?: string | null;
}

export interface ResolvedRow {
  rowIndex: number;
  id_cliente: string | null;
  id_propriedade: string | null;
  cliente?: Record<string, unknown>;
  propriedade?: Record<string, unknown>;
  servico?: Record<string, unknown>;
  orcamento?: Record<string, unknown>;
  financeiro?: Record<string, unknown>;
  customFieldsByEntity: ExplodedRow["customFieldsByEntity"];
}

export interface ResolveResult {
  clientesNovos: Array<Record<string, unknown> & { __tempId: string }>;
  propriedadesNovas: Array<Record<string, unknown> & { __tempId: string; __clienteRef: string }>;
  rows: ResolvedRow[];
  stats: {
    clientesNovos: number;
    clientesExistentes: number;
    propriedadesNovas: number;
    propriedadesExistentes: number;
  };
}

/** Build a propriedade lookup map: prefers matricula, falls back to (nome|cliente). */
function buildPropriedadeIndex(existing: ExistingPropriedade[]): Map<string, string> {
  const idx = new Map<string, string>();
  for (const p of existing) {
    const mat = String(p.matricula ?? "").trim();
    if (mat) idx.set(`m:${mat}`, p.id_propriedade);
    const nome = normName(p.nome_da_propriedade);
    const cli = p.id_cliente ?? "";
    if (nome) idx.set(`np:${nome}|${cli}`, p.id_propriedade);
  }
  return idx;
}

export function resolveRelations(
  exploded: ExplodedRow[],
  existingClientes: ExistingCliente[],
  existingPropriedades: ExistingPropriedade[],
): ResolveResult {
  const clienteIndex = buildClientIndex(existingClientes);
  const propIndex = buildPropriedadeIndex(existingPropriedades);

  // tempId per dedup key so multiple rows referencing the same new entity reuse it
  const newClientesByKey = new Map<string, { __tempId: string } & Record<string, unknown>>();
  const newPropsByKey = new Map<string, { __tempId: string; __clienteRef: string } & Record<string, unknown>>();

  const rows: ResolvedRow[] = exploded.map((r, rowIndex) => {
    let id_cliente: string | null = null;
    let clienteRef = ""; // existing id or temp id, used to scope propriedade

    if (r.cliente && Object.keys(r.cliente).length) {
      const key = clientNaturalKey(r.cliente);
      const existingId = lookupClient(clienteIndex, r.cliente);
      if (existingId) {
        id_cliente = existingId;
        clienteRef = existingId;
      } else if (key) {
        let entry = newClientesByKey.get(key);
        if (!entry) {
          entry = { __tempId: `tmp_cli_${newClientesByKey.size}`, ...r.cliente };
          newClientesByKey.set(key, entry);
        }
        clienteRef = entry.__tempId;
      }
    }

    let id_propriedade: string | null = null;
    if (r.propriedade && Object.keys(r.propriedade).length) {
      const matricula = String(r.propriedade.matricula ?? "").trim();
      const nome = normName(r.propriedade.nome);
      const matKey = matricula ? `m:${matricula}` : "";
      const npKey = nome ? `np:${nome}|${clienteRef}` : "";

      const existing = (matKey && propIndex.get(matKey)) || (npKey && propIndex.get(npKey)) || null;
      if (existing) {
        id_propriedade = existing;
      } else {
        const dedupKey = matKey || npKey;
        if (dedupKey) {
          let entry = newPropsByKey.get(dedupKey);
          if (!entry) {
            entry = {
              __tempId: `tmp_prop_${newPropsByKey.size}`,
              __clienteRef: clienteRef,
              ...r.propriedade,
            };
            newPropsByKey.set(dedupKey, entry);
          }
        }
      }
    }

    return {
      rowIndex,
      id_cliente,
      id_propriedade,
      cliente: r.cliente,
      propriedade: r.propriedade,
      servico: r.servico,
      orcamento: r.orcamento,
      financeiro: r.financeiro,
      customFieldsByEntity: r.customFieldsByEntity,
    };
  });

  const clientesExistentes = rows.filter(r => r.id_cliente).length;
  const propriedadesExistentes = rows.filter(r => r.id_propriedade).length;

  return {
    clientesNovos: Array.from(newClientesByKey.values()),
    propriedadesNovas: Array.from(newPropsByKey.values()),
    rows,
    stats: {
      clientesNovos: newClientesByKey.size,
      clientesExistentes,
      propriedadesNovas: newPropsByKey.size,
      propriedadesExistentes,
    },
  };
}
