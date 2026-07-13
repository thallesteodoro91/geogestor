# GeoGestor Interface System

## Direction

GeoGestor should feel like an operational command surface for topography, field work, budgets, and local finance. The interface should be calm, precise, and professional, with color used as functional signal rather than decoration.

## Signature

Use a subtle "linha de levantamento" pattern: thin gradient accents, soft semantic tints, and restrained glow on important cards, tabs, and primary actions. This gives the product a recognizable GeoGestor identity without replacing the existing menu icons.

## Palette

- System and management: indigo/violet.
- Field, topography, maps, measurement: sky/cyan/teal.
- Finance, revenue, success, reimbursable: emerald/teal.
- Registry, taxes, attention, pending review: amber/yellow.
- Risk, tributary, destructive actions: rose/red.
- Structure: zinc/slate neutrals.

## Depth Strategy

Use neutral surfaces with low-opacity borders and light shadow. In dark mode, rely more on borders and surface shifts than heavy shadows. Avoid black active states except for rare editorial/hero treatment.

## Components

- Primary action: cyan -> indigo -> violet gradient, pill shape, white text, subtle shadow, focus-visible ring.
- Revenue action: emerald -> green -> teal gradient.
- Expense/destructive action: rose -> red -> orange gradient.
- Tabs: neutral inactive state; active state uses semantic gradient tint, ring, and shadow. Do not use black active tabs.
- Inputs: inset/elevated control surfaces, never pure black in dark mode.
- KPI/cards: mostly neutral card with semantic gradient line/tint. Avoid fully saturated colored cards except for key hero metrics.

## Density & Shape

Keep an 8px spacing base. Use compact density for controls and tables, more air for executive dashboards. Radius scale: small controls 12px, tabs/cards 16-24px, modals/large sections 24-32px. Avoid adding large rounded nested cards unless the hierarchy needs it.

## Quality Checks

- Color must communicate function, status, or identity.
- The screen should pass the squint test: hierarchy remains clear, no harsh borders or random colors jump out.
- Menu icons remain unchanged unless explicitly requested.
- Buttons, tabs, filters, and KPI cards should use shared patterns from `apps/web/src/utils/geoTheme.ts` and `apps/web/src/utils/actionStyles.ts`.
