import * as UnifiNetwork from "@alchemy-unifi/network";
import * as Effect from "effect/Effect";

/** Firewall zones: the built-in ones (references, no resource) and my custom ones. */
export const zones = Effect.gen(function* () {
	const { INTERNAL, EXTERNAL, GATEWAY, VPN, HOTSPOT, DMZ } = UnifiNetwork.FirewallZone;
	return {
		internal: INTERNAL,
		external: EXTERNAL,
		gateway: GATEWAY,
		vpn: VPN,
		hotspot: HOTSPOT,
		dmz: DMZ,
		iot: yield* UnifiNetwork.FirewallZone("iot-zone", { name: "IoT" }),
		/** Empty for now; the firewall plan decides what goes in it. */
		management: yield* UnifiNetwork.FirewallZone("management-zone", { name: "Management" }),
	};
});

export type Zones = Effect.Success<typeof zones>;
