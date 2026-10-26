import * as UnifiNetwork from "@alchemy-unifi/network";
import type { Input } from "alchemy/Input";
import * as Effect from "effect/Effect";
import type { Networks } from "./networks.ts";
import type { Site } from "./sites.ts";
import type { Zones } from "./zones.ts";

/**
 * The zones networks live in, by what they hold: Trusted in Internal,
 * Untrusted in Hotspot, Homelab in Dmz (sites with a homelab only), both IoT
 * networks in IoT, Management in Management, and VPN clients (none yet) in
 * Vpn.
 */
type Area = "trusted" | "untrusted" | "homelab" | "iot" | "management" | "vpn";

const AREAS: ReadonlyArray<Area> = ["trusted", "untrusted", "homelab", "iot", "management", "vpn"];

const LABELS: Record<Area, string> = {
	trusted: "Trusted",
	untrusted: "Untrusted",
	homelab: "Homelab",
	iot: "IoT",
	management: "Management",
	vpn: "VPN",
};

/**
 * Which areas may start connections to which other areas. Everything not
 * listed is blocked by an explicit policy, so the whole matrix is in the
 * config rather than resting on UniFi's defaults. Replies to allowed
 * connections always flow back.
 *
 * Untrusted reaching IoT (Open) only, and the gateway, are handled
 * separately below.
 */
const ALLOWED: Record<Area, ReadonlyArray<Area>> = {
	trusted: ["homelab", "iot", "management"],
	untrusted: [],
	homelab: ["iot"],
	iot: [],
	management: [],
	vpn: [],
};

const common = {
	enabled: true,
	ipProtocolScope: { ipVersion: "IPV4_AND_IPV6" as const },
	loggingEnabled: false,
};

/** Allows, with UniFi deriving the mirrored rule that lets replies back (some pairs have no system return rule). */
const allow = { ...common, action: { type: "ALLOW" as const, allowReturnTraffic: true } };

/**
 * Blocks match new connections only, so replies to connections allowed the
 * other way still reach UniFi's return-traffic rules, which sit after user
 * policies.
 */
const block = { ...common, action: { type: "BLOCK" as const }, connectionStateFilter: ["NEW" as const] };

/**
 * TCP/UDP ports a network needs on the gateway: DNS, DHCP, DHCPv6 and mDNS.
 * ICMP isn't TCP/UDP, so it's left to UniFi's rules.
 */
const GATEWAY_BASICS = [53, 67, 547, 5353];

/**
 * The firewall matrix as policies: one per pair of areas, plus two special
 * cases.
 *
 * - **Untrusted → IoT:** only IoT (Open), where things to cast to live.
 * - **IoT and VPN → gateway:** only the basics (`GATEWAY_BASICS`, and ICMP).
 *   UniFi allows these zones everything on the gateway, including its web UI
 *   and SSH. Hotspot and Dmz already get only the basics from UniFi, and
 *   Trusted and Management keep everything.
 *
 * IoT (Restricted)'s internet access is the network's flag
 * (`internetAccessEnabled: false`), not a policy: the per-device allow-lists
 * are made in the UI and beat the flag's system rule, so no ordering is
 * declared for IoT → External.
 */
export const firewall = (site: Site, zones: Zones, networks: Networks) =>
	Effect.gen(function* () {
		const zoneOf: Record<Area, Input<UnifiNetwork.FirewallZoneReference>> = {
			trusted: zones.internal,
			untrusted: zones.hotspot,
			homelab: zones.dmz,
			iot: zones.iot,
			management: zones.management,
			vpn: zones.vpn,
		};

		// Without a Homelab network, Dmz is empty and left to UniFi's defaults.
		const areas = AREAS.filter((area) => area !== "homelab" || site.homelab);

		const policies: Record<string, UnifiNetwork.FirewallPolicy> = {};
		for (const from of areas) {
			for (const to of areas) {
				if (from === to || (from === "untrusted" && to === "iot")) continue;
				const allowed = ALLOWED[from].includes(to);
				const id = `${from}-to-${to}`;
				policies[id] = yield* UnifiNetwork.FirewallPolicy(`fw-${allowed ? "allow" : "block"}-${id}`, {
					...(allowed ? allow : block),
					name: `${allowed ? "Allow" : "Block"} ${LABELS[from]} to ${LABELS[to]}`,
					source: { zone: zoneOf[from] },
					destination: { zone: zoneOf[to] },
				});
			}
		}

		// IoT (Open) and IoT (Restricted) share a zone, but don't talk to each other. A zone's policy to itself
		// governs traffic between its networks; devices on the same network talk directly, unseen by the firewall.
		policies["iot-to-iot"] = yield* UnifiNetwork.FirewallPolicy("fw-block-iot-to-iot", {
			...block,
			name: "Block IoT (Open) and IoT (Restricted) from each other",
			source: { zone: zones.iot },
			destination: { zone: zones.iot },
		});

		// Untrusted casts to IoT (Open) only.
		const untrustedToIotOpen = yield* UnifiNetwork.FirewallPolicy("fw-allow-untrusted-to-iot-open", {
			...allow,
			name: "Allow Untrusted to IoT (Open)",
			source: { zone: zones.hotspot },
			destination: {
				zone: zones.iot,
				trafficFilter: {
					type: "NETWORK",
					networkFilter: { matchOpposite: false, networks: [networks.iotOpen] },
				},
			},
		});
		const untrustedToIot = yield* UnifiNetwork.FirewallPolicy("fw-block-untrusted-to-iot", {
			...block,
			name: "Block Untrusted to IoT",
			source: { zone: zones.hotspot },
			destination: { zone: zones.iot },
		});
		yield* UnifiNetwork.FirewallPolicyOrdering("fw-order-untrusted-to-iot", {
			source: zones.hotspot,
			destination: zones.iot,
			beforeSystemDefined: [untrustedToIotOpen, untrustedToIot],
			exclusive: true,
		});

		// Only the basics on the gateway, for zones UniFi otherwise allows everything.
		for (const from of ["iot", "vpn"] as const) {
			policies[`${from}-to-gateway`] = yield* UnifiNetwork.FirewallPolicy(`fw-block-${from}-to-gateway`, {
				...block,
				name: `Block ${LABELS[from]} to the gateway, except DNS, DHCP and mDNS`,
				ipProtocolScope: {
					ipVersion: "IPV4_AND_IPV6",
					protocolFilter: { type: "PRESET", preset: { name: "TCP_UDP" } },
				},
				source: { zone: zoneOf[from] },
				destination: {
					zone: zones.gateway,
					trafficFilter: {
						type: "PORT",
						portFilter: {
							type: "PORTS",
							matchOpposite: true,
							items: GATEWAY_BASICS.map((value) => ({ type: "PORT_NUMBER" as const, value })),
						},
					},
				},
			});
		}

		return { ...policies, untrustedToIotOpen, untrustedToIot };
	});
