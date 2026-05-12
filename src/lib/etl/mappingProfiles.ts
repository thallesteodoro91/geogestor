/**
 * Persists manual import mapping corrections per (tenant, entity, header signature)
 * so the next import with the same spreadsheet shape reuses the same mapping.
 *
 * Stored in localStorage — no DB schema needed.
 */

const STORAGE_KEY = "geogestor.import.mappingProfiles.v1";
const MAX_PROFILES = 30;

export interface MappingProfile {
  signature: string;
  entity: string;
  tenantId: string | null;
  headers: string[];
  mappings: Record<string, string>;
  updatedAt: string;
  fileName?: string;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s\-.*]/g, "").trim();

/** Order-independent signature of the spreadsheet column set. */
export function buildHeaderSignature(headers: string[]): string {
  const tokens = Array.from(new Set(headers.map(norm).filter(Boolean))).sort();
  return tokens.join("|");
}

function readAll(): MappingProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(profiles: MappingProfile[]) {
  try {
    // keep newest first, cap size
    const trimmed = profiles
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_PROFILES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota errors
  }
}

function keyOf(p: { tenantId: string | null; entity: string; signature: string }) {
  return `${p.tenantId ?? "_"}::${p.entity}::${p.signature}`;
}

export function findMappingProfile(
  tenantId: string | null,
  entity: string,
  headers: string[],
): MappingProfile | null {
  const signature = buildHeaderSignature(headers);
  const target = keyOf({ tenantId, entity, signature });
  return readAll().find(p => keyOf(p) === target) ?? null;
}

export function saveMappingProfile(input: {
  tenantId: string | null;
  entity: string;
  headers: string[];
  mappings: Record<string, string>;
  fileName?: string;
}): MappingProfile {
  const signature = buildHeaderSignature(input.headers);
  const cleanedMappings = Object.fromEntries(
    Object.entries(input.mappings).filter(([, v]) => v && v.length > 0)
  );
  const profile: MappingProfile = {
    signature,
    entity: input.entity,
    tenantId: input.tenantId,
    headers: input.headers,
    mappings: cleanedMappings,
    fileName: input.fileName,
    updatedAt: new Date().toISOString(),
  };

  const all = readAll().filter(p => keyOf(p) !== keyOf(profile));
  all.unshift(profile);
  writeAll(all);
  return profile;
}

export function deleteMappingProfile(
  tenantId: string | null,
  entity: string,
  headers: string[],
): void {
  const signature = buildHeaderSignature(headers);
  const target = keyOf({ tenantId, entity, signature });
  writeAll(readAll().filter(p => keyOf(p) !== target));
}

/**
 * Merge a saved profile onto fresh auto-mappings. Saved entries win when the
 * mapped header still exists in the new spreadsheet.
 */
export function applyProfileToMappings(
  autoMappings: Record<string, string>,
  profile: MappingProfile,
  currentHeaders: string[],
): { merged: Record<string, string>; appliedCount: number } {
  const headerSet = new Set(currentHeaders);
  const merged: Record<string, string> = { ...autoMappings };
  let applied = 0;
  for (const [field, header] of Object.entries(profile.mappings)) {
    if (headerSet.has(header)) {
      if (merged[field] !== header) applied++;
      merged[field] = header;
    }
  }
  return { merged, appliedCount: applied };
}
