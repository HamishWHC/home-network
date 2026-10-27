# home-network

Alchemy configuration for my two UniFi home networks. These docs describe what exists now.

The stack declares my networks, firewall zones and Wi-Fi ([network-structure.md](network-structure.md)). SSIDs and passphrases come from sops-encrypted files, read through secretspec ([secrets.md](secrets.md)).

## How it's organised

- `alchemy.run.ts` defines one stack, `HomeNetwork`, with `UnifiNetwork.providers()`, `UnifiNetwork.state()` and the stage's secretspec profile. It composes `src/zones.ts`, `src/networks.ts` and `src/wifi.ts`.
- **Logical IDs are unique across the stack, not per resource type**, so the zones are `iot-zone` and `management-zone`.
- **Stage = physical site** (`home`, `holiday`). The same stack is deployed once per site, with state namespaced per stage, so the two networks never share state.
- **Profile = a way to reach that site's console.** Each site has two Alchemy profiles, listed in `src/sites.ts`:

    | Site      | Profile          | `UnifiNetwork` method                                   |
    | --------- | ---------------- | ------------------------------------------------------- |
    | `home`    | `home`           | `local`: the console's URL and a Network API key        |
    | `home`    | `home-remote`    | `remote`: the console via ui.com and a Site Manager key |
    | `holiday` | `holiday`        | `local`                                                 |
    | `holiday` | `holiday-remote` | `remote`                                                |

    I use the local profile when I'm on that network, and the remote one otherwise.

    ```sh
    pnpm alchemy plan   --stage home --profile home          # at home
    pnpm alchemy plan   --stage holiday --profile holiday-remote   # holiday house, from home
    ```

- **The stack checks the pairing.** Before anything else, `site` in `src/sites.ts` fails unless the credentials came from one of the stage's profiles. That catches `--stage home --profile holiday` (this site's config on the other network), and `UNIFI_*` environment variables, which Alchemy would use for every stage. The check only reads the profile; it doesn't contact the console.
- `src/sites.ts` otherwise holds only the values that differ between sites. See [network-structure.md](network-structure.md) for what's in scope.

## Setting up profiles

```sh
pnpm alchemy profile create home
pnpm alchemy profile edit --profile home --add UnifiNetwork   # choose "Directly"; pin the console's certificate
pnpm alchemy profile create home-remote
pnpm alchemy profile edit --profile home-remote --add UnifiNetwork   # choose "Through ui.com"; pick the console
# …and the same for holiday / holiday-remote
pnpm alchemy profile show --profile home   # connects and shows the console's Network version
```

Each of my consoles hosts one UniFi site (UniFi's "site" is a namespace within a console, unrelated to my physical sites), so profiles don't store one and resources use the console's only site. Profiles made before the provider stopped storing it still show `site: default`; reconfiguring drops it. The provider's `docs/connecting.md` describes the connection options.

## State

Each site's state lives on its own console, through `UnifiNetwork.state()`: a disabled firewall policy named `alchemy-state/HomeNetwork/<stage>`. So deploying needs nothing but the console, directly or through ui.com. The provider's `docs/state.md` describes it.

- **Every run locks the stage on the console**, `plan` included: it creates a traffic-matching list `alchemy-lock/HomeNetwork/<stage>` and deletes it when the run ends. Two runs of one site at once fail.
- **State commands need `--profile`** to find the console, e.g. `pnpm alchemy state ls --profile home`, because they take no `--stage`.
- **State contains the Wi-Fi passphrases**, readable by anyone who can read the console's firewall policies (who can read the passphrases anyway).
- **A factory reset wipes it.** Recover with a reviewed `plan --adopt`, then `deploy --adopt`.

## Provider dependency

`@alchemy-unifi/network` isn't published yet, so it's an **injected** `file:` dependency on a local checkout at `../alchemy-unifi` (`dependenciesMeta.injected`). pnpm hard-links the provider's built `dist/` into `node_modules` and resolves its `effect`/`alchemy` peers from this repo, so there's one instance of each.

Rebuilds break the hard links, so after any provider change run:

```sh
pnpm sync-provider   # build the provider, then pnpm install to re-link
```

Once the provider is published, this becomes an ordinary versioned dependency.
