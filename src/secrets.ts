import type * as Secrets from "alchemy/Secrets";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { SecretSpec } from "secretspec";

/** A `secrets` entry that resolves a secretspec profile. */
export class SecretSpecProvider extends Data.TaggedClass("home-network/SecretProvider::SecretSpec")<{
	readonly layer: Secrets.SecretsLayer;
}> {}

/** secretspec returns YAML maps as JSON strings; turn those back into objects so `Config.schema` can read them. */
const parseValue = (value: string): unknown => {
	if (!value.startsWith("{") && !value.startsWith("[")) return value;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
};

const resolve = (profile: string) =>
	Effect.tryPromise({
		try: () =>
			SecretSpec.builder()
				.withPath("secretspec.toml")
				.withProfile(profile)
				.withReason(`alchemy run for stage ${profile}`)
				.loadAsync(),
		catch: (cause) =>
			new ConfigProvider.SourceError({
				message: `secretspec couldn't resolve profile "${profile}": ${cause instanceof Error ? cause.message : String(cause)}`,
				cause,
			}),
	}).pipe(
		Effect.map((resolved) => {
			const fields = Object.entries(resolved.fields()).flatMap(([name, value]) =>
				value === null ? [] : [[name, parseValue(value)] as const],
			);
			return ConfigProvider.fromUnknown(Object.fromEntries(fields));
		}),
	);

/**
 * Adds a secretspec profile's secrets to the stack's configuration, keyed by
 * secret name. A secret holding a YAML map is exposed as a nested object.
 *
 * The profile is resolved on the first lookup, not when the entry is built:
 * Alchemy's profile and state commands build the stack's secrets with the
 * stage `"placeholder"`, which isn't a secretspec profile, and never read them.
 *
 * ```ts
 * secrets: ({ stage }) => [SecretSpecSecrets({ profile: stage })]
 * ```
 */
export const SecretSpecSecrets = (options: { readonly profile: string }) =>
	new SecretSpecProvider({
		layer: ConfigProvider.layerAdd(
			Effect.map(Effect.cached(resolve(options.profile)), (resolved) =>
				ConfigProvider.make((path) => Effect.flatMap(resolved, (provider) => provider.load(path))),
			),
			{ asPrimary: true },
		),
	});
