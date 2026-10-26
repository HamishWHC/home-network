# Network structure

Both sites get the same networks, zones and SSIDs, except where `src/sites.ts` says otherwise.

## Networks

Every network is gateway-managed on `192.168.<VLAN>.0/24`, with the gateway at `.1`, DHCP from `.6` (1-day leases), internet access and mDNS forwarding. Cellular backup is off: home's backup is a separate WAN (WAN2), not UniFi's cellular failover. DHCP guarding trusts only the gateway. Auto-scale is off, so UniFi never resizes a subnet behind the config's back.

| Network          | VLAN | Firewall zone | Notes                                                                                                                                                      |
| ---------------- | ---- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Management       | 1    | Internal      | The site's default network: adopted by VLAN, never deleted or replaced. DHCP from `.64`, leaving room for statically addressed gear; domain `localdomain`. |
| Homelab          | 2    | Dmz           | Home only (`homelab` in `src/sites.ts`).                                                                                                                   |
| Trusted          | 10   | Internal      |                                                                                                                                                            |
| Untrusted        | 11   | Hotspot       |                                                                                                                                                            |
| IoT (Open)       | 20   | IoT           |                                                                                                                                                            |
| IoT (Restricted) | 21   | IoT           |                                                                                                                                                            |

## Firewall zones

`src/zones.ts` maps every zone by name: the built-in ones (references, no resources) and two custom ones, **IoT** (both IoT networks) and **Management** (empty until the firewall design fills it).

## Wi-Fi

SSID names and passphrases differ per site and are secret; see [secrets.md](secrets.md).

- **Main:** on Management (sent to UniFi as the native network), WPA2/WPA3 transition with PMF optional, band steering, on 2.4, 5 and 6 GHz (with a −88 dBm 6 GHz handoff threshold).
- **IoT:** WPA2 with one key per IoT network, so the key a device joins with puts it on Open or Restricted. Client isolation is on, and it uses 2.4 + 5 GHz without band steering.

The main SSID and the Management network have `RemovalPolicy.retain()`, so removing them from the config never deletes them.

## Scope

**Managed here:** configuration shared by both sites (identical, or deliberately parameterised per site), such as networks/VLANs, Wi-Fi broadcasts, firewall zones and policies, ACL and DNS policies.

**Not managed here:** deployment-specific state, which is managed in the UniFi UI or custom tooling. This covers WANs (which differ between the sites), device lists and adopted hardware, port assignments, and client reservations. When configuration needs to reference one of these, it uses a provider lookup, which reads but never creates or deletes.
