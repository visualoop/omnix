# LAN browser HTTPS and certificate operations

The read-only browser companion is served by the existing dedicated Axum listener over HTTPS. Rustls runs in the Omnix process; there is no nginx, sidecar, proxy, or second server process. The paired-till listener remains on its existing HTTP port so already paired desktop and Android tills continue to work.

## Connection modes

### Managed browser-trusted certificate (primary)

A deployment assigns each hub a stable hostname below a domain controlled by Omnix, for example a unique label below the production LAN-certificate zone. The application does **not** contain a placeholder production domain or helper endpoint. Operations supplies these values to the hub:

- `OMNIX_LAN_CERT_HOSTNAME`: the assigned per-hub DNS hostname.
- `OMNIX_ACME_HELPER_ORDER_URL`: the complete HTTPS URL of the deployed certificate-order operation. Omnix has no built-in default; an unset value cannot accidentally call a fictional service.
- `OMNIX_ACME_HELPER_TOKEN`: a short-lived or renewable hub credential accepted only for that hub hostname. Never place this value in logs or support screenshots.

The hub generates its certificate private key in its application-data `lan-tls` directory with owner-only permissions. Renewal sends only a PKCS#10 CSR and hostname to the configured helper:

```json
{
  "hostname": "the-assigned-per-hub-hostname",
  "csrPem": "-----BEGIN CERTIFICATE REQUEST-----\n..."
}
```

The configured operation must return a successful JSON response no larger than 1 MiB:

```json
{
  "certificateChainPem": "-----BEGIN CERTIFICATE-----\n...leaf and intermediates...",
  "notAfter": "2030-01-02T03:04:05Z"
}
```

It must never request or return the hub private key.

### What Omnix-hosted DNS and the ACME helper must provide

The hosted components are an operational prerequisite; this repository does not claim that an undeployed URL exists.

1. Allocate an unguessable, stable hostname to one licensed hub and constrain its helper credential to that hostname.
2. Publish A and/or AAAA answers that resolve that hostname to the hub's current LAN address for clients on the branch network. If the LAN address changes, the hosted record must be updated before browsers use the new address. The branch DNS/firewall must permit that name to resolve to a private address.
3. Accept the CSR contract above over authenticated HTTPS. Reject hostnames outside the credential's assignment and enforce rate limits and audit logging.
4. Complete an ACME order against a publicly trusted CA using **DNS-01**. The helper creates and removes the required `_acme-challenge` TXT records in the Omnix-controlled authoritative DNS zone. No inbound connection to the shop is required.
5. Finalize the ACME order with the hub-provided CSR and return the leaf plus intermediate chain, leaf first. The private key remains on the hub throughout. The hub validates the chain against its bundled public WebPKI roots, current time, and assigned DNS hostname before displaying `Trusted certificate`; a merely parseable or privately signed chain is rejected.
6. Return the certificate's real RFC 3339 expiry. Never issue a chain for a different hostname.
7. Remain idempotent for retries and expose operational logs keyed by hub identity, not by CSR contents or credentials.

The hub checks renewal every six hours and renews when fewer than 30 days remain. A still-valid managed certificate remains active if renewal is delayed. A newly returned chain is checked for PEM validity and private-key compatibility before rustls reloads it. Network settings exposes `Trusted`, `renewing`, `renewal due`, or `renewal delayed` state.

### Stable self-signed certificate (offline fallback)

If managed trust is not configured or no usable managed certificate exists, Omnix generates one self-signed certificate and private key in the same application-data directory. They are reused across restarts, so the SHA-256 fingerprint shown in **Settings → Network** stays stable. The certificate covers the advertised IP and, when assigned, the managed hostname.

Each browser needs a one-time trust action:

1. On the hub, open **Settings → Network** and copy the Reports address and SHA-256 fingerprint.
2. Open that exact address on the browser. Do not substitute `http`, another IP, another hostname, or another port.
3. Inspect the presented certificate and compare its SHA-256 fingerprint character for character with the hub display.
4. Trust/import it only when the fingerprints match. Browser and operating-system trust workflows vary; managed devices should install it in the local trust store rather than repeatedly bypassing a warning.

This fallback encrypts traffic after trust is established, but it is intentionally labelled `Private certificate` because a public browser CA did not authenticate it.

## Customer steps for a warning-free connection

1. The Omnix operator assigns the hub hostname and helper credential, and configures the three environment values above for the desktop app or Windows LAN service.
2. DNS for that hostname must resolve to the hub's LAN IP from the customer's browser.
3. Start or restart the LAN server while the hub has internet access. Network settings initially may show `Private · managed certificate pending`; the background order changes it to `Trusted certificate` after the DNS-01 order succeeds.
4. Confirm Network settings shows `https`, the assigned hostname, and `Trusted certificate`.
5. Copy the Reports login address from Omnix and open it unchanged. A standard browser then connects without a certificate warning and receives a `Secure; HttpOnly; SameSite=Strict` session cookie.

No port-forwarding or inbound internet reachability is required. The browser and hub still must be on a network where the hostname resolves and the HTTPS listener port is reachable.

## Authorization troubleshooting

### Root cause fixed in this change

The reported internal redemption failure was not caused by HTTP, a bare IP, `Secure`, or the same-origin policy. Desktop authorization commands use Tauri's current application data directory, `%APPDATA%\\co.ke.omnix.app\\omnix.db`, but the Windows LAN service was hard-coded to the obsolete `%APPDATA%\\com.omnix.pos\\omnix.db`. The service therefore redeemed against a different database from the one where the desktop issued the grant. On an older service-side database, the first redemption query failed with `no such table: web_read_session_grants`; the old handler collapsed that SQLite error into `The browser session could not be authorized.` The service now derives its database and TLS directories from the same shared application identifier as the desktop.

Redemption requires `Sec-Fetch-Site: same-origin`; when the browser sends an `Origin`, it must exactly equal the configured scheme, hostname, and port. These checks and the GET-only route allowlist are unchanged by TLS.

- A plain-HTTP bare-IP origin was valid in the previous implementation when it exactly matched the advertised origin. Its cookie intentionally lacked `Secure`; that is not the internal redemption failure.
- Substituting an IP for a configured HTTPS hostname, changing scheme/port, or loading through another site is rejected before a code is consumed.
- Codes are one-time and expire after ten minutes. Unknown, expired, already-used, revoked, and inactive-viewer outcomes now have distinct API codes and operator instructions.
- An HTTP 500 during redemption can only come from the SQLite redemption transaction (or invalid stored state), not from the origin policy. The response contains a support reference. Server logs record that reference, operation, SQLx class/database code, and SQLite message without recording the authorization code, session token, cookie, private key, or helper credential.
