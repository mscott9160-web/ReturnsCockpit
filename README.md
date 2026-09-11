# Returns Cockpit

Design brief: [Maya Chen design review](.github/design/maya-design-review.md).

The chosen product name is **Returns Cockpit**, with the descriptor "Understand your portfolio with clarity." The visual direction keeps the deep navy, teal, coral, gold, and soft green-gray palette, with Georgia headings and a clean sans-serif for interface text.

Returns Cockpit is a trustworthy portfolio-understanding tool. It records manual transactions and explains portfolio value and returns using clearly labeled demo/static prices. It does not execute trades or make guaranteed recommendations.

## Current milestone

Milestone 1 is complete: transactions persist in browser local storage, demo data is seeded only for a new workspace, transaction validation is visible and prevents overselling, and recent activity supports confirmed deletion. This milestone intentionally has no live market API, authentication, trading execution, or recommendation engine.

The workspace includes Overview, Portfolio, Watchlist, and Activity navigation. Overview keeps the dashboard; Portfolio focuses on holdings, allocation, and educational insights; Activity is the full transaction ledger; and Watchlist contains clearly labeled local sample data. Transactions can be exported as versioned JSON and imported through a file picker. Imports are parsed and validated as a whole before replacing the locally persisted ledger, with visible errors for invalid files.

## Next milestones

- Live market-data adapter with explicit freshness and source states (`supabase/functions/market-data` is now the reviewed boundary; it is not wired into the dashboard)
- Educational insights that explain portfolio behavior without presenting guaranteed recommendations
- Authentication and account/workspace persistence
- Optional brokerage integrations for users who choose to connect one

## Supabase backend foundation

The repository now includes a credentials-free Supabase foundation in `supabase/`. Migration `0001_initial_schema.sql` defines profiles, workspaces, workspace membership, transactions, watchlists, and watchlist items with UUID keys, timestamps, indexes, conservative constraints, and workspace-scoped Row Level Security. The current Vite app is intentionally unchanged and continues to use localStorage.

See [`supabase/README.md`](supabase/README.md) for Supabase CLI setup, migration commands, RLS assumptions, and secret-handling rules. The typed client foundation in `src/supabase.ts` and `src/auth.ts` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; copy [`.env.example`](.env.example) to `.env.local` and provide only those browser-safe values when connecting a project. Missing values are supported: the client stays nullable, auth helpers return a clear configuration error, and the local demo mode remains active. Do not commit that local file or any service-role key.

## Development

```sh
npm install
npm run dev
```

The remaining sections describe the Vite starter configuration used by the project.

## Market data boundary

`src/marketData.ts` defines the provider-facing `PriceSnapshot` contract and the demo provider. Each snapshot includes a symbol, price, status (`demo`, `fresh`, `stale`, or `unavailable`), source attribution, and an `asOf` timestamp. Portfolio calculations accept either a numeric price map or a snapshot map, so valuation does not import UI data and a future provider can be substituted without changing transaction or return logic.

The current provider is deliberately local and contains no API calls or credentials. A future live provider must protect API keys outside the browser, attribute the upstream source, preserve reliable timestamps, expose stale and outage states, respect rate limits, and confirm data licensing and redistribution rights before being enabled.

### Live market-data boundary

`src/liveMarketData.ts` is the typed client boundary for the live function. It validates and normalizes symbols, requires a configured Supabase client and authenticated user, and invokes only the `market-data` Edge Function. It never calls a market-data provider from the browser. Demo mode remains the only dashboard data source until this boundary is reviewed.

The function returns this stable contract for every request:

```ts
type LiveMarketDataResponse = {
  data: Array<{
    symbol: string
    price: number | null
    status: 'fresh' | 'stale' | 'unavailable'
    source: string
    asOf: string | null
    reason?: string
  }>
  error: string | null
}
```

Deploy after selecting a provider and confirming its API terms, quote freshness rules, attribution requirements, and rights to display or redistribute the data:

```sh
supabase functions deploy market-data
supabase secrets set MARKET_DATA_PROVIDER_URL=https://provider.example/quotes MARKET_DATA_API_KEY=replace-me
```

Provider selection and an account are deliberately deferred. Do not put either secret in Vite or Expo environment variables. The function currently documents and isolates the expected upstream shape (`{ data: [{ symbol, price, asOf? }] }`); its adapter must be updated and reviewed for the selected provider before enabling live prices.

## Educational insights boundary

`src/insights.ts` calculates deterministic observations from the local portfolio holdings and demo price snapshots. Allocation is each holding's non-negative market value divided by total non-negative market value. A concentration observation is shown when one holding exceeds 35%. Return contribution observations report realized return, unrealized return, and dividends separately using the values already calculated by `src/portfolio.ts`. Empty portfolios and zero market value produce zero allocation percentages without throwing.

These observations explain recorded portfolio behavior; they are not buy or sell recommendations, personalized investment advice, or promises of profit. Returns Cockpit does not guarantee profit or predict future performance.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
