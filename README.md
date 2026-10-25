# Home network

[Alchemy](https://alchemy.run) configuration for my UniFi home networks, using [`@alchemy-unifi/network`](https://github.com/HamishWHC/alchemy-unifi). See [docs/](docs/README.md).

## Setup

1. Check out `alchemy-unifi` next to this repo, run `pnpm install` there, then `pnpm sync-provider` here (builds the provider and installs it).
2. Configure a profile per site: `pnpm alchemy profile edit --profile <site> --add UnifiNetwork`. AWS credentials for the state bucket come from the `hamishwhc` AWS profile.

## Usage

```sh
pnpm alchemy plan --stage <site> --profile <site>
pnpm alchemy deploy --stage <site> --profile <site>
```

After changing the provider, run `pnpm sync-provider` again.
