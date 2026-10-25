import * as UnifiNetwork from "@alchemy-unifi/network";
import { Stack } from "alchemy/Stack";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";

/**
 * Per-site differences. Only values that genuinely differ between sites go
 * here; site-specific concerns such as WANs and device lists are managed in
 * the UniFi UI rather than in this repo.
 */
export interface Site {
	readonly name: string;
	/**
	 * Alchemy profiles allowed to deploy this site: one reaching its console
	 * directly, one through ui.com for when I'm elsewhere.
	 */
	readonly profiles: ReadonlyArray<string>;
}

/** Sites by stage name. */
const sites: Record<string, Site> = {
	home: { name: "Home", profiles: ["home", "home-remote"] },
	holiday: { name: "Holiday", profiles: ["holiday", "holiday-remote"] },
};

export class UnknownSite extends Data.TaggedError("UnknownSite")<{ readonly stage: string }> {
	override get message() {
		return `No site is configured for stage "${this.stage}". Known sites: ${Object.keys(sites).join(", ")}.`;
	}
}

export class WrongConsole extends Data.TaggedError("WrongConsole")<{
	readonly stage: string;
	readonly site: Site;
	readonly source: UnifiNetwork.CredentialsSource;
}> {
	override get message() {
		const allowed = this.site.profiles.join(" or ");
		return this.source.type === "env"
			? `UNIFI_* environment variables are set, and they'd point stage "${this.stage}" at whichever console they name. Unset them and use --profile ${allowed}.`
			: `Profile "${this.source.profile}" isn't for stage "${this.stage}" (${this.site.name}). Use --profile ${allowed}.`;
	}
}

/**
 * The site for the current stage, after checking that the UniFi credentials
 * in use belong to it. Profiles hold one console each, so pairing a stage
 * with another site's profile would deploy this site's config onto the
 * wrong network. Resolving credentials only reads the profile; it doesn't
 * contact the console.
 */
export const site = Effect.gen(function* () {
	const { stage } = yield* Stack;
	const current = sites[stage];
	if (current === undefined) return yield* Effect.die(new UnknownSite({ stage }));
	const { source } = yield* yield* UnifiNetwork.UnifiNetworkCredentials;
	if (source.type === "env" || !current.profiles.includes(source.profile)) {
		return yield* Effect.die(new WrongConsole({ stage, site: current, source }));
	}
	return current;
});
