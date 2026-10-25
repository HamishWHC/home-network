import * as UnifiNetwork from "@alchemy-unifi/network";
import * as AWS from "@alchemy.run/aws";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import { site } from "./src/sites.ts";

/**
 * One stack, deployed once per physical site. The stage selects the site
 * (`--stage home`), and a profile for that site supplies its console's
 * credentials (`--profile home` or `--profile home-remote`).
 */
export default Alchemy.Stack(
	"HomeNetwork",
	{
		providers: UnifiNetwork.providers(),
		state: AWS.state(),
	},
	Effect.gen(function* () {
		// Fails unless the profile belongs to this stage's site.
		const current = yield* site;

		// Resources go here. They use the profile's console and its default
		// site, e.g. `yield* UnifiNetwork.Network("Trusted", { vlanId: 10, ... })`.

		return { site: current.name };
	}),
);
