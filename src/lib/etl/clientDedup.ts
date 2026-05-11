/**
 * Client deduplication using natural keys.
 * Order of preference: CPF → CNPJ → (normalized name + telefone) → normalized name.
 */

const norm = (s: unknown) =>
  String(s ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

export interface ClientKeyInput {
  nome?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
  celular?: string | null;
  email?: string | null;
}

/** Returns a stable natural key for dedup. Empty string → no key (skip). */
export function clientNaturalKey(c: ClientKeyInput): string {
  const cpf = digits(c.cpf);
  if (cpf.length === 11) return `cpf:${cpf}`;
  const cnpj = digits(c.cnpj);
  if (cnpj.length === 14) return `cnpj:${cnpj}`;
  const email = norm(c.email);
  if (email && email.includes("@")) return `email:${email}`;
  const nome = norm(c.nome);
  if (!nome) return "";
  const tel = digits(c.telefone) || digits(c.celular);
  return tel ? `nt:${nome}|${tel}` : `n:${nome}`;
}

/** Build a lookup map of existing clients by natural key. */
export function buildClientIndex(
  existing: Array<{ id_cliente: string; nome?: string | null; cpf?: string | null; cnpj?: string | null; telefone?: string | null; email?: string | null }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of existing) {
    const key = clientNaturalKey(c);
    if (key && !map.has(key)) map.set(key, c.id_cliente);
    // Also index by name-only for backwards compatibility
    const nameOnly = `n:${norm(c.nome)}`;
    if (norm(c.nome) && !map.has(nameOnly)) map.set(nameOnly, c.id_cliente);
  }
  return map;
}

export function lookupClient(index: Map<string, string>, c: ClientKeyInput): string | null {
  const key = clientNaturalKey(c);
  if (key && index.has(key)) return index.get(key)!;
  // Fallback: name-only
  const nome = norm(c.nome);
  if (nome) {
    const id = index.get(`n:${nome}`);
    if (id) return id;
  }
  return null;
}
