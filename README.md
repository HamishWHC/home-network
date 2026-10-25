# Home network

[Alchemy](https://alchemy.run) configuration for my UniFi home networks, using [`@alchemy-unifi/network`](https://github.com/HamishWHC/alchemy-unifi). See [docs/](docs/README.md).

## Setup

1. Check out `alchemy-unifi` next to this repo, run `pnpm install` there, then `pnpm sync-provider` here (builds the provider and installs it).
2. Set up the four profiles (a local and a remote one per site); see [docs/README.md](docs/README.md#setting-up-profiles).

## Usage

```sh
pnpm alchemy plan --stage home --profile home          # or --profile home-remote
pnpm alchemy deploy --stage home --profile home
```

After changing the provider, run `pnpm sync-provider` again.
