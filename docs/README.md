# home-network

Alchemy configuration for my two UniFi home networks. These docs describe what exists now.

Current state: scaffold only. The stack deploys no resources yet, because the provider has none.

## How it's organised

- `alchemy.run.ts` defines one stack, `HomeNetwork`, with `UnifiNetwork.providers()` and `AWS.state()`.
- **Stage = physical site.** The same stack is deployed once per site, with state namespaced per stage, so the two networks never share state.
- **Profile = that site's console credentials.** Each site's Alchemy profile holds a `UnifiNetwork` auth entry: either local (URL + key) or remote (console ID + ui.com key).

    ```sh
    pnpm alchemy plan   --stage <site> --profile <site>
    pnpm alchemy deploy --stage <site> --profile <site>
    ```

- `src/sites.ts` holds only the values that differ between sites. See [network-structure.md](network-structure.md) for what's in scope.

## State

`AWS.state()` uses Alchemy's default S3 bucket for the account and region (`alchemy-state-<account>-<region>-an`), created on first deploy, with AWS profile `hamishwhc` in `ap-southeast-2`.

State will contain Wi-Fi passphrases; the bucket is private.

## Provider dependency

`@alchemy-unifi/network` isn't published yet, so it's an **injected** `file:` dependency on a local checkout at `../alchemy-unifi` (`dependenciesMeta.injected`). pnpm hard-links the provider's built `dist/` into `node_modules` and resolves its `effect`/`alchemy` peers from this repo, so there's one instance of each.

Rebuilds break the hard links, so after any provider change run:

```sh
pnpm sync-provider   # build the provider, then pnpm install to re-link
```

Once the provider is published, this becomes an ordinary versioned dependency.
