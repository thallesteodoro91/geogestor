# GeoGestor

Plataforma SaaS multi-tenant de gestão financeira e operacional para empresas de **topografia, agrimensura e georreferenciamento**.

GeoGestor reúne em um único produto: cadastro de clientes e propriedades, orçamentos com geração de PDF, ordens de serviço, controle de despesas, faturamento, dashboard 360° com KPIs de receita/margem/conversão e relatório executivo.

## Stack

- **Frontend:** React 18 + Vite 5 + TypeScript + Tailwind + shadcn/ui
- **Backend:** Lovable Cloud (Postgres + Edge Functions + Storage + Auth)
- **Pagamentos:** Stripe (checkout, customer portal, webhook)
- **IA:** Lovable AI Gateway (sugestões, GeoBot)

## Desenvolvimento

```sh
npm install
npm run dev
```

## Build de produção

```sh
npm run build
```

## Testes

```sh
npm run test
```

## Estrutura

- `src/pages` — telas roteadas
- `src/components` — UI compartilhada
- `src/modules/finance` — domínio financeiro (KPIs, RPCs)
- `src/integrations/supabase` — cliente gerado (não editar)
- `supabase/functions` — Edge Functions (Stripe, OAuth, AI)
- `supabase/migrations` — schema versionado

## Licença

Proprietário © GeoGestor.
