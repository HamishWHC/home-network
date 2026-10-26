import * as AWS from "@alchemy.run/aws";
import * as UnifiNetwork from "@alchemy-unifi/network";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import { networks } from "./src/networks.ts";
import { SecretSpecSecrets } from "./src/secrets.ts";
import { site } from "./src/sites.ts";
import { wifi } from "./src/wifi.ts";
import { zones } from "./src/zones.ts";

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
		secrets: ({ stage }) => [SecretSpecSecrets({ profile: stage })],
	},
	Effect.gen(function* () {
		// Fails unless the profile belongs to this stage's site.
		const current = yield* site;
		const zoneResources = yield* zones;
		const networkResources = yield* networks(current, zoneResources);
		const wifiResources = yield* wifi(networkResources);
		return {
			site: current.name,
			networks: Object.values(networkResources).flatMap((n) => (n === undefined ? [] : [n.vlanId])),
			wifi: [wifiResources.main.wifiBroadcastId, wifiResources.iot.wifiBroadcastId],
		};
	}),
);
