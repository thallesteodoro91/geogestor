---
name: Plan Limit Enforcement UI
description: Frontend gating + upgrade CTAs for tenants hitting plan limits (clients, properties, users). Banner in AppLayout + dialog-level blocks.
type: feature
---
Frontend enforcement of plan limits across creation flows:

- **Dialogs that gate creation** (each renders `<PlanLimitAlert />` and disables Save when limit is hit):
  - `ClienteDialog` (clients)
  - `ClientePropriedadeUnificadoDialog` (clients + computes properties limit considering N new props in form)
  - `PropriedadeDialog` (properties)
  - `InviteUserDialog` / `TeamManagementSection` (users)

- **Global proactive banner**: `<PlanUsageBanner />` mounted in `AppLayout` above page content.
  - Triggers when ANY of clients/properties/users usage ratio ≥ 0.8.
  - Hidden on `/assinatura` itself, while loading, when `planSlug === 'owner'`, or when dismissed (sessionStorage key `geogestor.planUsageBanner.dismissed`).
  - Severity switches to `block` (destructive style) when current ≥ max.

- **Upgrade CTA destination**: all toast actions and banner buttons point to `/assinatura` (NOT `/configuracoes`). `/configuracoes` no longer has a plan tab — the Assinatura page hosts the pricing table + `ManageSubscriptionPanel`.

- **Owner bypass**: `usePlanLimits` returns unlimited for `planSlug === 'owner'`; banner and gates short-circuit.
