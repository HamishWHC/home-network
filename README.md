# Home network

[Alchemy](https://alchemy.run) configuration for my UniFi home networks, using [`@alchemy-unifi/network`](https://github.com/HamishWHC/alchemy-unifi). See [docs/](docs/README.md).

To use the provider in your own project, install it from npm (`npm install @alchemy-unifi/network alchemy effect @effect/platform-node`) and follow [its tutorial](https://alchemy-unifi.hamishwhc.com/tutorial/part-1/). This repo builds it from a local checkout instead, because I develop the two together.

## Setup

This is for me: it needs my consoles and the age key that decrypts `secrets/`. To adapt the config, start from your own secrets file and profiles ([docs/secrets.md](docs/secrets.md), [docs/README.md](docs/README.md#setting-up-profiles)).

1. Check out `alchemy-unifi` next to this repo, run `pnpm install` there, then `pnpm sync-provider` here (builds the provider and installs it).
2. Set up the four profiles (a local and a remote one per site); see [docs/README.md](docs/README.md#setting-up-profiles).

## Usage

```sh
pnpm alchemy plan --stage home --profile home          # or --profile home-remote
pnpm alchemy deploy --stage home --profile home
```

After changing the provider, run `pnpm sync-provider` again.

## License

[MIT](LICENSE)
