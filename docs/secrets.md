# Secrets

My SSIDs name the houses, so they're secret along with the Wi-Fi passphrases. Everything else (network names, VLANs, subnets) is generic and lives in code.

## How they're stored and read

- `secrets/<stage>.yaml`: a YAML file per site, encrypted with [sops](https://github.com/getsops/sops) and committed. Keys are visible; values aren't.
- `.sops.yaml` encrypts them to a single age recipient: my personal MacBook's key. sops finds the private key in `~/.config/sops/age/keys.txt` (via `XDG_CONFIG_HOME`).
- `secretspec.toml` declares the secrets. Its profiles are named after the stages, and each one reads its stage's file through secretspec's sops provider.
- `src/secrets.ts` is an Alchemy secrets entry that resolves the stage's profile with the [secretspec Node SDK](https://secretspec.dev/sdk/nodejs/). It resolves the profile on the first secret lookup, because Alchemy's profile and state commands build the secrets with the stage `placeholder` and never read them. If the file or key is missing, the run fails before the console is contacted.
- **One secretspec secret per top-level YAML key.** secretspec returns a YAML map as JSON. The entry turns it back into an object, so code reads the whole map with `Config.schema`, for example `Config.schema(WifiSecrets, "wifi")` in `src/wifi.ts`.
- The decrypted passphrases end up in Alchemy state (the private S3 bucket), as any resource prop does.

```yaml
wifi:
    main:
        ssid: …
        passphrase: …
    iot:
        ssid: …
        passphrases: # the key a device joins with picks its network
            open: …
            restricted: …
```

## Editing

```sh
sops secrets/home.yaml   # decrypts into $EDITOR, re-encrypts on save
```

Adding a top-level key means declaring it in `secretspec.toml` too. secretspec reports a missing or unreadable file as `missing required secret(s)`, not as a file error, so check the path first.

Adding a recipient (another machine) means adding its age public key to `.sops.yaml`, then running `pnpm secrets:updatekeys`, which shows each file's key changes and asks before re-encrypting it.
