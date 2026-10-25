import * as UnifiNetwork from "@alchemy-unifi/network";
import * as AWS from "@alchemy.run/aws";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import { site } from "./src/sites.ts";

/**
 * One stack, deployed once per physical site. The stage selects the site
 * (`alchemy deploy --stage <site>`), and each site's profile holds the
 * credentials for its console (`--profile <site>`).
 */
export default Alchemy.Stack(
	"HomeNetwork",
	{
		providers: UnifiNetwork.providers(),
		state: AWS.state(),
	},
	Effect.gen(function* () {
		const current = yield* site;
		return { site: current.name };
	}),
);
