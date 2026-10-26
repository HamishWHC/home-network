import * as UnifiNetwork from "@alchemy-unifi/network";
import { RemovalPolicy } from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { Networks } from "./networks.ts";

/** Settings both SSIDs share. */
const common = {
	type: "STANDARD",
	enabled: true,
	hideName: false,
	multicastToUnicastConversionEnabled: false,
	uapsdEnabled: false,
	channel2gLockedTo6: false,
	dtimPeriod2gLockedTo3: false,
	advertiseDeviceName: false,
	arpProxyEnabled: false,
	bssTransitionEnabled: true,
} as const;

const Passphrase = Schema.Redacted(Schema.String);

/** The `wifi` map in `secrets/<stage>.yaml`. */
const WifiSecrets = Schema.Struct({
	main: Schema.Struct({ ssid: Schema.NonEmptyString, passphrase: Passphrase }),
	iot: Schema.Struct({
		ssid: Schema.NonEmptyString,
		passphrases: Schema.Struct({ open: Passphrase, restricted: Passphrase }),
	}),
});

/**
 * The two SSIDs. Their names identify the houses, so they come from the
 * stage's encrypted secrets along with the passphrases.
 */
export const wifi = (networks: Networks) =>
	Effect.gen(function* () {
		const secrets = yield* Config.schema(WifiSecrets, "wifi");
		const main = yield* UnifiNetwork.WifiBroadcast("main", {
			...common,
			name: secrets.main.ssid,
			network: networks.management,
			clientIsolationEnabled: false,
			bandSteeringEnabled: true,
			broadcastingFrequenciesGHz: [2.4, 5, 6],
			handoffSuggestionsConfiguration: { band6GHzRssiThreshold: -88 },
			securityConfiguration: {
				type: "WPA2_WPA3_PERSONAL",
				passphrase: secrets.main.passphrase,
				pmfMode: "OPTIONAL",
				fastRoamingEnabled: false,
				wpa3FastRoamingEnabled: false,
				saeConfiguration: { anticloggingThresholdSeconds: 5, syncTimeSeconds: 5 },
			},
		}).pipe(RemovalPolicy.retain());

		/** One SSID for IoT devices; the key a device joins with picks its network. */
		const iot = yield* UnifiNetwork.WifiBroadcast("iot", {
			...common,
			name: secrets.iot.ssid,
			clientIsolationEnabled: true,
			bandSteeringEnabled: false,
			broadcastingFrequenciesGHz: [2.4, 5],
			securityConfiguration: {
				type: "WPA2_PERSONAL",
				fastRoamingEnabled: false,
				presharedKeys: [
					{
						network: { type: "SPECIFIC", networkId: networks.iotOpen.networkId },
						passphrase: secrets.iot.passphrases.open,
					},
					{
						network: { type: "SPECIFIC", networkId: networks.iotRestricted.networkId },
						passphrase: secrets.iot.passphrases.restricted,
					},
				],
			},
		});

		return { main, iot };
	});
