import * as UnifiNetwork from "@alchemy-unifi/network";
import * as Effect from "effect/Effect";
import { RemovalPolicy } from "alchemy";
import type { Input } from "alchemy/Input";
import type { Site } from "./sites.ts";
import type { Zones } from "./zones.ts";

interface Options {
	/** Whether the gateway's mDNS proxy covers the network (needed by anything that discovers devices across networks, e.g. casting). */
	readonly mdns: boolean;
	/** Whether the network reaches the internet. When off, UniFi blocks it with a system rule, after any user policies. */
	readonly internet?: boolean;
}

/**
 * A gateway network on `192.168.<VLAN>.0/24`, with the gateway at `.1`
 * handing out `.6` upwards, and the gateway as its only trusted DHCP server.
 */
const gateway = (name: string, vlanId: number, zone: Input<UnifiNetwork.FirewallZoneReference>, options: Options) =>
	({
		management: "GATEWAY",
		name,
		vlanId,
		enabled: true,
		zone,
		internetAccessEnabled: options.internet ?? true,
		cellularBackupEnabled: false,
		// Isolation is expressed by firewall policies (src/firewall.ts), not this flag.
		isolationEnabled: false,
		mdnsForwardingEnabled: options.mdns,
		dhcpGuarding: { trustedDhcpServerIpAddresses: [`192.168.${vlanId}.1`] },
		ipv4Configuration: {
			autoScaleEnabled: false,
			hostIpAddress: `192.168.${vlanId}.1`,
			prefixLength: 24,
			dhcpConfiguration: {
				mode: "SERVER",
				ipAddressRange: { start: `192.168.${vlanId}.6`, stop: `192.168.${vlanId}.254` },
				leaseTimeSeconds: 86400,
				pingConflictDetectionEnabled: true,
			},
		},
	}) satisfies Input<UnifiNetwork.GatewayNetworkProps>;

export const networks = (site: Site, zones: Zones) =>
	Effect.gen(function* () {
		const base = gateway("Management", 1, zones.management, { mdns: false });
		return {
			/**
			 * The site's default network (adopted by VLAN 1, never deleted).
			 * DHCP starts at .64, leaving room for statically addressed gear.
			 */
			management: yield* UnifiNetwork.Network("management", {
				...base,
				ipv4Configuration: {
					...base.ipv4Configuration,
					dhcpConfiguration: {
						...base.ipv4Configuration.dhcpConfiguration,
						ipAddressRange: { start: "192.168.1.64", stop: "192.168.1.254" },
						domainName: "localdomain",
					},
				},
			}).pipe(RemovalPolicy.retain()),
			homelab: site.homelab
				? yield* UnifiNetwork.Network("homelab", gateway("Homelab", 2, zones.dmz, { mdns: false }))
				: undefined,
			trusted: yield* UnifiNetwork.Network("trusted", gateway("Trusted", 10, zones.internal, { mdns: true })),
			untrusted: yield* UnifiNetwork.Network(
				"untrusted",
				gateway("Untrusted", 11, zones.hotspot, { mdns: true }),
			),
			iotOpen: yield* UnifiNetwork.Network("iot-open", gateway("IoT (Open)", 20, zones.iot, { mdns: true })),
			/** Sensitive devices: internet only through allow-list policies made in the UI, which beat the system block. */
			iotRestricted: yield* UnifiNetwork.Network(
				"iot-restricted",
				gateway("IoT (Restricted)", 21, zones.iot, { mdns: false, internet: false }),
			),
		};
	});

export type Networks = Effect.Success<ReturnType<typeof networks>>;
