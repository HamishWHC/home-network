# home-network architecture

Status: **scaffold only**. The detailed network design comes later. This records the structural decisions the scaffold is built around.

## Scope

In IaC: config that should be identical (or deliberately parameterised) across both home networks, such as networks/VLANs, Wi-Fi broadcasts, firewall zones and policies, ACL and DNS policies.

Not in IaC: deployment-specific state, managed in the UniFi UI (or custom tooling), such as WANs, device lists, adopted hardware, port assignments, client reservations. The provider supports some of these, but this repo doesn't manage them. Code that needs them references them through the provider's lookups (e.g. `UnifiNetwork.Wan.lookup(...)`), which never create or delete anything.

## One stack, one stage per site

```text
alchemy deploy --stage <site> --profile <site>
```

- `alchemy.run.ts` defines a single `HomeNetwork` stack.
- **Stage = physical site.** State is namespaced per stage, so the two networks never share state and can be destroyed or diverge independently.
- **Profile = credentials for that site's console.** Configure each with `alchemy profile edit --profile <site> --add UnifiNetwork`, using either a local URL plus key or a remote console ID plus ui.com key. Keep `UNIFI_*` env vars out of `.env`: Alchemy prefers env vars over profiles, which would point every stage at one console.
- `src/sites.ts` maps stage → per-site values. Only things that genuinely differ go there (for example subnets, if they must differ). An unknown stage fails fast.

## Layout

```text
home-network/
├── alchemy.run.ts     stack entry point: providers, state, composition
├── src/
│   ├── sites.ts       per-site parameters, selected by stage
│   └── …              one module per concern (networks.ts, wifi.ts, firewall.ts), each an Effect yielding resources
└── docs/
```

The earlier, never-applied Terraform attempt lives beside this repo at `../terraform/`, for reference while porting. It isn't version-controlled there; its history is in this repo's git log.

Modules export Effects that take what they depend on (for example `wifi(networks)`), and `alchemy.run.ts` composes them. Cross-module references are plain values and `Output`s, so no global registry is needed.

## State

`AWS.state()` uses Alchemy's default account-regional bucket (`alchemy-state-<account>-<region>-an`), created on first deploy with AWS profile `hamishwhc` in `ap-southeast-2`. The existing `personal-state-…` bucket could be used via `AWS.state({ bucketName, prefix })`. I've avoided that because Alchemy converges the bucket's settings (such as encryption) on every run, and that bucket is shared with other projects.

State contains Wi-Fi passphrases, so the bucket stays private, as with Terraform state.

## Adopting the existing consoles

Both consoles already hold config. The first deploy per site is `alchemy plan --adopt` (review), then `alchemy deploy --adopt`. The provider can't prove ownership of untagged UniFi objects, so adoption is always explicit. Wrap critical resources (the management network, the main SSID) in `RemovalPolicy.retain(...)`.

## Dependency on the provider

`@alchemy-unifi/network` is an **injected** `file:` dependency (`dependenciesMeta.injected`). pnpm hard-links the provider's build output into this repo's `node_modules` and resolves its `effect`/`alchemy` peers from here, so there's exactly one instance of each (verified). Because consumers get the build output:

```sh
pnpm sync-provider   # build alchemy-unifi, then re-sync the injected copy
```

Once the provider is published, replace the `file:` spec with a version range and drop `dependenciesMeta`.

## Spike (later): hosting Alchemy state on a UniFi site

A long shot, kept here so it isn't forgotten. Could a site's own UniFi hardware hold its Alchemy state, removing the AWS dependency? Avenues to evaluate:

1. **UniFi storage products** (UNAS, or Drive on a console with storage) exposing SMB/NFS. Use a file-backed custom state store (Alchemy supports custom state stores) over a mounted share. This is the most plausible option.
2. **State in UniFi objects themselves**, e.g. encoded into description fields or a dedicated object. Hacky; check size limits, and whether config backups and restores would carry it.
3. **Containers on the console** (SSH plus podman on UniFi OS). Unsupported and wiped by firmware updates; probably a dead end.

Concerns any option must answer: locking against concurrent deploys, encryption at rest (state holds passphrases), and bootstrapping. A deploy that reconfigures the network mustn't cut off its own state store mid-run.
