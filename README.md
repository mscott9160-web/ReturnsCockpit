# Returns Cockpit

Returns Cockpit is a trustworthy portfolio-understanding tool. It records manual transactions and explains portfolio value and returns using clearly labeled demo/static prices. It does not execute trades or make guaranteed recommendations.

## Current milestone

Milestone 1 is complete: transactions persist in browser local storage, demo data is seeded only for a new workspace, transaction validation is visible and prevents overselling, and recent activity supports confirmed deletion. This milestone intentionally has no live market API, authentication, trading execution, or recommendation engine.

The workspace includes Overview, Portfolio, Watchlist, and Activity navigation. Overview keeps the dashboard; Portfolio focuses on holdings, allocation, and educational insights; Activity is the full transaction ledger; and Watchlist contains clearly labeled local sample data. Transactions can be exported as versioned JSON and imported through a file picker. Imports are parsed and validated as a whole before replacing the locally persisted ledger, with visible errors for invalid files.

## Next milestones

- Live market-data adapter with explicit freshness and source states
- Educational insights that explain portfolio behavior without presenting guaranteed recommendations
- Authentication and account/workspace persistence
- Optional brokerage integrations for users who choose to connect one

## Development

```sh
npm install
npm run dev
```

The remaining sections describe the Vite starter configuration used by the project.

## Market data boundary

`src/marketData.ts` defines the provider-facing `PriceSnapshot` contract and the demo provider. Each snapshot includes a symbol, price, status (`demo`, `fresh`, `stale`, or `unavailable`), source attribution, and an `asOf` timestamp. Portfolio calculations accept either a numeric price map or a snapshot map, so valuation does not import UI data and a future provider can be substituted without changing transaction or return logic.

The current provider is deliberately local and contains no API calls or credentials. A future live provider must protect API keys outside the browser, attribute the upstream source, preserve reliable timestamps, expose stale and outage states, respect rate limits, and confirm data licensing and redistribution rights before being enabled.

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
