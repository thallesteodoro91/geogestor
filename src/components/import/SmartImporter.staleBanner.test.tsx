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
  forcedStaleProfile,
}: {
  headers: string[];
  autoMap?: Record<string, string>;
  forcedStaleProfile?: MappingProfile;
}) {
  const found = forcedStaleProfile
    ? { profile: forcedStaleProfile, layoutChanged: true, currentLayoutHash: "" }
    : findMappingProfile(TENANT, ENTITY, headers);
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

    // --- Instance B (cont.): unmount and remount once more with the original
    // stale scenario — the banner must reappear cleanly on this fresh mount
    // (it's a new component instance, so the initializer runs again), and
    // it must NOT already be paired with a leftover applied-chip from A.
    screen.unmount?.();
    const { unmount: unmountB } = render(
      <Harness headers={reordered} forcedStaleProfile={profile} />,
    );
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("applied-chip")).toBeNull();
    unmountB();
  });
});
