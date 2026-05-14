import { describe, it, expect, beforeEach } from "vitest";
import {
  buildHeaderSignature,
  buildLayoutHash,
  saveMappingProfile,
  findMappingProfile,
  applyProfileToMappings,
  deleteMappingProfileByKey,
} from "./mappingProfiles";

const TENANT = "tenant-1";
const ENTITY = "servicos";

beforeEach(() => {
  localStorage.clear();
});

describe("mappingProfiles — layout versioning", () => {
  it("signature is order-independent but layoutHash is order-sensitive", () => {
    const a = ["Cliente", "Receita", "Despesa"];
    const b = ["Receita", "Cliente", "Despesa"];
    expect(buildHeaderSignature(a)).toBe(buildHeaderSignature(b));
    expect(buildLayoutHash(a)).not.toBe(buildLayoutHash(b));
  });

  it("layoutHash differs when a column is added/removed", () => {
    const base = ["Cliente", "Receita", "Despesa"];
    expect(buildLayoutHash(base)).not.toBe(buildLayoutHash([...base, "Data"]));
    expect(buildLayoutHash(base)).not.toBe(buildLayoutHash(["Cliente", "Receita"]));
  });

  it("save then find with identical layout returns layoutChanged=false", () => {
    const headers = ["Cliente", "Receita", "Despesa"];
    saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers,
      mappings: { cliente: "Cliente", receita: "Receita" },
    });
    const found = findMappingProfile(TENANT, ENTITY, headers);
    expect(found).not.toBeNull();
    expect(found!.layoutChanged).toBe(false);
    expect(found!.profile.version).toBe(1);
  });

  it("find flags layoutChanged=true when columns are reordered (same set)", () => {
    const headers = ["Cliente", "Receita", "Despesa"];
    saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers,
      mappings: { cliente: "Cliente" },
    });
    const reordered = ["Receita", "Cliente", "Despesa"];
    const found = findMappingProfile(TENANT, ENTITY, reordered);
    expect(found).not.toBeNull();
    expect(found!.layoutChanged).toBe(true);
  });

  it("find returns null when the column SET changes (signature mismatch)", () => {
    const headers = ["Cliente", "Receita", "Despesa"];
    saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers,
      mappings: { cliente: "Cliente" },
    });
    const altered = ["Cliente", "Receita", "Custo"];
    expect(findMappingProfile(TENANT, ENTITY, altered)).toBeNull();
  });

  it("version increments and layoutHash refreshes on overwrite", () => {
    const headers = ["Cliente", "Receita"];
    saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers,
      mappings: { cliente: "Cliente" },
    });
    const second = saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers,
      mappings: { cliente: "Cliente", receita: "Receita" },
    });
    expect(second.version).toBe(2);
    expect(second.layoutHash).toBe(buildLayoutHash(headers));
  });

  it("tenant isolation: profiles do not leak across tenants", () => {
    const headers = ["Cliente", "Receita"];
    saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers,
      mappings: { cliente: "Cliente" },
    });
    expect(findMappingProfile("tenant-2", ENTITY, headers)).toBeNull();
  });

  it("applyProfileToMappings only applies when current headers still contain the saved mapping target", () => {
    const headers = ["Cliente", "Receita", "Despesa"];
    const profile = saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers,
      mappings: { cliente: "Cliente", receita: "Receita" },
    });
    const partial = applyProfileToMappings({}, profile, ["Cliente"]);
    expect(partial.merged).toEqual({ cliente: "Cliente" });
    expect(partial.appliedCount).toBe(1);
  });

  it("deleteMappingProfileByKey removes the entry so subsequent finds return null", () => {
    const headers = ["Cliente", "Receita"];
    saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers,
      mappings: { cliente: "Cliente" },
    });
    const sig = buildHeaderSignature(headers);
    deleteMappingProfileByKey(TENANT, ENTITY, sig);
    expect(findMappingProfile(TENANT, ENTITY, headers)).toBeNull();
  });
});
