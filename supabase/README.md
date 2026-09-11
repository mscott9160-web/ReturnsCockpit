# Supabase backend foundation

This directory contains the initial database foundation for Returns Cockpit. The browser app still uses localStorage; this migration is intentionally not connected to the current app yet and is suitable for a future web or Expo client.

## Data-layer contract

`src/workspaceData.ts` is the integration seam for the next app step. It uses the existing nullable Supabase client and authenticated user to find or create a personal workspace, load transactions, replace a validated transaction ledger, and load/save the default watchlist. It returns `{ data, error }` results and gives explicit errors when Supabase is unconfigured or no user is authenticated; callers must not report a remote save when `error` is present.

Database transaction IDs are UUIDs, while the current `Transaction` type uses numeric IDs. The adapter maps UUIDs to stable numeric IDs for the current app shape and omits the local ID when inserting. Transaction replacement validates the complete input with the existing portfolio parser before deleting anything. The current migration does not expose a SQL transaction/RPC, so an insert failure after deletion is reported clearly rather than presented as a successful atomic remote save.

The next step is to connect authenticated app state to this module, replacing the localStorage read/write path only after remote loading, save errors, and sign-out behavior have visible UI states.

## Setup

1. Create a Supabase project.
2. Install the Supabase CLI and authenticate it locally.
3. Link this repository to the project:

   ```sh
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. Apply the migration:

   ```sh
   supabase db push
   ```

   For local development, start the local stack with `supabase start`, then use `supabase db reset` to apply all migrations.

5. Copy `.env.example` to `.env.local` and fill in the project URL and browser-safe anon key:

   ```sh
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

   The Vite client foundation in `src/supabase.ts` is credential-optional. When either value is absent, `isSupabaseConfigured` is `false`, auth helpers return a clear configuration error, and the local demo mode remains active. These variables must contain only the publishable anon key, never a service-role key.

## Schema and RLS assumptions

- `profiles` is keyed to `auth.users`; profile rows are private to the signed-in user.
- A workspace owner should create the initial `workspace_members` row for themselves after creating a workspace. The owner is also recognized through `workspaces.owner_id`.
- Members can read and write workspace transactions and watchlists. Workspace owners alone can update or delete a workspace and manage membership rows.
- The policies assume requests use Supabase Auth and `auth.uid()` is populated. Service-role operations bypass RLS and must remain server-side.
- Amounts and prices use PostgreSQL `numeric`; transaction currency defaults to `USD` but remains explicit for future multi-currency support.

## Secrets

Never commit service-role keys, database passwords, `.env.local` files, or other credentials. The service-role key bypasses Row Level Security and must never be exposed to a browser or shipped in an Expo client.