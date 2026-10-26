# AGENTS.md: home-network

Things you must know that aren't obvious from the code.

## Documentation

- **Docs live in `docs/`, one file per subject**, with the overview in `docs/README.md`. They describe the current state only.
- **Plans** for future or in-progress work go in `plans/` (versioned). Delete a plan when it's completed or cancelled; anything still worth knowing goes into `docs/` or the code. `_scratch/` (gitignored) is for session-local notes and plans.
- **Write docs in the owner's voice** ("my networks"), since this is a personal repo.

## Safety

- **The consoles are the user's live home networks.** Never run `alchemy deploy` or `destroy` unless the user explicitly asks for that run. `plan` only reads, so run it whenever it helps.
- **Adoption** of existing objects uses `--adopt`, which applies to the whole run. Always show the user the `plan --adopt` output before any `deploy --adopt`.
- **Keep `UNIFI_*` variables out of `.env`.** Alchemy prefers env vars over profiles, so one would silently point every stage at one console.

## Scope (user's decision)

- **Don't manage deployment-specific things** here: WANs (they differ between the two sites), device lists, adopted hardware, port assignments, client reservations. Reference them with provider lookups if needed.
- **Two sites share one config.** Put only genuine per-site differences in `src/sites.ts`.

## Provider dependency

- `@alchemy-unifi/network` is an injected `file:` dependency on a local checkout at `../alchemy-unifi`, because it isn't published yet. Its `workspace:*` dependency on `@alchemy-unifi/network-sdk` can't resolve here, so `overrides` in `pnpm-workspace.yaml` points it at the same checkout.
- Don't switch it to `pnpm link`/`link:`: the symlinked provider then loads alchemy-unifi's own `alchemy` and `effect`, so there are two copies of each, and typechecking fails (e.g. two incompatible `AuthError` types). Injection resolves its peers from this repo.
- The injected copy is hard-linked to the checkout, so go-to-definition (through the provider's declaration maps) opens files under `node_modules/.pnpm/…` that are the checkout's own source files. A new source file needs `pnpm sync-provider` to appear there.
- After changing the provider, run `pnpm sync-provider`, or this repo keeps using the old build.
- Once it's published, replace the `file:` spec with a version range, and remove `dependenciesMeta`, the `overrides` and the `sync-provider` script.
