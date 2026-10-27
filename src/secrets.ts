import type * as Secrets from "alchemy/Secrets";
import { ConfigError } from "effect/Config";
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
			new ConfigError(
				new ConfigProvider.SourceError({
					message: `secretspec couldn't resolve profile "${profile}": ${cause instanceof Error ? cause.message : String(cause)}`,
					cause,
				}),
			),
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
 * ```ts
 * secrets: ({ stage }) => [SecretSpecSecrets({ profile: stage })]
 * ```
 */
export const SecretSpecSecrets = (options: { readonly profile: string }) =>
	new SecretSpecProvider({ layer: ConfigProvider.layerAdd(resolve(options.profile), { asPrimary: true }) });
