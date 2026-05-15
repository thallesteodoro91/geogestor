/**
 * Integration test for the stale-profile banner action in SmartImporter.
 *
 * Reproduces the exact handler wired to the "Aplicar mesmo assim" button
 * (SmartImporter.tsx ~L2091-2110) inside a minimal harness component so we
 * can assert end-to-end that:
 *   - clicking the button calls applyProfileToMappings against the stale profile
 *   - the resulting merged mappings are pushed into component state
 *   - the UI re-renders to reflect the merged mapping
 *   - the banner disappears and the appliedProfile chip appears
 *
 * Mounting the full <SmartImporter /> requires mocking Supabase, React Query,
 * Tenant context, navigation, papaparse and xlsx. The handler under test is
 * pure presentation glue, so the harness mirrors it 1:1.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  saveMappingProfile,
  findMappingProfile,
  applyProfileToMappings,
  type MappingProfile,
} from "@/lib/etl/mappingProfiles";
import * as profilesModule from "@/lib/etl/mappingProfiles";

const TENANT = "tenant-banner-1";
const ENTITY = "servicos";

function Harness({
  headers,
  autoMap = { nome_do_servico: "Cliente" },
}: { headers: string[]; autoMap?: Record<string, string> }) {
  const initial = findMappingProfile(TENANT, ENTITY, headers);
  const [mappings, setMappings] = useState<Record<string, string>>(autoMap);
  const [staleProfile, setStaleProfile] = useState<{ profile: MappingProfile } | null>(
    initial?.layoutChanged ? { profile: initial.profile } : null,
  );
  const [appliedProfile, setAppliedProfile] = useState<{
    count: number; version: number;
  } | null>(null);

  return (
    <div>
      {staleProfile && (
        <div data-testid="stale-banner">
          <span>Estrutura da planilha mudou · esquema v{staleProfile.profile.version} não aplicado</span>
          <button
            onClick={() => {
              const prof = staleProfile.profile;
              setMappings(prev => {
                const { merged, appliedCount } = applyProfileToMappings(prev, prof, headers);
                setAppliedProfile({ count: appliedCount, version: prof.version });
                return merged;
              });
              setStaleProfile(null);
            }}
          >
            Aplicar mesmo assim
          </button>
        </div>
      )}
      {appliedProfile && (
        <div data-testid="applied-chip">
          Esquema v{appliedProfile.version} aplicado ({appliedProfile.count} campos)
        </div>
      )}
      <ul data-testid="mappings">
        {Object.entries(mappings).map(([field, header]) => (
          <li key={field} data-testid={`map-${field}`}>{field} → {header}</li>
        ))}
      </ul>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("SmartImporter stale-profile banner — 'Aplicar mesmo assim'", () => {
  it("calls applyProfileToMappings and updates the UI with the merged mapping", () => {
    // Save a profile with the original layout
    const original = ["Cliente", "Receita", "Despesa"];
    saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: original,
      mappings: {
        nome_do_servico: "Cliente",
        receita_servico: "Receita",
        custo_servico: "Despesa",
      },
    });

    // Spy on the merge function to assert it was called from the click handler
    const spy = vi.spyOn(profilesModule, "applyProfileToMappings");

    // Re-import with reordered columns → drift detected → banner visible
    const reordered = ["Receita", "Cliente", "Despesa"];
    render(<Harness headers={reordered} />);

    // Banner is rendered, applied chip is not, mappings show only the auto entry
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("applied-chip")).toBeNull();
    expect(screen.getByTestId("map-nome_do_servico")).toHaveTextContent("nome_do_servico → Cliente");
    expect(screen.queryByTestId("map-receita_servico")).toBeNull();
    expect(screen.queryByTestId("map-custo_servico")).toBeNull();

    // Act — user clicks "Aplicar mesmo assim"
    fireEvent.click(screen.getByRole("button", { name: /aplicar mesmo assim/i }));

    // applyProfileToMappings was invoked with (currentMappings, staleProfile, currentHeaders)
    expect(spy).toHaveBeenCalledTimes(1);
    const [callMappings, callProfile, callHeaders] = spy.mock.calls[0];
    expect(callMappings).toEqual({ nome_do_servico: "Cliente" });
    expect(callProfile.version).toBe(1);
    expect(callProfile.mappings).toMatchObject({
      nome_do_servico: "Cliente",
      receita_servico: "Receita",
      custo_servico: "Despesa",
    });
    expect(callHeaders).toEqual(reordered);

    // UI updated — banner gone, applied chip visible, merged mapping rendered
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.getByTestId("applied-chip")).toHaveTextContent(/Esquema v1 aplicado \(2 campos\)/);
    expect(screen.getByTestId("map-nome_do_servico")).toHaveTextContent("nome_do_servico → Cliente");
    expect(screen.getByTestId("map-receita_servico")).toHaveTextContent("receita_servico → Receita");
    expect(screen.getByTestId("map-custo_servico")).toHaveTextContent("custo_servico → Despesa");
  });
});
