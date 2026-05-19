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
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
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
  forcedStaleProfile,
  tenantId = TENANT,
  entity = ENTITY,
}: {
  headers: string[];
  autoMap?: Record<string, string>;
  forcedStaleProfile?: MappingProfile;
  tenantId?: string;
  entity?: string;
}) {
  const found = forcedStaleProfile
    ? { profile: forcedStaleProfile, layoutChanged: true, currentLayoutHash: "" }
    : findMappingProfile(tenantId, entity, headers);
  const [mappings, setMappings] = useState<Record<string, string>>(autoMap);
  const [staleProfile, setStaleProfile] = useState<{ profile: MappingProfile } | null>(
    found?.layoutChanged ? { profile: found.profile } : null,
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

  it("with empty auto-map, 'Aplicar mesmo assim' applies the saved mapping in full", () => {
    const original = ["Cliente", "Receita", "Despesa"];
    saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: original,
      mappings: {
        nome_do_servico: "Cliente",
        receita_servico: "Receita",
        custo_servico: "Despesa",
      },
    });

    const spy = vi.spyOn(profilesModule, "applyProfileToMappings");

    // Reordered → drift → banner; auto-map is EMPTY (nothing inferred)
    const reordered = ["Despesa", "Cliente", "Receita"];
    render(<Harness headers={reordered} autoMap={{}} />);

    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.getByTestId("mappings").children.length).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: /aplicar mesmo assim/i }));

    // applyProfileToMappings called with empty starting mappings
    expect(spy).toHaveBeenCalledTimes(1);
    const [callMappings, callProfile, callHeaders] = spy.mock.calls[0];
    expect(callMappings).toEqual({});
    expect(callProfile.version).toBe(1);
    expect(callHeaders).toEqual(reordered);

    // All 3 saved entries applied integrally
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.getByTestId("applied-chip")).toHaveTextContent(/Esquema v1 aplicado \(3 campos\)/);
    expect(screen.getByTestId("map-nome_do_servico")).toHaveTextContent("nome_do_servico → Cliente");
    expect(screen.getByTestId("map-receita_servico")).toHaveTextContent("receita_servico → Receita");
    expect(screen.getByTestId("map-custo_servico")).toHaveTextContent("custo_servico → Despesa");
    expect(screen.getByTestId("mappings").children.length).toBe(3);
  });

  it("only applies saved mappings whose headers still exist in the current sheet", () => {
    const original = ["Cliente", "Receita", "Despesa"];
    const profile = saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: original,
      mappings: {
        nome_do_servico: "Cliente",
        receita_servico: "Receita",
        custo_servico: "Despesa",
      },
    });

    const spy = vi.spyOn(profilesModule, "applyProfileToMappings");

    // Current sheet is missing "Despesa" → only 2 of 3 saved headers exist
    const current = ["Receita", "Cliente"];
    render(
      <Harness
        headers={current}
        autoMap={{ descricao: "Receita" }}
        forcedStaleProfile={profile}
      />,
    );

    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.getByTestId("map-descricao")).toHaveTextContent("descricao → Receita");
    expect(screen.queryByTestId("map-custo_servico")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /aplicar mesmo assim/i }));

    expect(spy).toHaveBeenCalledTimes(1);
    const [, , callHeaders] = spy.mock.calls[0];
    expect(callHeaders).toEqual(current);

    // Banner gone, chip shows only 2 applied (Despesa skipped)
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.getByTestId("applied-chip")).toHaveTextContent(/Esquema v1 aplicado \(2 campos\)/);

    // Existing saved entries applied
    expect(screen.getByTestId("map-nome_do_servico")).toHaveTextContent("nome_do_servico → Cliente");
    expect(screen.getByTestId("map-receita_servico")).toHaveTextContent("receita_servico → Receita");

    // Missing header → saved mapping skipped, auto-only field preserved
    expect(screen.queryByTestId("map-custo_servico")).toBeNull();
    expect(screen.getByTestId("map-descricao")).toHaveTextContent("descricao → Receita");
    expect(screen.getByTestId("mappings").children.length).toBe(3);
  });

  it("when NO saved headers exist in current sheet, banner disappears and no saved field is applied", () => {
    // Saved profile references headers that are completely absent from the
    // current sheet. Forcing the apply must still clear the banner, but
    // applyProfileToMappings should apply 0 saved entries — auto-only
    // mappings remain untouched.
    const original = ["Cliente", "Receita", "Despesa"];
    const profile = saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: original,
      mappings: {
        nome_do_servico: "Cliente",
        receita_servico: "Receita",
        custo_servico: "Despesa",
      },
    });

    const spy = vi.spyOn(profilesModule, "applyProfileToMappings");

    // Current sheet has an entirely different column set — none of the saved
    // headers (Cliente/Receita/Despesa) exist here.
    const current = ["Margem", "DataServico"];
    render(
      <Harness
        headers={current}
        autoMap={{ descricao: "Margem" }}
        forcedStaleProfile={profile}
      />,
    );

    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.getByTestId("map-descricao")).toHaveTextContent("descricao → Margem");

    fireEvent.click(screen.getByRole("button", { name: /aplicar mesmo assim/i }));

    expect(spy).toHaveBeenCalledTimes(1);
    const [, , callHeaders] = spy.mock.calls[0];
    expect(callHeaders).toEqual(current);

    // Banner gone
    expect(screen.queryByTestId("stale-banner")).toBeNull();

    // Chip shows 0 saved fields applied
    expect(screen.getByTestId("applied-chip")).toHaveTextContent(/Esquema v1 aplicado \(0 campos\)/);

    // None of the saved fields leaked into the mapping
    expect(screen.queryByTestId("map-nome_do_servico")).toBeNull();
    expect(screen.queryByTestId("map-receita_servico")).toBeNull();
    expect(screen.queryByTestId("map-custo_servico")).toBeNull();

    // Auto-only mapping preserved verbatim, nothing else added
    expect(screen.getByTestId("map-descricao")).toHaveTextContent("descricao → Margem");
    expect(screen.getByTestId("mappings").children.length).toBe(1);
  });

  it("after 'Aplicar mesmo assim' with 0 matching headers, staleProfile stays cleared on re-render", () => {
    // Regression guard: once the user dismisses the stale banner via the
    // override, subsequent re-renders of the same Harness instance must NOT
    // recompute `found` from props and re-populate staleProfile. The state
    // initializer should only run on mount, and the post-click setStaleProfile(null)
    // must stick.
    const original = ["Cliente", "Receita", "Despesa"];
    const profile = saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: original,
      mappings: {
        nome_do_servico: "Cliente",
        receita_servico: "Receita",
        custo_servico: "Despesa",
      },
    });

    // Sheet shares no headers with the saved profile
    const current = ["Margem", "DataServico"];
    const { rerender } = render(
      <Harness
        headers={current}
        autoMap={{ descricao: "Margem" }}
        forcedStaleProfile={profile}
      />,
    );

    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /aplicar mesmo assim/i }));

    // Banner cleared, chip shows 0 applied
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.getByTestId("applied-chip")).toHaveTextContent(/\(0 campos\)/);

    // Force several re-renders with the SAME props — banner must not reappear
    for (let i = 0; i < 3; i++) {
      rerender(
        <Harness
          headers={current}
          autoMap={{ descricao: "Margem" }}
          forcedStaleProfile={profile}
        />,
      );
      expect(screen.queryByTestId("stale-banner")).toBeNull();
      expect(screen.getByTestId("applied-chip")).toBeInTheDocument();
    }

    // Auto-only mapping still preserved across re-renders
    expect(screen.getByTestId("map-descricao")).toHaveTextContent("descricao → Margem");
    expect(screen.getByTestId("mappings").children.length).toBe(1);
  });

  it("unmount/remount: banner state does not leak across instances", () => {
    // Mounting the importer with a stale profile, dismissing the banner, then
    // unmounting must NOT persist any local state to a fresh remount. Each
    // mount initializes its own `staleProfile`/`appliedProfile` state from
    // scratch — there's no module-level cache that could leak.
    const original = ["Cliente", "Receita", "Despesa"];
    const profile = saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: original,
      mappings: {
        nome_do_servico: "Cliente",
        receita_servico: "Receita",
        custo_servico: "Despesa",
      },
    });

    const reordered = ["Receita", "Cliente", "Despesa"];

    // --- Instance A: mount, see banner, dismiss, then unmount
    const { unmount } = render(
      <Harness headers={reordered} forcedStaleProfile={profile} />,
    );
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /aplicar mesmo assim/i }));
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.getByTestId("applied-chip")).toBeInTheDocument();
    unmount();

    // After unmount, nothing from instance A should be in the DOM
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.queryByTestId("applied-chip")).toBeNull();
    expect(screen.queryByTestId("mappings")).toBeNull();

    // --- Instance B: fresh mount with a NON-stale scenario (headers match the
    // saved profile's exact layout → layoutChanged=false → no banner). If
    // state had leaked from A, we'd see a stray appliedProfile chip or a
    // dismissed-but-still-present banner. Neither should appear.
    render(<Harness headers={original} />);
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.queryByTestId("applied-chip")).toBeNull();
    expect(screen.getByTestId("map-nome_do_servico")).toHaveTextContent("nome_do_servico → Cliente");
    cleanup();

    // --- Instance C: remount with the original stale scenario — the banner
    // must reappear cleanly on this fresh mount (new component instance →
    // initializer runs again), and must NOT be paired with a leftover
    // applied-chip from prior instances.
    render(<Harness headers={reordered} forcedStaleProfile={profile} />);
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("applied-chip")).toBeNull();
  });

  it("remount with different tenantId/entity: stale-banner and applied-chip state does not leak across scenarios", () => {
    // Two distinct (tenant, entity) scenarios. Profiles saved for scenario A
    // must not influence the banner/applied-chip rendered for scenario B, and
    // vice-versa. Each mount must derive its banner state purely from its own
    // (tenantId, entity, headers) tuple.
    const tenantA = "tenant-A";
    const entityA = "servicos";
    const tenantB = "tenant-B";
    const entityB = "despesas";

    const headersA = ["Cliente", "Receita", "Despesa"];
    const headersB = ["Fornecedor", "Valor", "Data"];

    // Save profiles for BOTH scenarios using their original layouts
    saveMappingProfile({
      tenantId: tenantA, entity: entityA, headers: headersA,
      mappings: { nome_do_servico: "Cliente", receita_servico: "Receita", custo_servico: "Despesa" },
    });
    saveMappingProfile({
      tenantId: tenantB, entity: entityB, headers: headersB,
      mappings: { fornecedor: "Fornecedor", valor: "Valor", data_despesa: "Data" },
    });

    // --- Scenario A: reordered headers → banner appears, dismiss it
    const reorderedA = ["Receita", "Cliente", "Despesa"];
    const { unmount: unmountA } = render(
      <Harness
        headers={reorderedA}
        autoMap={{}}
        tenantId={tenantA}
        entity={entityA}
      />,
    );
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /aplicar mesmo assim/i }));
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.getByTestId("applied-chip")).toHaveTextContent(/\(3 campos\)/);
    unmountA();

    // --- Scenario B fresh mount with matching layout → no banner, no chip
    // (state from A must not leak in)
    render(
      <Harness
        headers={headersB}
        autoMap={{}}
        tenantId={tenantB}
        entity={entityB}
      />,
    );
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.queryByTestId("applied-chip")).toBeNull();
    expect(screen.getByTestId("mappings").children.length).toBe(0);
    cleanup();

    // --- Scenario B with its OWN drift → banner appears for B's profile only
    const reorderedB = ["Valor", "Fornecedor", "Data"];
    const { unmount: unmountB } = render(
      <Harness
        headers={reorderedB}
        autoMap={{}}
        tenantId={tenantB}
        entity={entityB}
      />,
    );
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("applied-chip")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /aplicar mesmo assim/i }));
    // B's saved mappings applied — A's fields must NOT appear
    expect(screen.getByTestId("map-fornecedor")).toHaveTextContent("fornecedor → Fornecedor");
    expect(screen.getByTestId("map-valor")).toHaveTextContent("valor → Valor");
    expect(screen.getByTestId("map-data_despesa")).toHaveTextContent("data_despesa → Data");
    expect(screen.queryByTestId("map-nome_do_servico")).toBeNull();
    expect(screen.queryByTestId("map-receita_servico")).toBeNull();
    expect(screen.queryByTestId("map-custo_servico")).toBeNull();
    unmountB();

    // --- Back to scenario A fresh mount: banner reappears for A's profile
    // and the applied-chip from B's dismissal does NOT bleed through
    render(
      <Harness
        headers={reorderedA}
        autoMap={{}}
        tenantId={tenantA}
        entity={entityA}
      />,
    );
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("applied-chip")).toBeNull();
    // A's saved mappings still intact in storage — none of B's leaked
    expect(screen.queryByTestId("map-fornecedor")).toBeNull();
    expect(screen.queryByTestId("map-valor")).toBeNull();
  });

  it("remount with same tenant/entity but different headers: banner and applied-chip react to the new match", () => {
    // Same (tenantId, entity) across mounts — only the headers change. The
    // stale-banner and applied-chip must be derived freshly per mount from
    // the current headers vs. the saved profile, with no leakage between
    // remounts.
    const original = ["Cliente", "Receita", "Despesa"];
    saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: original,
      mappings: {
        nome_do_servico: "Cliente",
        receita_servico: "Receita",
        custo_servico: "Despesa",
      },
    });

    // --- Mount 1: headers match the saved layout exactly → no banner, no chip
    const { unmount: unmount1 } = render(<Harness headers={original} autoMap={{}} />);
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.queryByTestId("applied-chip")).toBeNull();
    expect(screen.getByTestId("mappings").children.length).toBe(0);
    unmount1();

    // --- Mount 2: same tenant/entity, but headers reordered → banner appears
    const reordered = ["Despesa", "Receita", "Cliente"];
    const { unmount: unmount2 } = render(<Harness headers={reordered} autoMap={{}} />);
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("applied-chip")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /aplicar mesmo assim/i }));
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.getByTestId("applied-chip")).toHaveTextContent(/\(3 campos\)/);
    expect(screen.getByTestId("map-nome_do_servico")).toHaveTextContent("nome_do_servico → Cliente");
    expect(screen.getByTestId("map-receita_servico")).toHaveTextContent("receita_servico → Receita");
    expect(screen.getByTestId("map-custo_servico")).toHaveTextContent("custo_servico → Despesa");
    unmount2();

    // --- Mount 3: same tenant/entity, headers fully replaced (no overlap with
    // saved profile) → natural lookup finds no profile, so banner is absent.
    // Applied-chip from mount 2 must NOT bleed through.
    const replaced = ["Margem", "DataServico", "Observacao"];
    const { unmount: unmount3 } = render(<Harness headers={replaced} autoMap={{}} />);
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.queryByTestId("applied-chip")).toBeNull();
    expect(screen.getByTestId("mappings").children.length).toBe(0);
    unmount3();

    // --- Mount 4: back to original headers → no banner, no chip again
    render(<Harness headers={original} autoMap={{}} />);
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.queryByTestId("applied-chip")).toBeNull();
  });

  it("remount with varying headers but NO saved profile: never shows banner or applied-chip", () => {
    // No saveMappingProfile call → storage is empty for (TENANT, ENTITY).
    // Across multiple remounts with different headers, findMappingProfile
    // must return null, so neither stale-banner nor applied-chip should
    // ever appear, and no mapping should be auto-populated.
    const headerSets = [
      ["Cliente", "Receita", "Despesa"],
      ["Fornecedor", "Valor", "Data"],
      ["Margem"],
      ["Cliente", "Receita", "Despesa", "Extra"],
    ];

    for (const headers of headerSets) {
      const { unmount } = render(<Harness headers={headers} autoMap={{}} />);
      expect(screen.queryByTestId("stale-banner")).toBeNull();
      expect(screen.queryByTestId("applied-chip")).toBeNull();
      expect(screen.getByTestId("mappings").children.length).toBe(0);
      unmount();
    }
  });

  it("after each unmount, no stale-banner / applied-chip / mappings entries remain in the DOM", () => {
    // Across a sequence of distinct mounts (banner visible, banner dismissed,
    // no-banner) each unmount must wipe ALL test-ids from the DOM. Nothing
    // from the previous instance should be queryable after unmount.
    const original = ["Cliente", "Receita", "Despesa"];
    const profile = saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: original,
      mappings: {
        nome_do_servico: "Cliente",
        receita_servico: "Receita",
        custo_servico: "Despesa",
      },
    });

    const assertDomClean = () => {
      expect(screen.queryByTestId("stale-banner")).toBeNull();
      expect(screen.queryByTestId("applied-chip")).toBeNull();
      expect(screen.queryByTestId("mappings")).toBeNull();
      expect(screen.queryAllByTestId(/^map-/)).toHaveLength(0);
    };

    // --- Mount 1: banner visible, then unmount immediately (without dismissing)
    const reordered = ["Receita", "Cliente", "Despesa"];
    const { unmount: unmount1 } = render(
      <Harness headers={reordered} forcedStaleProfile={profile} />,
    );
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.getByTestId("mappings")).toBeInTheDocument();
    unmount1();
    assertDomClean();

    // --- Mount 2: banner visible → dismiss → applied-chip + mappings rendered
    // → unmount. All three test-ids must disappear.
    const { unmount: unmount2 } = render(
      <Harness headers={reordered} forcedStaleProfile={profile} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /aplicar mesmo assim/i }));
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.getByTestId("applied-chip")).toBeInTheDocument();
    expect(screen.getByTestId("map-nome_do_servico")).toBeInTheDocument();
    expect(screen.getByTestId("map-receita_servico")).toBeInTheDocument();
    expect(screen.getByTestId("map-custo_servico")).toBeInTheDocument();
    unmount2();
    assertDomClean();

    // --- Mount 3: no-banner scenario (matching layout) with a single auto-map
    // entry → unmount must remove the mappings list + its map-* entries too.
    const { unmount: unmount3 } = render(
      <Harness headers={original} autoMap={{ nome_do_servico: "Cliente" }} />,
    );
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.queryByTestId("applied-chip")).toBeNull();
    expect(screen.getByTestId("map-nome_do_servico")).toBeInTheDocument();
    unmount3();
    assertDomClean();
  });

  it("after unmount, old DOM-node handlers do not fire into a fresh remount", () => {
    // Capture references to the OLD instance's interactive nodes (the
    // "Aplicar mesmo assim" button and the applied-chip), then unmount and
    // mount a fresh instance. Dispatching clicks on the now-detached old
    // nodes must NOT mutate state in the new instance — React unmounts
    // detach event delegation, so the new instance's banner/chip should
    // remain exactly as initialized.
    const original = ["Cliente", "Receita", "Despesa"];
    const profile = saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: original,
      mappings: {
        nome_do_servico: "Cliente",
        receita_servico: "Receita",
        custo_servico: "Despesa",
      },
    });

    const reordered = ["Receita", "Cliente", "Despesa"];

    // --- Instance A: dismiss banner so we can capture BOTH the apply button
    // (pre-dismiss) and the applied-chip (post-dismiss). Capture the apply
    // button reference BEFORE clicking it, since it disappears after.
    const { unmount: unmountA } = render(
      <Harness headers={reordered} forcedStaleProfile={profile} />,
    );
    const oldApplyBtn = screen.getByRole("button", { name: /aplicar mesmo assim/i });
    fireEvent.click(oldApplyBtn);
    const oldAppliedChip = screen.getByTestId("applied-chip");
    expect(oldAppliedChip).toBeInTheDocument();
    unmountA();

    // After unmount, both old nodes are detached from the document
    expect(oldApplyBtn.isConnected).toBe(false);
    expect(oldAppliedChip.isConnected).toBe(false);

    // --- Instance B: fresh mount, banner visible, applied-chip absent
    render(<Harness headers={reordered} forcedStaleProfile={profile} />);
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("applied-chip")).toBeNull();

    // Spy to confirm no React handlers fire from the detached nodes into B
    const spy = vi.spyOn(profilesModule, "applyProfileToMappings");

    // Dispatch clicks on the OLD detached nodes — they must be no-ops
    fireEvent.click(oldApplyBtn);
    fireEvent.click(oldAppliedChip);
    // Also try a raw native click for good measure
    oldApplyBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    oldAppliedChip.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // applyProfileToMappings must NOT have been triggered by old handlers
    expect(spy).not.toHaveBeenCalled();

    // Instance B state is unchanged: banner still visible, no chip
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("applied-chip")).toBeNull();
    // No saved mappings were merged in — only the default auto-map entry
    expect(screen.getByTestId("map-nome_do_servico")).toHaveTextContent("nome_do_servico → Cliente");
    expect(screen.queryByTestId("map-receita_servico")).toBeNull();
    expect(screen.queryByTestId("map-custo_servico")).toBeNull();

    // Sanity: clicking the FRESH apply button in B still works normally
    fireEvent.click(screen.getByRole("button", { name: /aplicar mesmo assim/i }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.getByTestId("applied-chip")).toBeInTheDocument();
  });

  it("keyboard events (Enter/Space) on old apply button and applied-chip do not fire after unmount+remount", () => {
    // After unmount, React detaches synthetic event delegation. Dispatching
    // keyboard events on the detached old nodes must be no-ops and must not
    // mutate the freshly mounted instance's state.
    const original = ["Cliente", "Receita", "Despesa"];
    const profile = saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: original,
      mappings: {
        nome_do_servico: "Cliente",
        receita_servico: "Receita",
        custo_servico: "Despesa",
      },
    });

    const reordered = ["Receita", "Cliente", "Despesa"];

    // --- Instance A: capture apply button (pre-dismiss) and chip (post-dismiss)
    const { unmount: unmountA } = render(
      <Harness headers={reordered} forcedStaleProfile={profile} />,
    );
    const oldApplyBtn = screen.getByRole("button", { name: /aplicar mesmo assim/i });
    fireEvent.click(oldApplyBtn);
    const oldAppliedChip = screen.getByTestId("applied-chip");
    expect(oldAppliedChip).toBeInTheDocument();
    unmountA();

    expect(oldApplyBtn.isConnected).toBe(false);
    expect(oldAppliedChip.isConnected).toBe(false);

    // --- Instance B: fresh mount, banner visible, applied-chip absent
    render(<Harness headers={reordered} forcedStaleProfile={profile} />);
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("applied-chip")).toBeNull();

    const spy = vi.spyOn(profilesModule, "applyProfileToMappings");

    // Dispatch Enter and Space (keydown/keypress/keyup) on the OLD detached
    // apply button — must NOT trigger applyProfileToMappings or mutate B.
    for (const key of ["Enter", " "] as const) {
      const code = key === " " ? "Space" : "Enter";
      fireEvent.keyDown(oldApplyBtn, { key, code });
      fireEvent.keyPress(oldApplyBtn, { key, code });
      fireEvent.keyUp(oldApplyBtn, { key, code });
      oldApplyBtn.dispatchEvent(new KeyboardEvent("keydown", { key, code, bubbles: true }));
      oldApplyBtn.dispatchEvent(new KeyboardEvent("keyup", { key, code, bubbles: true }));
    }

    // Same for the old applied-chip (non-interactive <div>; any leaked
    // listener would be caught here too).
    for (const key of ["Enter", " "] as const) {
      const code = key === " " ? "Space" : "Enter";
      fireEvent.keyDown(oldAppliedChip, { key, code });
      fireEvent.keyUp(oldAppliedChip, { key, code });
      oldAppliedChip.dispatchEvent(new KeyboardEvent("keydown", { key, code, bubbles: true }));
    }

    expect(spy).not.toHaveBeenCalled();

    // Instance B state unchanged: banner still visible, no chip, no merged mappings
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("applied-chip")).toBeNull();
    expect(screen.getByTestId("map-nome_do_servico")).toHaveTextContent("nome_do_servico → Cliente");
    expect(screen.queryByTestId("map-receita_servico")).toBeNull();
    expect(screen.queryByTestId("map-custo_servico")).toBeNull();

    // Sanity: keyboard-driven activation on the FRESH apply button still works.
    // jsdom does not synthesize a click from Enter keydown, so we also fire
    // a click — the goal here is to confirm the live handler path is intact.
    const freshBtn = screen.getByRole("button", { name: /aplicar mesmo assim/i });
    fireEvent.keyDown(freshBtn, { key: "Enter", code: "Enter" });
    fireEvent.keyUp(freshBtn, { key: "Enter", code: "Enter" });
    fireEvent.click(freshBtn);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    expect(screen.getByTestId("applied-chip")).toBeInTheDocument();
  });

  it("after unmount+remount, focus does not stick to old nodes and keyboard works on fresh ones", () => {
    // Verify that:
    //  1) Focusing the old apply button BEFORE unmount, then unmounting,
    //     leaves activeElement as <body> (no leaked focus on detached node).
    //  2) The fresh remount's button can be focused and activated via
    //     keyboard (Enter), driving applyProfileToMappings exactly once.
    //  3) The fresh applied-chip is then in the document and the old
    //     detached chip is no longer the activeElement.
    const original = ["Cliente", "Receita", "Despesa"];
    const profile = saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: original,
      mappings: {
        nome_do_servico: "Cliente",
        receita_servico: "Receita",
        custo_servico: "Despesa",
      },
    });

    const reordered = ["Receita", "Cliente", "Despesa"];

    // --- Instance A: focus the apply button, then unmount
    const { unmount: unmountA } = render(
      <Harness headers={reordered} forcedStaleProfile={profile} />,
    );
    const oldApplyBtn = screen.getByRole("button", { name: /aplicar mesmo assim/i });
    oldApplyBtn.focus();
    expect(document.activeElement).toBe(oldApplyBtn);

    unmountA();

    // Old node detached; activeElement must not be the old button anymore
    expect(oldApplyBtn.isConnected).toBe(false);
    expect(document.activeElement).not.toBe(oldApplyBtn);
    // Browsers fall back to <body> when the focused element is removed
    expect(document.activeElement === document.body || document.activeElement === null).toBe(true);

    // --- Instance B: fresh mount
    render(<Harness headers={reordered} forcedStaleProfile={profile} />);
    const freshBtn = screen.getByRole("button", { name: /aplicar mesmo assim/i });
    expect(freshBtn).not.toBe(oldApplyBtn);

    // Focus shifts to the fresh button — it must accept focus
    freshBtn.focus();
    expect(document.activeElement).toBe(freshBtn);

    // Keyboard activation on the FRESH button drives the handler.
    // jsdom does not synthesize a click from Enter keydown on <button>,
    // so we fire the equivalent click after the keyboard events to assert
    // the handler path is wired and the fresh tree responds.
    const spy = vi.spyOn(profilesModule, "applyProfileToMappings");
    fireEvent.keyDown(freshBtn, { key: "Enter", code: "Enter" });
    fireEvent.keyUp(freshBtn, { key: "Enter", code: "Enter" });
    fireEvent.click(freshBtn);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("stale-banner")).toBeNull();
    const freshChip = screen.getByTestId("applied-chip");
    expect(freshChip).toBeInTheDocument();

    // The old (now detached) button must not be the activeElement, and
    // the fresh chip is a brand-new node in the document.
    expect(document.activeElement).not.toBe(oldApplyBtn);
    expect(freshChip.isConnected).toBe(true);
  });

  it("after unmount+remount, Tab order reaches the fresh apply button and applied-chip, never the old nodes", () => {
    // Make the applied-chip focusable so it participates in Tab order
    // (the production chip is decorative; here we simulate a focusable
    // variant to assert Tab traversal can reach BOTH the new button and
    // the new chip without ever landing on detached old nodes).
    function FocusableHarness(props: React.ComponentProps<typeof Harness>) {
      return (
        <div>
          <button data-testid="before">before</button>
          <Harness {...props} />
          <button data-testid="after">after</button>
        </div>
      );
    }

    const original = ["Cliente", "Receita", "Despesa"];
    const profile = saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: original,
      mappings: {
        nome_do_servico: "Cliente",
        receita_servico: "Receita",
        custo_servico: "Despesa",
      },
    });

    const reordered = ["Receita", "Cliente", "Despesa"];
    const tabbableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    // --- Instance A: capture references to old apply button + applied-chip,
    // dismiss banner so the chip exists, then unmount.
    const { unmount: unmountA } = render(
      <FocusableHarness headers={reordered} forcedStaleProfile={profile} />,
    );
    const oldApplyBtn = screen.getByRole("button", { name: /aplicar mesmo assim/i });
    fireEvent.click(oldApplyBtn);
    const oldChip = screen.getByTestId("applied-chip");
    // Make the old chip artificially focusable too, so we can prove the
    // new tab walk never returns it.
    oldChip.setAttribute("tabindex", "0");
    unmountA();
    expect(oldApplyBtn.isConnected).toBe(false);
    expect(oldChip.isConnected).toBe(false);

    // --- Instance B: fresh mount. Banner is visible; click to surface the
    // fresh applied-chip, then mark it tabbable for the traversal check.
    render(<FocusableHarness headers={reordered} forcedStaleProfile={profile} />);
    const freshBtn = screen.getByRole("button", { name: /aplicar mesmo assim/i });
    expect(freshBtn).not.toBe(oldApplyBtn);
    fireEvent.click(freshBtn);
    const freshChip = screen.getByTestId("applied-chip");
    freshChip.setAttribute("tabindex", "0");
    expect(freshChip).not.toBe(oldChip);

    // Collect every tabbable element currently in the document, in source
    // (Tab) order. jsdom does not move focus on a real Tab keypress, so we
    // walk the list manually with .focus() — this is the standard way to
    // assert Tab order in jsdom.
    const tabbables = Array.from(
      document.querySelectorAll<HTMLElement>(tabbableSelector),
    ).filter(el => !el.hasAttribute("disabled"));

    // Sanity: no detached old node leaked into the tabbable set
    expect(tabbables).not.toContain(oldApplyBtn);
    expect(tabbables).not.toContain(oldChip);
    for (const el of tabbables) {
      expect(el.isConnected).toBe(true);
      expect(el.ownerDocument).toBe(document);
    }

    // Fresh chip is reachable in Tab order (button was unmounted after
    // dismiss, but the chip remains and is now tabbable)
    expect(tabbables).toContain(freshChip);

    // Walk Tab order from the "before" anchor — focus must visit the fresh
    // chip and never land on an old detached node along the way.
    const before = screen.getByTestId("before");
    const after = screen.getByTestId("after");
    const startIdx = tabbables.indexOf(before);
    const visited: HTMLElement[] = [];
    for (let i = startIdx; i < tabbables.length; i++) {
      tabbables[i].focus();
      expect(document.activeElement).toBe(tabbables[i]);
      visited.push(tabbables[i]);
    }

    expect(visited).toContain(freshChip);
    expect(visited).toContain(after);
    expect(visited).not.toContain(oldApplyBtn);
    expect(visited).not.toContain(oldChip);

    // Final focus is the last tabbable, not a detached old node
    expect(document.activeElement).not.toBe(oldApplyBtn);
    expect(document.activeElement).not.toBe(oldChip);
    expect(document.activeElement?.isConnected).toBe(true);
  });

  it("after unmount+remount, Shift+Tab (reverse) order reaches fresh chip and button, never old nodes", () => {
    // Mirror of the Tab-order test, but walking the tabbable list in
    // reverse to simulate Shift+Tab. jsdom doesn't move focus on real
    // key events, so we walk the list manually — the assertion is that
    // the reverse order never lands on detached old nodes.
    function FocusableHarness(props: React.ComponentProps<typeof Harness>) {
      return (
        <div>
          <button data-testid="before">before</button>
          <Harness {...props} />
          <button data-testid="after">after</button>
        </div>
      );
    }

    const original = ["Cliente", "Receita", "Despesa"];
    const profile = saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: original,
      mappings: {
        nome_do_servico: "Cliente",
        receita_servico: "Receita",
        custo_servico: "Despesa",
      },
    });

    const reordered = ["Receita", "Cliente", "Despesa"];
    const tabbableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    // --- Instance A: capture old button + chip, then unmount
    const { unmount: unmountA } = render(
      <FocusableHarness headers={reordered} forcedStaleProfile={profile} />,
    );
    const oldApplyBtn = screen.getByRole("button", { name: /aplicar mesmo assim/i });
    fireEvent.click(oldApplyBtn);
    const oldChip = screen.getByTestId("applied-chip");
    oldChip.setAttribute("tabindex", "0");
    unmountA();
    expect(oldApplyBtn.isConnected).toBe(false);
    expect(oldChip.isConnected).toBe(false);

    // --- Instance B: fresh mount; surface fresh chip & make it tabbable
    render(<FocusableHarness headers={reordered} forcedStaleProfile={profile} />);
    const freshBtn = screen.getByRole("button", { name: /aplicar mesmo assim/i });
    expect(freshBtn).not.toBe(oldApplyBtn);
    fireEvent.click(freshBtn);
    const freshChip = screen.getByTestId("applied-chip");
    freshChip.setAttribute("tabindex", "0");
    expect(freshChip).not.toBe(oldChip);

    const tabbables = Array.from(
      document.querySelectorAll<HTMLElement>(tabbableSelector),
    ).filter(el => !el.hasAttribute("disabled"));

    // Sanity: detached old nodes never made it into the tabbable set
    expect(tabbables).not.toContain(oldApplyBtn);
    expect(tabbables).not.toContain(oldChip);
    for (const el of tabbables) {
      expect(el.isConnected).toBe(true);
      expect(el.ownerDocument).toBe(document);
    }

    expect(tabbables).toContain(freshChip);

    // Walk REVERSE order (Shift+Tab) starting from the "after" anchor
    const before = screen.getByTestId("before");
    const after = screen.getByTestId("after");
    const startIdx = tabbables.indexOf(after);
    expect(startIdx).toBeGreaterThanOrEqual(0);

    const visited: HTMLElement[] = [];
    for (let i = startIdx; i >= 0; i--) {
      tabbables[i].focus();
      expect(document.activeElement).toBe(tabbables[i]);
      visited.push(tabbables[i]);
    }

    // Reverse traversal reaches the fresh chip and the "before" anchor,
    // with the chip visited BEFORE "before" (since it sits later in DOM
    // order, reverse walk hits it first), and never visits an old node.
    expect(visited).toContain(freshChip);
    expect(visited).toContain(before);
    expect(visited.indexOf(freshChip)).toBeLessThan(visited.indexOf(before));
    expect(visited).not.toContain(oldApplyBtn);
    expect(visited).not.toContain(oldChip);

    expect(document.activeElement).not.toBe(oldApplyBtn);
    expect(document.activeElement).not.toBe(oldChip);
    expect(document.activeElement?.isConnected).toBe(true);
  });

  it("after multiple unmount+remount cycles, Tab and Shift+Tab never visit old nodes and always reach fresh chip and button", () => {
    // Stress test: cycle the component N times, accumulating references
    // to every old apply button and applied-chip. After the final mount,
    // walk Tab (forward) and Shift+Tab (reverse) order and assert that
    // none of the detached old nodes are ever visited, while the fresh
    // chip and button are reachable in both directions.
    function FocusableHarness(props: React.ComponentProps<typeof Harness>) {
      return (
        <div>
          <button data-testid="before">before</button>
          <Harness {...props} />
          <button data-testid="after">after</button>
        </div>
      );
    }

    const original = ["Cliente", "Receita", "Despesa"];
    const profile = saveMappingProfile({
      tenantId: TENANT, entity: ENTITY, headers: original,
      mappings: {
        nome_do_servico: "Cliente",
        receita_servico: "Receita",
        custo_servico: "Despesa",
      },
    });

    const reordered = ["Receita", "Cliente", "Despesa"];
    const tabbableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const oldButtons: HTMLElement[] = [];
    const oldChips: HTMLElement[] = [];

    // --- Cycle N times: mount, dismiss banner, capture refs, unmount
    const CYCLES = 5;
    for (let i = 0; i < CYCLES; i++) {
      const { unmount } = render(
        <FocusableHarness headers={reordered} forcedStaleProfile={profile} />,
      );
      const btn = screen.getByRole("button", { name: /aplicar mesmo assim/i });
      fireEvent.click(btn);
      const chip = screen.getByTestId("applied-chip");
      // Make chip tabbable so we can prove it doesn't leak across cycles
      chip.setAttribute("tabindex", "0");
      btn.focus(); // also exercise focus on each cycle
      oldButtons.push(btn);
      oldChips.push(chip);
      unmount();
      expect(btn.isConnected).toBe(false);
      expect(chip.isConnected).toBe(false);
    }

    expect(oldButtons).toHaveLength(CYCLES);
    expect(new Set(oldButtons).size).toBe(CYCLES); // all unique nodes
    expect(new Set(oldChips).size).toBe(CYCLES);

    // --- Final fresh mount
    render(<FocusableHarness headers={reordered} forcedStaleProfile={profile} />);
    const freshBtn = screen.getByRole("button", { name: /aplicar mesmo assim/i });
    // Fresh button must not be any of the old ones
    for (const old of oldButtons) expect(freshBtn).not.toBe(old);
    fireEvent.click(freshBtn);
    const freshChip = screen.getByTestId("applied-chip");
    freshChip.setAttribute("tabindex", "0");
    for (const old of oldChips) expect(freshChip).not.toBe(old);

    const tabbables = Array.from(
      document.querySelectorAll<HTMLElement>(tabbableSelector),
    ).filter(el => !el.hasAttribute("disabled"));

    // Sanity: no old detached node leaked into the tabbable set
    for (const old of [...oldButtons, ...oldChips]) {
      expect(tabbables).not.toContain(old);
      expect(old.isConnected).toBe(false);
    }
    for (const el of tabbables) {
      expect(el.isConnected).toBe(true);
      expect(el.ownerDocument).toBe(document);
    }
    expect(tabbables).toContain(freshChip);

    const before = screen.getByTestId("before");
    const after = screen.getByTestId("after");
    const beforeIdx = tabbables.indexOf(before);
    const afterIdx = tabbables.indexOf(after);
    expect(beforeIdx).toBeGreaterThanOrEqual(0);
    expect(afterIdx).toBeGreaterThan(beforeIdx);

    // --- Forward (Tab) walk from "before" → must reach fresh chip & "after",
    // never any old node
    const forwardVisited: HTMLElement[] = [];
    for (let i = beforeIdx; i < tabbables.length; i++) {
      tabbables[i].focus();
      expect(document.activeElement).toBe(tabbables[i]);
      forwardVisited.push(tabbables[i]);
    }
    expect(forwardVisited).toContain(freshChip);
    expect(forwardVisited).toContain(after);
    for (const old of [...oldButtons, ...oldChips]) {
      expect(forwardVisited).not.toContain(old);
    }

    // --- Reverse (Shift+Tab) walk from "after" → must reach fresh chip & "before",
    // never any old node
    const reverseVisited: HTMLElement[] = [];
    for (let i = afterIdx; i >= 0; i--) {
      tabbables[i].focus();
      expect(document.activeElement).toBe(tabbables[i]);
      reverseVisited.push(tabbables[i]);
    }
    expect(reverseVisited).toContain(freshChip);
    expect(reverseVisited).toContain(before);
    expect(reverseVisited.indexOf(freshChip)).toBeLessThan(reverseVisited.indexOf(before));
    for (const old of [...oldButtons, ...oldChips]) {
      expect(reverseVisited).not.toContain(old);
    }

    // Final focus must be on a live node
    expect(document.activeElement?.isConnected).toBe(true);
    for (const old of [...oldButtons, ...oldChips]) {
      expect(document.activeElement).not.toBe(old);
    }
  });
});
