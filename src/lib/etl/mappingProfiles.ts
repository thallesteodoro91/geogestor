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
  /** Strict, order-sensitive hash of the column layout. Differs from `signature`
   *  whenever columns are added/removed/reordered/renamed — used to detect
   *  structural drift even when the column SET still matches. */
  layoutHash: string;
  /** Bumped on every save to track profile evolution. */
  version: number;
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

/** Order-independent signature of the spreadsheet column SET (used as the key). */
export function buildHeaderSignature(headers: string[]): string {
  const tokens = Array.from(new Set(headers.map(norm).filter(Boolean))).sort();
  return tokens.join("|");
}

/** djb2 string hash → base36 */
function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Order-sensitive hash of the exact column layout (headers in order + count). */
export function buildLayoutHash(headers: string[]): string {
  const normalized = headers.map(norm);
  return `${headers.length}:${djb2(normalized.join("\u0001"))}`;
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

export interface FindProfileResult {
  profile: MappingProfile;
  /** True when the saved profile's layoutHash differs from the current spreadsheet's. */
  layoutChanged: boolean;
  currentLayoutHash: string;
}

/**
 * Looks up a profile by (tenant, entity, signature). The signature matches
 * order-independently — but the returned `layoutChanged` flag tells the caller
 * whether the strict layout (order/count) drifted, so they can decide NOT to
 * silently reapply the saved mapping.
 */
export function findMappingProfile(
  tenantId: string | null,
  entity: string,
  headers: string[],
): FindProfileResult | null {
  const signature = buildHeaderSignature(headers);
  const currentLayoutHash = buildLayoutHash(headers);
  const target = keyOf({ tenantId, entity, signature });
  const profile = readAll().find(p => keyOf(p) === target);
  if (!profile) return null;
  return {
    profile,
    currentLayoutHash,
    layoutChanged: profile.layoutHash !== currentLayoutHash,
  };
}

export function saveMappingProfile(input: {
  tenantId: string | null;
  entity: string;
  headers: string[];
  mappings: Record<string, string>;
  fileName?: string;
}): MappingProfile {
  const signature = buildHeaderSignature(input.headers);
  const layoutHash = buildLayoutHash(input.headers);
  const cleanedMappings = Object.fromEntries(
    Object.entries(input.mappings).filter(([, v]) => v && v.length > 0)
  );
  // Bump version when overwriting an existing entry for the same key
  const existing = readAll().find(p => keyOf(p) === keyOf({
    tenantId: input.tenantId, entity: input.entity, signature,
  }));
  const nextVersion = (existing?.version ?? 0) + 1;
  const profile: MappingProfile = {
    signature,
    layoutHash,
    version: nextVersion,
    entity: input.entity,
    tenantId: input.tenantId,
    headers: input.headers,
    mappings: cleanedMappings,
    fileName: input.fileName ?? existing?.fileName,
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

/** Delete by composite key (tenantId, entity, signature) — used by management UI. */
export function deleteMappingProfileByKey(
  tenantId: string | null,
  entity: string,
  signature: string,
): void {
  const target = keyOf({ tenantId, entity, signature });
  writeAll(readAll().filter(p => keyOf(p) !== target));
}

/** List all mapping profiles for a given tenant (or all if tenantId is null). */
export function listMappingProfiles(tenantId: string | null): MappingProfile[] {
  const all = readAll();
  if (tenantId === null) return all;
  return all.filter(p => p.tenantId === tenantId);
}

/** Rename a profile's fileName label. Returns true if updated. */
export function renameMappingProfile(
  tenantId: string | null,
  entity: string,
  signature: string,
  newName: string,
): boolean {
  const all = readAll();
  const target = keyOf({ tenantId, entity, signature });
  const idx = all.findIndex(p => keyOf(p) === target);
  if (idx === -1) return false;
  all[idx] = { ...all[idx], fileName: newName.trim() || undefined, updatedAt: new Date().toISOString() };
  writeAll(all);
  return true;
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
