# AGENTS.md: home-network

Things you must know that aren't obvious from the code.

## Documentation

- **Docs live in `docs/`, one file per subject**, with the overview in `docs/README.md`. They describe the current state only.
- **Write docs in the owner's voice** ("my networks"), since this is a personal repo.

## Safety

- **The consoles are the user's live home networks.** Never run `alchemy deploy` or `destroy` unless the user explicitly asks for that run. Only run `plan` when asked too, since it reads the console with real credentials.
- **Adoption** of existing objects uses `--adopt`, which applies to the whole run. Always show the user the `plan --adopt` output before any `deploy --adopt`.
- **Keep `UNIFI_*` variables out of `.env`.** Alchemy prefers env vars over profiles, so one would silently point every stage at one console.

## Scope (user's decision)

- **Don't manage deployment-specific things** here: WANs (they differ between the two sites), device lists, adopted hardware, port assignments, client reservations. Reference them with provider lookups if needed.
- **Two sites share one config.** Put only genuine per-site differences in `src/sites.ts`.

## Provider dependency

- `@alchemy-unifi/network` is an injected `file:` dependency on a local checkout at `../alchemy-unifi`, because it isn't published yet.
- After changing the provider, run `pnpm sync-provider`, or this repo keeps using the old build.
- Once it's published, replace the `file:` spec with a version range, and remove `dependenciesMeta` and the `sync-provider` script.
