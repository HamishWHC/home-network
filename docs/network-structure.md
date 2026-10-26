# Network structure

Both sites get the same networks, zones and SSIDs, except where `src/sites.ts` says otherwise.

## Networks

Every network is gateway-managed on `192.168.<VLAN>.0/24`, with the gateway at `.1`, DHCP from `.6` (1-day leases) and internet access (except IoT (Restricted)). Cellular backup is off: home's backup is a separate WAN (WAN2), not UniFi's cellular failover. DHCP guarding trusts only the gateway. Auto-scale is off, so UniFi never resizes a subnet behind the config's back. Isolation is off everywhere: the firewall policies below do that job, so the whole matrix reads from the config.

| Network          | VLAN | Firewall zone | mDNS | Notes                                                                                                                                                                          |
| ---------------- | ---- | ------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Management       | 1    | Management    | off  | The site's default network, with my UniFi gear: adopted by VLAN, never deleted or replaced. DHCP from `.64`, leaving room for statically addressed gear; domain `localdomain`. |
| Homelab          | 2    | Dmz           | off  | Servers, including Home Assistant. Home only (`homelab` in `src/sites.ts`).                                                                                                    |
| Trusted          | 10   | Internal      | on   | My devices; the main SSID.                                                                                                                                                     |
| Untrusted        | 11   | Hotspot       | on   | Guests and devices I don't trust.                                                                                                                                              |
| IoT (Open)       | 20   | IoT           | on   | Devices others cast to, e.g. the Apple TV.                                                                                                                                     |
| IoT (Restricted) | 21   | IoT           | off  | Sensitive devices (solar inverter, Home Assistant sensors). Internet access off; see below.                                                                                    |

**mDNS** here is the gateway's mDNS proxy, which repeats discovery between networks. It's on where something needs to find devices on another network (casting from Trusted or Untrusted to IoT (Open)), and off elsewhere. The UI's "Gateway mDNS Proxy" setting is a view of these flags, so I leave it alone.

## Firewall zones

`src/zones.ts` maps every zone by name: the built-in ones (references, no resources) and two custom ones, **IoT** (both IoT networks) and **Management**.

## Firewall

`src/firewall.ts` declares who can start connections to whom; replies to allowed connections always flow back. "Basics" means DNS, DHCP, ICMP and mDNS to the gateway.

| From ↓ / To →        | Trusted | Untrusted | Homelab | IoT (Open) | IoT (Restricted) | Management | Gateway    | Internet         |
| -------------------- | ------- | --------- | ------- | ---------- | ---------------- | ---------- | ---------- | ---------------- |
| **Trusted**          | ✓       | ✗         | ✓       | ✓          | ✓                | ✓          | everything | ✓                |
| **Untrusted**        | ✗       | ✓         | ✗       | ✓          | ✗                | ✗          | basics     | ✓                |
| **Homelab**          | ✗       | ✗         | ✓       | ✓          | ✓                | ✗          | basics     | ✓                |
| **IoT (Open)**       | ✗       | ✗         | ✗       | ✓          | ✗                | ✗          | basics     | ✓                |
| **IoT (Restricted)** | ✗       | ✗         | ✗       | ✗          | ✓                | ✗          | basics     | allow-lists only |
| **Management**       | ✗       | ✗         | ✗       | ✗          | ✗                | ✓          | everything | ✓                |
| **VPN clients**      | ✗       | ✗         | ✗       | ✗          | ✗                | ✗          | basics     | ✓                |

- **Every cell between zones is an explicit policy**, allow or block, so the matrix doesn't rest on UniFi's defaults (which, for example, let Internal reach Hotspot and let custom zones reach the whole gateway). Homelab's policies exist only on sites with a Homelab network; elsewhere Dmz is empty and left to UniFi's defaults.
- **Blocks match new connections only**, so they never drop replies to connections allowed the other way; **allows** have UniFi derive the mirrored return rule, because some pairs (e.g. IoT → Internal) have no system one.
- **Gateway basics:** for IoT and VPN clients, a block on TCP/UDP to every port except DNS (53), DHCP (67), DHCPv6 (547) and mDNS (5353); ICMP stays allowed. UniFi already gives Hotspot and Dmz only the basics, and Trusted and Management keep everything (Management's UniFi gear is managed by the console on the gateway).
- **IoT (Restricted)'s internet** is the network's internet-access flag, which UniFi turns into a system block rule. Per-device allow-lists, and full access for devices I'm still working out allow-lists for, are policies I make in the UI: they sit before system rules, so they win. The config declares no ordering for IoT → External, so it never reorders them.
- **VPNs:** none yet. Holiday is behind CGNAT, and UniFi Teleport only gives internet access, so Trusted administers Management and the gateway. VPN clients are locked down so that any added later get nothing by default.
- **The default security posture is Block All** (set in the UI). It only shapes defaults for things created in the UI later.

## Wi-Fi

SSID names and passphrases differ per site and are secret; see [secrets.md](secrets.md).

- **Main:** on Trusted, WPA2/WPA3 transition with PMF optional, band steering, on 2.4, 5 and 6 GHz (with a −88 dBm 6 GHz handoff threshold).
- **IoT:** WPA2 with one key per IoT network, so the key a device joins with puts it on Open or Restricted. Client isolation is on, and it uses 2.4 + 5 GHz without band steering.

The main SSID and the Management network have `RemovalPolicy.retain()`, so removing them from the config never deletes them.

## Scope

**Managed here:** configuration shared by both sites (identical, or deliberately parameterised per site): networks/VLANs, Wi-Fi broadcasts, firewall zones and policies, and later DNS policies.

**Not managed here:** deployment-specific state, which is managed in the UniFi UI or custom tooling. This covers WANs (which differ between the sites), device lists and adopted hardware, port assignments, and client reservations. When configuration needs to reference one of these, it uses a provider lookup, which reads but never creates or deletes.
