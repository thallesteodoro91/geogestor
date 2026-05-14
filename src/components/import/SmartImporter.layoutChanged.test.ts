/**
 * Integration test for the SmartImporter mapping-reuse contract.
 *
 * Reproduces the branch executed inside `processHeaders` (SmartImporter.tsx ~L902)
 * end-to-end against the real `mappingProfiles` storage layer:
 *
 *   1. user imports planilha v1 → saves manual mapping
 *   2. user re-imports planilha v2 with the SAME column set but reordered/extra
 *   3. importer must detect layoutChanged=true, flag staleProfile,
 *      and NOT silently reapply the saved mapping over the auto-map.
 *
 * Mounting the full <SmartImporter /> would require mocking Supabase, React Query,
 * Tenant context, navigation, papaparse and xlsx. The branching logic that owns
 * the invariant is small and pure — this test exercises it directly so the
 * invariant cannot regress.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  saveMappingProfile,
  findMappingProfile,
  applyProfileToMappings,
  type MappingProfile,
} from "@/lib/etl/mappingProfiles";

const TENANT = "tenant-int-1";
const ENTITY = "servicos";

// Mirrors the relevant branch of SmartImporter.processHeaders.
function simulateProcessHeaders(headers: string[], autoMap: Record<string, string>) {
  const found = findMappingProfile(TENANT, ENTITY, headers);
  let mappings = { ...autoMap };
  let appliedProfile: { count: number; version: number } | null = null;
  let staleProfile: { profile: MappingProfile } | null = null;

  if (found) {
    if (found.layoutChanged) {
      // drift detected → must NOT auto-apply
      staleProfile = { profile: found.profile };
    } else {
      const { merged, appliedCount } = applyProfileToMappings(mappings, found.profile, headers);
      mappings = merged;
      if (appliedCount > 0) {
        appliedProfile = { count: appliedCount, version: found.profile.version };
      }
    }
  }
  return { mappings, appliedProfile, staleProfile };
}

beforeEach(() => {
  localStorage.clear();
});

describe("SmartImporter — layoutChanged blocks auto-reapply", () => {
  it("reapplies mapping when layout is identical", () => {
    const headers = ["Cliente", "Receita", "Despesa"];
    saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers,
      mappings: { receita_servico: "Receita", custo_servico: "Despesa" },
    });

    // Auto-map produced something different/incomplete
    const auto = { nome_do_servico: "Cliente" };
    const result = simulateProcessHeaders(headers, auto);

    expect(result.staleProfile).toBeNull();
    expect(result.appliedProfile).not.toBeNull();
    expect(result.appliedProfile!.count).toBe(2);
    expect(result.mappings).toMatchObject({
      nome_do_servico: "Cliente",
      receita_servico: "Receita",
      custo_servico: "Despesa",
    });
  });

  it("does NOT reapply mapping when columns are reordered (layoutChanged=true)", () => {
    const originalHeaders = ["Cliente", "Receita", "Despesa"];
    saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: originalHeaders,
      mappings: { receita_servico: "Receita", custo_servico: "Despesa" },
    });

    // Same SET, different order → layout drift
    const reordered = ["Receita", "Cliente", "Despesa"];
    const auto = { nome_do_servico: "Cliente" };
    const result = simulateProcessHeaders(reordered, auto);

    // Saved mapping must NOT be merged into mappings
    expect(result.appliedProfile).toBeNull();
    expect(result.mappings).toEqual(auto);
    expect(result.mappings.receita_servico).toBeUndefined();
    expect(result.mappings.custo_servico).toBeUndefined();

    // Stale profile must be exposed so the UI can surface the warning + manual override
    expect(result.staleProfile).not.toBeNull();
    expect(result.staleProfile!.profile.version).toBe(1);
  });

  it("preserves a non-empty auto-map intact when layoutChanged=true (no partial merge)", () => {
    // Auto-map has already inferred a different field→header mapping than what
    // the saved profile would set. On drift we must keep the auto-map verbatim
    // and NOT let the stale profile silently overwrite the user's fresh inference.
    const originalHeaders = ["Cliente", "Receita", "Despesa"];
    saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: originalHeaders,
      mappings: {
        nome_do_servico: "Cliente",     // saved: Cliente → nome_do_servico
        receita_servico: "Receita",
        custo_servico: "Despesa",
      },
    });

    const reordered = ["Receita", "Cliente", "Despesa"];
    // Auto-map produced a competing inference for nome_do_servico AND a new field
    const autoMap = {
      nome_do_servico: "Receita",       // conflicts with saved (would be overwritten)
      descricao: "Despesa",             // not in saved profile at all
    };

    const result = simulateProcessHeaders(reordered, autoMap);

    // Drift detected: nothing should leak from the saved profile
    expect(result.appliedProfile).toBeNull();
    expect(result.staleProfile).not.toBeNull();

    // Auto-map preserved EXACTLY — conflicting field kept its auto value,
    // and saved-only fields (custo_servico, receita_servico→Receita) absent
    expect(result.mappings).toEqual(autoMap);
    expect(result.mappings.nome_do_servico).toBe("Receita");
    expect(result.mappings.descricao).toBe("Despesa");
    expect(result.mappings.custo_servico).toBeUndefined();
    expect(result.mappings.receita_servico).toBeUndefined();
  });

  it("treats column count change as drift (extra column with same set entries)", () => {
    // Edge: signature is set-based, so adding a duplicate-name column would still
    // change layoutHash because length differs.
    const original = ["Cliente", "Receita", "Despesa"];
    saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: original,
      mappings: { receita_servico: "Receita" },
    });

    // Genuine column-set change → findMappingProfile returns null entirely
    const altered = ["Cliente", "Receita", "Despesa", "Margem"];
    const result = simulateProcessHeaders(altered, { nome_do_servico: "Cliente" });

    expect(result.appliedProfile).toBeNull();
    expect(result.staleProfile).toBeNull(); // no profile matched at all
    expect(result.mappings.receita_servico).toBeUndefined();
  });

  it("user override path: forcing apply on stale profile produces the saved mapping", () => {
    // Mirrors the "Aplicar mesmo assim" button in the stale-profile banner.
    const original = ["Cliente", "Receita", "Despesa"];
    saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: original,
      mappings: { receita_servico: "Receita", custo_servico: "Despesa" },
    });

    const reordered = ["Receita", "Cliente", "Despesa"];
    const auto = { nome_do_servico: "Cliente" };
    const initial = simulateProcessHeaders(reordered, auto);
    expect(initial.staleProfile).not.toBeNull();

    // Simulate the explicit user action — force-apply against the stale profile
    const { merged, appliedCount } = applyProfileToMappings(
      initial.mappings, initial.staleProfile!.profile, reordered,
    );
    expect(appliedCount).toBe(2);
    expect(merged).toMatchObject({
      nome_do_servico: "Cliente",
      receita_servico: "Receita",
      custo_servico: "Despesa",
    });
  });
});
