# Returns Cockpit

Returns Cockpit is a trustworthy portfolio-understanding tool. It records manual transactions and explains portfolio value and returns using clearly labeled demo/static prices. It does not execute trades or make guaranteed recommendations.

## Current milestone

Milestone 1 is complete: transactions persist in browser local storage, demo data is seeded only for a new workspace, transaction validation is visible and prevents overselling, and recent activity supports confirmed deletion. This milestone intentionally has no live market API, authentication, trading execution, or recommendation engine.

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
