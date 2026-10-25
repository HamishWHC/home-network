# Network structure

No resources are declared yet.

## Scope

**Managed here:** configuration shared by both sites (identical, or deliberately parameterised per site), such as networks/VLANs, Wi-Fi broadcasts, firewall zones and policies, ACL and DNS policies.

**Not managed here:** deployment-specific state, which is managed in the UniFi UI or custom tooling. This covers WANs (which differ between the sites), device lists and adopted hardware, port assignments, and client reservations. When configuration needs to reference one of these, it uses a provider lookup, which reads but never creates or deletes.
