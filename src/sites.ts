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
}

/** Sites by stage name. */
const sites: Record<string, Site> = {};

export class UnknownSite extends Data.TaggedError("UnknownSite")<{ readonly stage: string }> {
	override get message() {
		const known = Object.keys(sites).join(", ") || "none";
		return `No site is configured for stage "${this.stage}". Known sites: ${known}.`;
	}
}

/** The site for the current stage. */
export const site = Effect.gen(function* () {
	const { stage } = yield* Stack;
	const current = sites[stage];
	if (current === undefined) return yield* Effect.die(new UnknownSite({ stage }));
	return current;
});
