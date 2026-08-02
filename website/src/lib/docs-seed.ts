/**
 * Documentation seed — the canonical source of truth for /docs.
 *
 * The /docs index AND /docs/[slug] both read from DOCS_SEED, so slugs can
 * never drift out of sync (which previously caused 404s).
 *
 * Detailed guides plus scaffolded topics that remain hidden until written.
 */

export interface DocSeed {
  slug: string
  title: string
  excerpt: string
  category: 'Basics' | 'Core' | 'Modules' | 'Integrations' | 'Billing' | 'Troubleshooting'
  icon: string
  body: string
}

const scaffold = (heading: string, intro: string, sections: string[]): string =>
  `${intro}\n\n${sections.map((s) => `## ${s}\n\nTODO: document this.`).join('\n\n')}`

export const DOCS_SEED: DocSeed[] = [
  // ─── DETAILED (5) ─────────────────────────────────────────────────────
  {
    slug: 'getting-started',
    title: 'Getting started',
    excerpt: 'Install Omnix, activate your licence, complete the setup wizard, and ring your first sale.',
    category: 'Basics',
    icon: 'RocketLaunch',
    body: `Welcome to Omnix — the offline-first POS and business software for Kenyan businesses. This guide takes you from download to your first sale in about ten minutes.

## Download and install

Get the latest installer from [omnix.co.ke/downloads](https://omnix.co.ke/downloads). Run the \`.exe\`. If Windows shows a SmartScreen warning ("Windows protected your PC"), click **More info → Run anyway** — the installer is verified by a SHA-256 hash shown on the downloads page.

Omnix installs per-user (no admin rights needed) and takes about 30 seconds.

## Activate your licence

On first launch you'll see the activation screen. If you've already bought a licence, paste the licence key — it binds to this machine and you're ready to go.

Haven't bought yet? Click **Buy now** right on the activation screen — it opens the checkout in your browser, you pay once (KES 30,000, one-time, no subscription), and the key arrives by email. Paste it back into Omnix to activate.

## Complete the setup wizard

The wizard collects:

1. **Your trade** — tailors the app to your business.
2. **Business details** — name, address, phone, KRA PIN. These print on receipts and eTIMS invoices.
3. **Owner account** — your sign-in. Only the owner can reset other users' passwords or change billing.

## Ring your first sale

Open **POS**, search a product (or scan its barcode — Omnix detects USB scanners automatically), add it to the cart, and hit **Pay**. Choose cash, M-Pesa, or card. Done — your first sale is recorded, stock is decremented, and (if eTIMS is configured) a KRA invoice is auto-signed.

## Next steps

- [Add your products and variants](/docs/inventory)
- [Set up M-Pesa](/docs/mpesa)
- [Configure KRA eTIMS](/docs/etims)
- [Turn on cloud backup](/docs/cloud-backup)`,
  },
  {
    slug: 'pos',
    title: 'Point of sale',
    excerpt: 'The full checkout workflow — search, scan, holds, returns, split payments, M-Pesa, card, and the customer display.',
    category: 'Core',
    icon: 'ShoppingCart',
    body: `The POS screen is built for speed. Everything is reachable by keyboard, and a USB barcode scanner works out of the box.

## Adding items

- **Search** by name, SKU, or category in the search box.
- **Scan** a barcode — Omnix auto-detects HID scanners; the scan lands in the cart even if the search box isn't focused.
- **Variants** — if a product has sizes/weights (e.g. 5kg, 10kg, 25kg flour), a picker appears so you choose the right one with the right price.
- **Pack/carton barcodes** — scanning a carton barcode adds the full pack quantity automatically.

## Holds and recall

Mid-sale and need to serve someone else? Hit **Hold** to park the cart, serve the next customer, then **Recall** to bring it back. Useful at busy tills.

## Payment methods

Tap **Pay** to open the payment sheet:

- **Cash** — enter the amount tendered; Omnix calculates change.
- **M-Pesa** — STK push via Daraja or Paystack; the customer confirms on their phone.
- **Card** — via Paystack.
- **Split payment** — combine methods (e.g. KES 500 cash + rest on M-Pesa).
- **Customer credit** — charge to a customer's account if they have a credit limit.

## Returns and refunds

Open **Returns**, find the original sale, select the lines to return, and choose the refund method. Stock is added back and the refund is logged for the Z-report.

## Customer display

If you run a second screen facing the customer, enable it in **Settings → Customer Display**. It shows the running cart, totals, and a payment-success animation — with an optional privacy mode that hides item names.`,
  },
  {
    slug: 'inventory',
    title: 'Inventory & variants',
    excerpt: 'Add products, manage variants (sizes and weights), bulk-import from CSV, run stock takes, and track batches and expiry.',
    category: 'Core',
    icon: 'Package',
    body: `Inventory is the backbone of Omnix. Get this right and POS, reports, and eTIMS all follow.

## Adding a product

Open **Inventory → Add Product**. The barcode field auto-focuses, so you can scan straight away. Fill in name, category, buying and selling price, and your reorder level.

## Variants — same product, different size or weight

Many products come in multiple sizes: maize flour at 2kg, 5kg, 10kg; cooking oil at 500ml, 1L, 5L. Click the **Variants** button (layers icon) on any product row.

Each variant has:
- its own name (e.g. "10kg")
- its own SKU (auto-generated if you leave it blank)
- its own price (leave blank to inherit the product's price)
- its own stock count

At the till, scanning or selecting the product shows a picker so the cashier rings up the exact size at the exact price.

## Bulk import

Have hundreds of products? Use **Inventory → Import CSV**. Download the template, fill it in Excel, and upload. Columns: name, sku, barcode, unit, buying_price, selling_price, initial_stock, reorder_level, tax_rate.

## Stock takes

Run a physical count under **Stock Take**. Count each item, enter the counted quantity, and Omnix shows the variance. Apply the adjustments to write the corrections into inventory with a full audit trail.

## Batches and expiry

For pharmacies and perishables, track batches with expiry dates. Omnix warns you when stock is near expiry and uses FEFO (first-expiry-first-out) at the till.`,
  },
  {
    slug: 'etims',
    title: 'KRA eTIMS setup',
    excerpt: 'Connect Omnix to KRA eTIMS so every sale is auto-signed, and generate your VAT3 return.',
    category: 'Integrations',
    icon: 'FileText',
    body: `Omnix has KRA eTIMS built in — no third-party middleware. Every sale can be auto-signed and submitted.

## Before you start

You'll need your KRA PIN and your eTIMS credentials (the device serial + CU details KRA issued you). Have your business KRA PIN handy.

## Configure eTIMS

Open **Settings → eTIMS**. Enter your KRA PIN, the eTIMS environment (sandbox for testing, production for live), and your device credentials. Save and run **Test connection** — Omnix sends a test invoice and confirms KRA accepted it.

## How signing works

Once configured, every completed sale is queued for signing. Omnix submits the invoice, KRA returns a signature + QR code, and that prints on the customer's receipt. If you're offline, invoices queue and sign automatically when the connection returns.

## The eTIMS queue

**Reports → eTIMS** shows the queue: signed, pending, and any failures. Failed invoices retry automatically; you can also retry manually or inspect the KRA error.

## VAT3 return

At month-end, Omnix generates your VAT3 return from the signed invoices — output VAT, input VAT, and the net position — ready to file.`,
  },
  {
    slug: 'cloud-backup',
    title: 'Cloud backup & restore',
    excerpt: 'Turn on encrypted offsite backups, schedule them, and restore your database on a new machine.',
    category: 'Core',
    icon: 'CloudArrowUp',
    body: `Cloud backup keeps an encrypted copy of your database offsite, so a stolen or dead laptop never means lost data.

## How the encryption works

Backups are encrypted on your device with AES-256-GCM **before** they leave. The encryption key is derived from your password plus your licence key — which means we, the Omnix team, **cannot** read your data. It also means the same password + licence will decrypt the backup on any machine.

## Enable cloud backup

Open **Settings → Cloud Backup**. The feature requires an active paid licence with a cloud-backup window. Click **Back up now**, enter a backup password (use something you'll remember — it cannot be recovered), and Omnix uploads the encrypted snapshot.

## Schedule automatic backups

Toggle **Daily auto-backup** and pick an interval (hourly to weekly). While you're signed in, Omnix backs up in the background — no password prompts, because the key is held in memory for the session. You'll get a quiet confirmation toast on each successful run.

## Restore on a new machine

Reinstalled Omnix or moved to a new laptop?

1. Activate the **same licence**.
2. Open **Settings → Cloud Backup** — your backups appear in the list.
3. Click **Restore** on the backup you want, enter the **same password** you used to create it.
4. Omnix downloads, verifies the SHA-256, decrypts, and stages the restore. Restart to apply.

A safety snapshot of the current database is taken before any restore, so you can always roll back.`,
  },

  // ─── APPLICATION CLIENTS ──────────────────────────────────────────────
  {
    slug: 'windows-desktop-hub',
    title: 'Windows desktop hub',
    excerpt: 'Install the main Omnix application, set up the branch hub, and keep companion devices connected.',
    category: 'Basics',
    icon: 'DesktopTower',
    body: `The Windows desktop hub is the main Omnix application. It holds the branch database, runs the full POS and back office, and gives Android and browser clients a branch service to connect to.

## What you need

- A 64-bit PC running Windows 10 or Windows 11
- An Omnix customer account linked to the licence for this device
- Enough Windows access to run the installer
- Internet for the initial download, activation, updates, and any connected service that needs it

Core desktop work stays available without internet after setup. Kenya's eTIMS, SHA, online payments, cloud backup, activation, and updates need a connection at the point where they contact an outside service.

## Install the desktop hub

Sign in through the [Omnix Downloads page](/downloads) and open the customer dashboard. Choose the Windows edition attached to your licence, download its installer, and run it on the PC that will hold the branch record.

Open Omnix after installation, activate the licensed device, then finish the business and owner setup shown on screen. Don't copy an installed program folder between PCs. Install normally and move the licence through the supported device controls if the hub PC changes.

## Prepare the branch service

Open the desktop area for connected devices or branch networking and turn on the branch service. Omnix shows the local branch address and the controls used to enrol Android devices. Keep the hub open and connected to the branch router while companion devices need live data.

Use a stable Ethernet connection for the hub where possible. Phones, tablets, and read-only browser devices can use the same router over Wi-Fi.

## Use the hub each day

The desktop hub is where staff manage products, stock, users, branch settings, purchasing, accounting, and the complete POS. It is also the control point for enrolled phones and browser access.

Before closing Omnix or shutting down the PC, check whether mobile sales are waiting to sync. A companion can't reach live branch data while the hub or branch network is off. Android can keep approved offline work locally and send it later, but the browser companion needs a live LAN connection.

## Updates and device changes

Use Omnix's update prompt or the protected customer download to install a newer desktop build. Back up the branch before moving to another PC. If the old device is still registered, release or revoke it through the customer and device controls before activating its replacement.

## Country-specific connections

The hub supports all four Omnix markets for local records and branch work. Configured fiscal and health integrations are currently Kenya-only: KRA eTIMS and SHA. Omnix does not claim direct URA, TRA, or RRA fiscal integration.`,
  },
  {
    slug: 'android-app',
    title: 'Omnix on Android',
    excerpt: 'Install the signed APK, enrol a phone, sell from mobile POS, switch branches, work offline, and share report PDFs.',
    category: 'Basics',
    icon: 'Phone',
    body: `Omnix for Android gives approved staff a mobile POS, branch views, reports, and device controls. It installs from the Omnix website as a signed APK. Google Play distribution is not live, and there is no iOS app.

## Install the signed APK

Open the [Omnix Downloads page](/downloads) on the Android phone or tablet. Download the Android APK only from the Omnix website. If the download control isn't present, the signed Android release hasn't been published for your account or release yet.

Android may ask you to allow your browser to install unknown apps. Allow that browser for this install, open the downloaded APK, and confirm the package installer prompt. You can turn that browser permission off again after installation.

Keep the installed app when updating. A newer APK signed by Omnix installs over it and keeps app data. Don't use APK mirrors, renamed packages, or files sent through an unverified chat. The Play Store doesn't currently carry Omnix.

## Install an update from inside Omnix

A direct-APK build checks the Omnix website release endpoint before it downloads anything. When a newer release is available, Omnix downloads it to the app's private storage, checks the published byte size and SHA-256, and verifies that the APK signing certificate is the pinned Omnix release certificate and matches the installed app. A file that fails any check is not offered to Android's installer.

Tap **Install update** after verification. Android still owns the final package-installer confirmation. If Android asks whether Omnix may install unknown apps, allow Omnix, return to the app, and tap **Install update** again. Denying or leaving that screen keeps the verified APK staged and does not block POS or other offline work. Play-distributed builds do not request this permission and use Play-managed updates instead.

## First-run enrolment

Open Omnix on Android and choose enrolment. On the Windows desktop hub, an owner or authorised manager creates a mobile enrolment for the staff member and branch. Scan the QR code or enter the one-time code shown by the hub, then confirm the business, user, and allowed branches on the phone.

The first sync loads the records the phone needs. Keep the phone close to the branch network and leave the desktop hub running until that sync finishes. Each staff member should use their own Omnix identity. Don't share one enrolled phone profile between cashiers.

When the approved enrolment first enables Private Mesh, Android shows its system VPN permission prompt once. Accept it to let Omnix create the private branch tunnel. While connected, Android keeps a persistent **Omnix Private Mesh** notification; tap it to return to Omnix. Android can ask for VPN permission again if you deny or later revoke it, clear app storage, reinstall the app, or let another VPN take over the device's VPN slot. Ordinary browsing still uses the phone's normal connection because Omnix routes only the approved private subnet.

## Profile and device controls

Open **Profile** to check the signed-in user, role, business, active branch, connection state, pending sync count, app version, and device enrolment. An approved phone also has a visible **Connect Private Mesh** control there; while connected, the same control becomes **Disconnect Private Mesh**. The same area provides the controls to lock the app, retry a sync, or sign out.

Signing out removes the active user session. Revoking a device is different: an owner does that from the Windows hub when a phone is lost, replaced, or no longer allowed to connect. Revocation stops later sync. It doesn't erase a lost phone remotely, so keep Android's own screen lock enabled.

## Sell from mobile POS

Open **POS**, confirm the branch named at the top, then search for an item or tap the barcode scanner. On first use, Android asks for camera permission. Omnix opens its own CameraX capture view and uses the barcode model bundled in the app, so scanning does not hand data to an external scanner app or require a Play Services download. Point the camera at the requested barcode; the first valid result returns to POS. Tap **Cancel**, leave the app, or deny camera permission to stop capture and release the camera. Manual item search remains available either way. Add quantities, review the cart, choose one of the payment methods enabled for that branch, and complete the sale.

A sale always belongs to one branch. The app won't complete a sale while **All Branches** is selected because stock, shifts, receipt numbering, and payment records need a single source branch. Switch to the selling branch first.

Online payment prompts and third-party checks still need their service connection. If a payment can't be confirmed, don't mark it paid unless your business has checked the customer's proof and your normal procedure allows a manual reference.

## Switch branches and use All Branches

Tap the current branch name to choose another branch assigned to your user. The next branch becomes the scope for POS, stock, and branch-specific lists.

**All Branches** is an aggregate view for owners and staff whose role allows it. Use it to read combined totals and reports. It is not a physical branch, doesn't own stock, and can't be used as the source of a sale or adjustment. A total shown under All Branches can lag until every branch has synced.

## Work offline

After enrolment and an initial sync, the Android app keeps approved working data on the device. If the hub, branch Wi-Fi, or Private Mesh connection drops, mobile POS can record supported sales locally and mark them pending. The app sends pending work when it reconnects.

Keep the app installed and don't clear its storage while pending work exists. Check the sync count in **Profile** before signing out, replacing the phone, or ending a shift. Data that depends on a fresh server check may be unavailable or delayed offline. This includes live online payments and, in Kenya, eTIMS or SHA calls. Queued records remain marked until the service accepts them.

## Reports and PDF sharing

Open **Reports**, choose one branch or **All Branches**, set the date range, and run the report. Mobile reports use the data that has reached the phone or hub, so check the sync state before treating a total as final.

Tap **PDF** or **Share PDF** on a supported report. Android opens its share sheet, where you can send the generated file to an installed mail, messaging, storage, or print app. Review the branch and dates in the PDF before sharing it. Reports can contain customer, staff, sales, or financial data.

## If the phone can't connect

Confirm that the Windows hub is running, the phone is on the correct branch Wi-Fi or Omnix Private Mesh, and the device hasn't been revoked. Open **Profile** and retry the connection. If Android asks for VPN permission, read [Omnix Private Mesh](/docs/private-mesh) before accepting it.`,
  },
  {
    slug: 'browser-companion',
    title: 'Browser companion',
    excerpt: 'Open the read-only Omnix companion from a browser connected to the same branch network.',
    category: 'Basics',
    icon: 'Globe',
    body: `The browser companion is a read-only view of branch information. It is useful for an owner, supervisor, or staff member who needs to check records without installing Omnix on that device.

The initial release is LAN-only. The browser device must be on the same branch Wi-Fi or wired network as the Windows desktop hub. It isn't a public cloud login and it doesn't work over mobile data or an unrelated network.

## Before you connect

- Start Omnix on the licensed Windows hub
- Turn on the browser companion or branch service in the desktop network settings
- Connect the other computer, phone, or tablet to the same branch router
- Use a current browser with local network access

The desktop hub shows the branch address to open. Use that exact address, including its port if one is shown. A saved address can stop working if the router later gives the hub a different local IP address, so return to the hub when an old bookmark fails.

## Open the companion

On the browser device, join the branch Wi-Fi. Type the address shown by the Windows hub into the browser address bar, then sign in with an Omnix user that the branch allows.

Use the branch name in the companion header to confirm that you're reading the right site. If the page reports that the hub is unavailable, don't keep refreshing for several minutes. Check the hub and network first.

## What read-only means

You can view the pages exposed by the companion, subject to your role and branch access. You can't ring a sale, change stock, edit customers, approve purchasing, alter settings, or perform another write from the browser companion.

For mobile selling, use the enrolled [Android app](/docs/android-app). For full setup and back-office work, use the [Windows desktop hub](/docs/windows-desktop-hub).

## Keep branch access private

Don't publish the local companion address on the internet or add router port forwarding for it. Use the staff permissions already set in Omnix, sign out on shared devices, and keep the branch Wi-Fi password controlled.

Because the initial browser companion is LAN-only, Omnix Private Mesh doesn't turn an arbitrary remote browser into a supported companion. Private Mesh is for enrolled Omnix clients.

## Fix a connection problem

Confirm that both devices use the same router and that the browser hasn't switched to mobile data or guest Wi-Fi. Guest networks often block devices from seeing each other. Keep Omnix open on the hub, recheck the displayed address, then allow Omnix through the Windows firewall on private networks if Windows asks.

If the branch address still doesn't open, restart the branch service from the hub and try the newly displayed address.`,
  },
  {
    slug: 'private-mesh',
    title: 'Omnix Private Mesh',
    excerpt: 'Connect enrolled Windows and Android devices through the bundled WireGuard tunnel after making the hub reachable.',
    category: 'Integrations',
    icon: 'ShieldCheck',
    body: `Omnix Private Mesh gives enrolled Omnix devices a private route to approved branch services when they aren't on the branch LAN. WireGuard is bundled in the Windows and Android apps. You don't need a separate WireGuard app, a VPN subscription, or a WireGuard account.

The tunnel encrypts traffic, authenticates each enrolled peer, and routes only the private Omnix subnet. It does not make the hub reachable by itself.

## Same-network use needs no router setup

A phone on the same branch Wi-Fi as the Windows hub can connect over the LAN. You don't need port forwarding, DDNS, a public address, or Private Mesh for that same-network connection.

Remote access is different. A phone on mobile data must be able to dial the hub's WireGuard UDP port. Reserve the hub's LAN address, forward that UDP port in the branch router, and use DDNS if the public address changes. Follow [Set up remote access](/docs/remote-access-setup) before testing away from the branch.

If the branch internet line is behind carrier-grade NAT, port forwarding cannot reach it. Omnix does not currently operate a relay, so that line needs a public address from the internet provider or a different connection before direct remote access can work.

## What the mesh routes

Private Mesh routes only the private Omnix subnet used by enrolled branch devices. Ordinary web browsing, video, messaging, banking apps, and other internet traffic continue to use the phone's normal Wi-Fi or mobile connection.

This is split routing, not a whole-phone consumer VPN. Omnix doesn't use the tunnel to hide your public IP address or move all phone traffic through the branch.

## Android permission

The first time you connect Private Mesh, Android shows its system VPN permission dialog. Accept it once so Android can create the Omnix tunnel. The prompt comes from Android even though WireGuard is already bundled in Omnix. While the tunnel is connected, Android keeps a persistent **Omnix Private Mesh** notification. Android requires that notification for the foreground VPN service, and it remains until the tunnel stops.

Android can ask again after the app is reinstalled, its storage is cleared, VPN permission is reset or revoked, or another VPN takes over Android's single VPN slot. Don't install another VPN app to answer this prompt. If you deny it, Omnix can still work on the branch LAN, but Private Mesh stays off until permission is granted.

## Connect a phone

Set up internet reachability first, then enrol the phone through the Windows desktop hub. The enrolment supplies the device identity and approved branch routes. Open **Profile** on Android, confirm the active branch, then tap **Connect Private Mesh**. The control shows the current mesh state and changes to **Disconnect Private Mesh** while the tunnel is running.

Test the first remote connection with Wi-Fi switched off on the phone. Wait for **Connected**, then refresh branch data or run a sync. Seeing **Connected** is not enough if the hub service itself is stopped, so confirm that fresh branch data arrives.

## Security boundaries

Each phone needs its own enrolment. Revoke a lost or retired device from the Windows hub so it can no longer join the mesh. A device still needs Omnix user and branch permission after the tunnel connects. Network reachability alone doesn't grant access to business records.

Forward only the WireGuard UDP port shown by Omnix. Do not expose the browser companion, branch service, database, or another Omnix port on the public internet. The browser companion remains read-only and LAN-only. Read [Connect the browser companion](/docs/browser-companion) for its network requirements.

## Troubleshooting

The app reports a specific mesh state instead of treating every failure as the same problem. [Set up remote access](/docs/remote-access-setup#understand-each-app-state) explains **Mesh not configured**, **Connecting**, **Connected**, **Hub unreachable**, **VPN permission denied**, and **Mesh unavailable**.`,
  },
  {
    slug: 'remote-access-setup',
    title: 'Set up Omnix remote access',
    excerpt: 'Publish the hub endpoint, reserve its LAN address, forward WireGuard UDP, allow it through Windows Firewall, and test from mobile data.',
    category: 'Integrations',
    icon: 'Globe',
    body: `Remote access lets an enrolled Omnix Android device reach its Windows hub through Private Mesh while it is away from the branch. WireGuard is bundled in the Windows and Android apps, but it cannot make an unreachable hub dialable. You must publish the hub endpoint and configure the branch router and Windows Firewall.

If the phone is on the same Wi-Fi or wired network as the hub, stop here. Same-network use needs none of this. Keep the hub running and connect both devices to the branch router.

## Check for a public IPv4 address first

1. Sign in to the branch router and open **Status**, **Internet**, or **WAN**. Write down its WAN IPv4 address.
2. From a browser using that same branch connection, open an external “what is my IP” service and note the IPv4 address it reports.
3. Compare the two addresses exactly.

If they match, the router has a public IPv4 address and can receive a direct port forward. If they differ, the connection is behind carrier-grade NAT, or CGNAT. Port forwarding cannot work on that line because the provider has another NAT layer in front of the branch router.

A WAN address in \`10.0.0.0/8\`, \`172.16.0.0/12\`, \`192.168.0.0/16\`, or \`100.64.0.0/10\` is not a public IPv4 address. Ask the internet provider for a public or static IPv4 address that accepts inbound UDP. If the provider cannot supply one, use another connection. A relay could cross CGNAT, but Omnix does not have a relay today.

## Publish the reachable endpoint in Omnix

On the Windows hub, open **Settings**, then **Network**, then **Omnix Private Mesh**. Enter the host that Android should dial:

- use the public IPv4 address if it is static
- use a DDNS hostname if the public address changes

Enter the WireGuard UDP port and publish the endpoint. Record the port. You will use that same number for the router's external port, internal port, and Windows Firewall rule.

Windows asks for administrator approval when you publish a different endpoint. Approve the Windows UAC prompt. Omnix changes the WireGuard listener and restarts the Private Mesh helper, so the tunnel may be unavailable briefly. Cancelling elevation leaves the new listener unpublished.

The panel shows the published host and port. That is configuration, not proof that the internet can reach the hub. **Observed public address** stays **Not observed**, while **UDP reachability** and **Connection type** stay **Unknown**, until Omnix has verified external evidence. Omnix does not infer success from the address you typed.

## Reserve a static LAN address for the hub

Open the router's **LAN** or **DHCP Server** settings. Find **Address Reservation**, **DHCP Reservation**, **Static Lease**, or the equivalent setting. Bind the Windows hub's network adapter MAC address to its current LAN IPv4 address, then save.

Reconnect the hub or renew its DHCP lease. Confirm that Windows receives the reserved address. Without the reservation, a router restart could assign a different address and leave the forwarding rule pointing at the wrong device.

## Forward the same UDP port to the hub

Open **NAT**, **Port Forwarding**, **Port Mapping**, or **Virtual Server** in the router and add one rule:

- protocol: **UDP** only
- external or public port: the WireGuard UDP port published in Omnix
- internal or private port: the same port
- destination or server address: the hub's reserved LAN IPv4 address
- status: enabled

Save the rule. No TCP forward is needed. Do not forward the browser companion, branch service, database, or any other Omnix port to the internet.

## Allow the UDP port through Windows Firewall

First set the branch connection to a **Private network** in Windows. Then open **Windows Security**, **Firewall & network protection**, **Advanced settings**, **Inbound Rules**, and **New Rule**. Choose **Port**, select **UDP**, enter the published WireGuard port under **Specific local ports**, choose **Allow the connection**, and apply the rule to the hub's active network profile. Name it \`Omnix Private Mesh\`.

If an Omnix firewall rule for that exact UDP port already exists and is enabled for the active profile, don't add a duplicate. A rule for TCP or a different port does not help.

## Router setting names used in Kenya

Safaricom-supplied routers vary by manufacturer. Use **LAN** or **DHCP** plus **Address Reservation** or **Static Lease** for the hub address. The forwarding page is usually named **NAT**, **Forward Rules**, **Port Mapping**, **Port Forwarding**, or **Virtual Server**. If the provider login hides those controls, ask Safaricom whether the line has a public IPv4 address and whether customer UDP forwarding is enabled.

Zuku also supplies more than one router type. Look under **LAN Setup** or **DHCP** for the reservation, then **Advanced**, **NAT**, **Port Forwarding**, or **Virtual Server** for the UDP rule. If the WAN address differs from the external address, ask Zuku for public IPv4 service. Changing more settings on the router will not bypass CGNAT.

On a generic TP-Link router, use **DHCP Server** and **Address Reservation** for the hub. Add the UDP rule under **NAT Forwarding** and **Virtual Servers** or **Port Forwarding**. TP-Link firmware names differ, so follow those standard section names rather than instructions written for another model.

On MikroTik RouterOS, open **IP**, **DHCP Server**, **Leases** and make the hub lease static. Under **IP**, **Firewall**, **NAT**, add a \`dstnat\` rule for protocol \`udp\` and the published destination port on the WAN interface or WAN interface list. Set the action to \`dst-nat\` and send it to the hub's reserved address and the same port. Confirm the forward chain permits traffic accepted by that destination-NAT rule.

## Use DDNS for a changing public address

A changing public address will eventually make a published numeric endpoint stale. Configure **Dynamic DNS** or **DDNS** in the router, or run a DDNS updater on an always-on branch machine. Confirm that the hostname resolves to the IPv4 address reported by the external service.

Return to **Settings**, **Network**, **Omnix Private Mesh** and publish the DDNS hostname with the same UDP port. Approve elevation again so Omnix can update the listener and restart the helper. The router forward and Windows Firewall rule do not change because the port remains the same.

## Test away from the branch

1. Leave Omnix and its Private Mesh helper running on the Windows hub.
2. Check that the hub still has its reserved LAN address. Confirm the UDP forwarding and firewall rules are enabled.
3. Enrol and approve the Android device in Omnix.
4. Switch off Wi-Fi on the phone so it is using mobile data, then tap **Connect Private Mesh**.
5. Accept Android's VPN permission prompt if this is the first connection. Wait for **Connected** and check for the persistent **Omnix Private Mesh** notification.
6. Refresh branch data or run a sync. A fresh result is the useful proof that Android reached the hub through the tunnel.

Test from mobile data, not the branch Wi-Fi. Some routers cannot loop their public endpoint back into the same LAN. Online port checkers are often poor UDP tests as well.

## Understand each app state

- **Mesh not configured** means the device has no complete mesh setup. Install Private Mesh on the Windows hub, publish its host and UDP port, then enrol and approve Android. Same-network use can still work.
- **Connecting** means Android started the tunnel and is waiting for the hub. If it stays here, check mobile internet, the published host, DDNS, the UDP port, router forwarding, Windows Firewall, and whether the helper is running.
- **Connected** means the tunnel connected. Refresh branch data or complete a sync before treating remote access as verified. If no fresh data arrives, check the branch service on the hub.
- **Hub unreachable** means Android cannot get a usable response from the published endpoint. Check hub power, the helper, DDNS, the reserved LAN address, Windows Firewall, and the UDP forward. Repeat the WAN-versus-external-address comparison. Port forwarding cannot fix CGNAT.
- **VPN permission denied** means Android did not allow Omnix to create the tunnel. Tap **Connect Private Mesh** again and accept Android's system VPN prompt. If it does not reappear, open Android's VPN settings. Disconnect another always-on VPN if it holds Android's VPN slot.
- **Mesh unavailable** means this build or device cannot start the bundled mesh service. Private Mesh is implemented on supported Windows hubs and Android clients. It is not available in the browser companion or on iOS. Update Omnix, restart the device, and complete the Windows Private Mesh installation and UAC prompt. Contact Omnix support if the state remains.
- **Not observed** under **Observed public address** means Omnix has no verified external address observation yet. It does not mean the typed host is wrong, and it does not prove the port is reachable.
- **Unknown** under **UDP reachability** or **Connection type** means there is not enough verified external evidence to classify the line. Check the router WAN address yourself, finish the UDP forward and firewall rule, then test with Android on mobile data. Do not read **Unknown** as success.

## What Android changes

Android asks for VPN permission once when Private Mesh first connects. It can ask again after the app is reinstalled, its storage is cleared, permission is revoked, or another VPN takes over. While connected, Android shows a persistent **Omnix Private Mesh** notification.

Only the private Omnix subnet goes through the tunnel. Ordinary browsing, messaging, video, banking, updates, and payment traffic keep using the phone's normal Wi-Fi or mobile route. The tunnel encrypts Omnix traffic and authenticates enrolled peers. WireGuard is bundled, so there is no WireGuard account to create and no separate WireGuard app to install.`,
  },

  // ─── SCAFFOLDS (20) ───────────────────────────────────────────────────
  {
    slug: 'ai',
    title: 'AI assistant',
    excerpt: 'The in-app AI concierge — what it can do, which provider to choose, how to bring your own key, and how to disable it.',
    category: 'Core',
    icon: 'Sparkle',
    body: `Every Omnix variant ships with an in-app AI assistant — a slide-out chat panel that knows the entire product, KRA / NHIF / SHA flows, M-Pesa, and your live data. It can navigate, search, summarise, and explain eTIMS errors in plain English.

## Open the assistant

Press **Ctrl+J** anywhere in the app, or click the sparkle button bottom-right. The panel slides in from the right; press **Esc** or click outside to close.

## What it can do today

The assistant has read-only access to a handful of tools:

- \`navigate(route)\` — opens any screen in Omnix in one tap
- \`getTodaySales()\` — today's revenue, count, and payment-method breakdown
- \`getInventoryAlerts()\` — products at or below reorder level
- \`searchProducts(q)\` — find by name, SKU, or barcode (top 10)
- \`searchCustomers(q)\` — find by name, phone, or email (top 10)
- \`getRecentSales(limit)\` — list the last N sales
- \`openDocs(slug?)\` — opens this docs site to the right page

It cannot yet create / update / delete records. Mutations ship in v0.5 with a confirmation flow.

## Bring your own model

Open **Settings → AI**. Pick a provider, paste an API key, save. The assistant uses your key for every call.

- Groq — free tier, very fast (console.groq.com)
- OpenRouter — free + premium models (openrouter.ai)
- Google — free Gemini Flash (aistudio.google.com)
- OpenAI — pay per token (platform.openai.com)
- Anthropic — pay per token (console.anthropic.com)
- DeepSeek — pay per token (platform.deepseek.com)
- Custom — any OpenAI-compatible URL

Switch providers any time. Keys are encrypted at rest with AES-256.

## Privacy

Calls go directly from your machine to the provider you chose. Omnix never sees your prompts, your responses, your keys, or your live data. Disable the assistant entirely from **Settings → AI → Disable** — the button hides and no AI traffic leaves the app.

## Variant-aware persona

Each Omnix variant biases the assistant toward its trade. Omnix Dawa speaks chemist vocabulary (prescriptions, expiry, controlled register, SHA). Omnix Hospitality speaks chef vocabulary (tables, KOT, recipes, food cost). A multi-trade install adapts to whichever module you're currently in.

## Useful starter prompts

- "What did we sell today?"
- "What's running low?"
- "Explain this eTIMS error: CU-12345"
- "Find me Panadol Extra"
- "Auto-fill this product's description"
- "How do I file VAT3 with KRA?"
- "Take me to today's Z-report"`,
  },
  {
    slug: 'banking',
    title: 'Banking & reconciliation',
    excerpt: 'Record bank accounts, transfers, and reconcile statements against your books.',
    category: 'Core',
    icon: 'Bank',
    body: scaffold('Banking', 'Track bank accounts, deposits, transfers, and reconcile against statements.', ['Adding a bank account', 'Recording deposits and withdrawals', 'Transfers between accounts', 'Reconciling a statement']),
  },
  {
    slug: 'payroll',
    title: 'Payroll & statutory',
    excerpt: 'Run monthly payroll with PAYE, NHIF/SHA, NSSF, and housing levy deductions.',
    category: 'Core',
    icon: 'Users',
    body: scaffold('Payroll', 'Run payroll for your staff with all Kenyan statutory deductions.', ['Adding employees', 'Salary structure and allowances', 'PAYE, NSSF, SHA, housing levy', 'Generating payslips', 'Month-end payroll run']),
  },
  {
    slug: 'sales',
    title: 'Sales & receipts',
    excerpt: 'Review sales history, reprint receipts, and understand the daily Z-report.',
    category: 'Core',
    icon: 'Receipt',
    body: scaffold('Sales', 'Every completed sale lives here — searchable, reprintable, reportable.', ['Browsing sales history', 'Reprinting a receipt', 'The daily Z-report', 'Voids and their audit trail']),
  },
  {
    slug: 'customers',
    title: 'Customers & credit',
    excerpt: 'Manage customer profiles, credit limits, and account statements.',
    category: 'Core',
    icon: 'UserCircle',
    body: scaffold('Customers', 'Track customers, their credit limits, and lifetime value.', ['Adding a customer', 'Setting a credit limit', 'Charging a sale to account', 'Customer statements']),
  },
  {
    slug: 'suppliers',
    title: 'Suppliers',
    excerpt: 'Keep supplier records and link them to purchase orders.',
    category: 'Core',
    icon: 'Truck',
    body: scaffold('Suppliers', 'Manage who you buy from.', ['Adding a supplier', 'Supplier contact and terms', 'Linking to purchase orders']),
  },
  {
    slug: 'purchases',
    title: 'Purchases & GRN',
    excerpt: 'Raise purchase orders, receive goods, and update stock.',
    category: 'Core',
    icon: 'ClipboardText',
    body: scaffold('Purchases', 'From purchase order to goods-received note.', ['Creating a purchase order', 'Receiving goods (GRN)', 'Handling partial deliveries', 'Cost updates on receipt']),
  },
  {
    slug: 'expenses',
    title: 'Expenses',
    excerpt: 'Record business expenses and categorise them for the P&L.',
    category: 'Core',
    icon: 'Wallet',
    body: scaffold('Expenses', 'Capture every shilling out.', ['Recording an expense', 'Expense categories', 'Petty cash', 'Expenses in the P&L']),
  },
  {
    slug: 'pnl',
    title: 'Profit & loss',
    excerpt: 'Read your P&L statement and understand your margins.',
    category: 'Core',
    icon: 'ChartLine',
    body: scaffold('P&L', 'Your profit and loss at a glance.', ['Reading the P&L', 'Revenue vs cost of goods', 'Gross and net margin', 'Period comparisons']),
  },
  {
    slug: 'reports',
    title: 'Reports',
    excerpt: 'Sales, inventory valuation, Z-report, and the daily operations book.',
    category: 'Core',
    icon: 'ChartBar',
    body: scaffold('Reports', 'Every report Omnix offers.', ['Sales reports', 'Inventory valuation', 'Z-report', 'Daily operations / day book', 'Exporting to Excel/PDF']),
  },
  {
    slug: 'insurance-claims',
    title: 'Insurance claims',
    excerpt: 'SHA and private insurance: member verification, copay split, and claim batches.',
    category: 'Modules',
    icon: 'ShieldCheck',
    body: scaffold('Insurance', 'Process SHA and private insurance claims at the till.', ['Verifying a member', 'Copay vs claim split', 'Building a claim batch', 'Settling a batch', 'Reconciling payer payments']),
  },
  {
    slug: 'pharmacy',
    title: 'Pharmacy (Dawa)',
    excerpt: 'Dispensing, drug interactions, controlled substances, and patient profiles.',
    category: 'Modules',
    icon: 'FirstAid',
    body: scaffold('Dawa', 'The pharmacy module — built for Kenyan chemists.', ['Dispensing a prescription', 'Drug interaction checks', 'Controlled substance register', 'Patient profiles and allergies', 'Expiry management']),
  },
  {
    slug: 'retail',
    title: 'Retail',
    excerpt: 'Brands, variants, laybys, special orders, and shrinkage tracking.',
    category: 'Modules',
    icon: 'Storefront',
    body: scaffold('Retail', 'Tools for mini-marts and general retail.', ['Brands', 'Variants', 'Laybys', 'Special orders', 'Shrinkage tracking']),
  },
  {
    slug: 'hardware',
    title: 'Hardware & building',
    excerpt: 'Quotations, delivery notes, contractor accounts, and commissions.',
    category: 'Modules',
    icon: 'Wrench',
    body: scaffold('Hardware', 'For hardware shops and building suppliers.', ['Quotations', 'Delivery notes', 'Contractor accounts', 'Sales commissions', 'Bulk pricing tiers']),
  },
  {
    slug: 'hospitality',
    title: 'Hospitality',
    excerpt: 'Restaurant POS, kitchen display, tables, rooms, bookings, folios, and recipes.',
    category: 'Modules',
    icon: 'ForkKnife',
    body: scaffold('Hospitality', 'Restaurant and hotel operations.', ['Menu and items', 'Tables and floor plan', 'Kitchen display (KOT)', 'Rooms and bookings', 'Folios', 'Recipe costing']),
  },
  {
    slug: 'multi-branch',
    title: 'LAN multi-device sync',
    excerpt: 'Run multiple tills on one shop network with a master/client setup.',
    category: 'Core',
    icon: 'Network',
    body: scaffold('LAN sync', 'Pair multiple devices over your shop network.', ['Master vs client', 'Pairing a new device', 'How sync works offline', 'Revoking a device']),
  },
  {
    slug: 'mpesa',
    title: 'M-Pesa (Daraja & Paystack)',
    excerpt: 'Accept M-Pesa via STK push, Paybill/Till, or Paystack. Step-by-step on getting every key and entering it.',
    category: 'Integrations',
    icon: 'CreditCard',
    body: `Omnix gives you three ways to take M-Pesa. Pick whichever matches how your business already collects money. This guide covers the FULL process — including everything you do on Safaricom's own websites, not just where to paste keys in Omnix.

## Which one do I need?

- **Manual Paybill / Till** — easiest. You already have a Safaricom Paybill or Buy-Goods Till. The customer pays it directly, and the cashier records the M-Pesa confirmation code. No API keys, works today.
- **Daraja STK push** — the customer gets a pop-up on their phone to enter their PIN; the sale closes automatically. Needs a registered Paybill/Till AND Safaricom Daraja API keys (both free).
- **Paystack** — takes M-Pesa *and* cards through one provider. Easiest keys to get; small per-transaction fee. See the [Paystack guide](/docs/paystack-keys).

---

## Part 1 — Get a Paybill or Till from Safaricom

You need one of these for STK push (and for the manual flow). If you already have a business Paybill/Till, skip to Part 2.

**Paybill vs Till — which to apply for?**
- **Till (Buy Goods)** — best if you only collect payments. Simple.
- **Paybill** — best if you need an account number per customer or want to track who paid for what. Supports everything a Till does, plus more. We recommend a **Paybill** for flexibility.

> Important: a *personal* Till/Paybill (the kind you get over USSD) **cannot** be used for API integration. You must apply for a **business** shortcode.

**Documents you'll need (scan each to PDF, stamped + signed):**
- Paybill/Till application form (download from the M-Pesa Business portal)
- Tariff guide acceptance
- Account opening form
- Admin account creation form
- Administrator letter
- Bank letter OR a cancelled cheque
- KRA PIN certificate
- Copy of the director's ID or passport

**How to apply:**
1. Go to the [M-Pesa Business portal](https://m-pesaforbusiness.co.ke) and create an account (or log in).
2. Upload all documents as PDFs. Make sure everything is stamped and signed.
3. Submit. Safaricom processes applications within about **72 hours**.
4. *(Alternative)* Email a single combined PDF to **M-PESABusiness@safaricom.co.ke**, CC **paybill@safaricom.co.ke**, subject "Paybill or Till Application".

When approved, you'll receive your **shortcode** (the Paybill or Till number) plus access to the **M-Pesa Org portal** (org.ke.m-pesa.com) to manage operators.

---

## Part 2 — Manual M-Pesa (no API keys)

If you have a Paybill/Till but don't want to wire the API yet, you can start taking M-Pesa today:

1. In Omnix, open **Settings → Payments → Manual M-Pesa (Paybill / Till)**.
2. Enter your **Paybill number** (and the account-number convention customers should use), or your **Buy Goods Till number**.
3. Save.

At the till, when the cashier picks **M-Pesa**, Omnix shows the Paybill/Till in big numbers to read out. The customer pays on their phone, then the cashier types the M-Pesa confirmation code (from the SMS) into the reference box and completes the sale.

---

## Part 3 — Daraja STK push (the automatic flow)

This is what makes the customer's phone buzz with a PIN prompt and closes the sale hands-free. You do this on Safaricom's **Daraja Developer Portal**.

### Step 1 — Create a Safaricom Developer account
Go to [developer.safaricom.co.ke](https://developer.safaricom.co.ke) and sign up. Verify your email and log in.

### Step 2 — Create an app
On the portal dashboard, click **Add a new app**. Give it a name (e.g. "Omnix POS"). Tick the **Lipa Na M-Pesa Online** (and optionally **M-Pesa Sandbox**) products. Create it.

### Step 3 — Copy your Consumer Key + Consumer Secret
Open the app you just created. You'll see a **Consumer Key** and a **Consumer Secret**. These are your API credentials.

### Step 4 — Get your Passkey
Your Passkey is tied to your shortcode and the **Lipa Na M-Pesa Online** product:
- **Sandbox (testing):** the portal's "Simulate" / "Test Credentials" page shows the sandbox shortcode (**174379**) and its passkey — use these to trial before going live.
- **Production:** once your business shortcode is live, the passkey is issued with your go-live credentials (request it via the Daraja portal's "Go Live" flow, or from your Safaricom account manager).

### Step 5 — Go live
In the Daraja portal, run the **Go Live** wizard for your app. It validates your shortcode and issues production credentials. Until then, keep using the sandbox values with Test mode ON.

### Step 6 — Enter everything in Omnix
Open **Settings → Payments → M-Pesa Daraja (Direct)** and paste:
- Consumer Key
- Consumer Secret
- Passkey
- Shortcode (Paybill or Till number)

Leave **Test mode** ON while trialling with sandbox values; switch it OFF when you paste live credentials. Click **Connect** — Omnix verifies the keys immediately.

---

## Reconciling payments

Every M-Pesa payment is stored against the sale with its transaction code, so you can match it to your M-Pesa statement. Daraja STK and Paystack record the code automatically; manual Paybill/Till uses whatever code the cashier entered.

## When STK push hangs

The Safaricom sandbox (and occasionally production) can leave a request "pending". After 90 seconds Omnix shows **Mark as paid manually** — the cashier reads the M-Pesa code off the customer's SMS and confirms, so the till is never blocked.`,
  },
  {
    slug: 'paystack-keys',
    title: 'Get your Paystack keys',
    excerpt: 'Sign up for Paystack in Kenya, complete onboarding on their site, and copy your API keys into Omnix.',
    category: 'Integrations',
    icon: 'CreditCard',
    body: `Paystack lets Omnix take both M-Pesa and card payments through one provider. This guide covers the entire process on Paystack's own website, then where to paste the keys in Omnix.

## Part 1 — Create your Paystack account

1. Go to [paystack.com/signup](https://paystack.com/signup). Paystack is live for Kenyan businesses.
2. Sign up with your business email and set a password.
3. Verify your email (check your inbox for the link).
4. When prompted for your country, choose **Kenya** — this sets your settlement currency to KES and enables M-Pesa.

## Part 2 — Complete business onboarding (on the Paystack dashboard)

Paystack must verify your business before you can accept *live* payments. You can build + test immediately with test keys, but go-live needs:

1. On the Paystack dashboard, open **Settings → Compliance** (sometimes "Get Started" / "Activate Business").
2. Provide:
   - **Business type** (registered company, sole proprietor, etc.)
   - **KRA PIN**
   - A **settlement bank account** in your business name — this is where your money lands
   - A **valid ID** for the business owner / director
   - Your business address + phone
3. Submit. Approval is usually same-day to a couple of business days. You'll get an email when you're activated.

## Part 3 — Copy your API keys

1. On the Paystack dashboard, go to **Settings → API Keys & Webhooks**.
2. You'll see two key pairs:
   - **Test** keys (\`pk_test_…\` / \`sk_test_…\`) — use while trialling.
   - **Live** keys (\`pk_live_…\` / \`sk_live_…\`) — appear once your business is activated. Flip the dashboard to **Live mode** (top toggle) to see them.
3. Copy the **Public Key** (\`pk_…\`) and **Secret Key** (\`sk_…\`).

> The secret key is sensitive — Omnix stores it encrypted on your machine and never shows it again. Never share it or commit it anywhere.

## Part 4 — Enter the keys in Omnix

1. Open **Settings → Payments → Paystack**.
2. Paste the Public and Secret keys.
3. Keep **Test mode** ON while trialling (use the test card 4084 0840 8408 4081, any future expiry, CVV 408); switch it OFF once you paste live keys.
4. Click **Connect** — Omnix verifies the keys against Paystack immediately.

## Card payments

When a cashier picks **Card**, Omnix opens Paystack's secure hosted popup. Card details never touch Omnix — Paystack handles 3-D Secure and fraud checks — so you stay out of PCI scope and avoid fraud-flag rejections.

## Fees

Paystack charges roughly **1.5% on M-Pesa** and **2.9% on local cards** (confirm your exact tariff with Paystack). Record your negotiated rate in **Settings → Payments → Service charges** so reports show net revenue.`,
  },
  {
    slug: 'ai-keys',
    title: 'Get your AI key',
    excerpt: 'Choose an AI provider, create an account + key on their site, and paste it into Omnix.',
    category: 'Integrations',
    icon: 'Sparkle',
    body: `The Omnix AI assistant works with several providers. You bring your own key, so you only pay the provider for what you use — Omnix adds no markup. This guide covers creating the account + key on each provider's site.

## Which provider?

- **Groq** — free tier, extremely fast. Best place to start. [console.groq.com](https://console.groq.com)
- **OpenRouter** — one key, access to many models, pay-as-you-go. [openrouter.ai](https://openrouter.ai)
- **Anthropic (Claude)** — highest answer quality, paid. [console.anthropic.com](https://console.anthropic.com)

## Groq (recommended to start)

1. Go to [console.groq.com](https://console.groq.com) and sign up (Google sign-in works).
2. In the console sidebar, open **API Keys**.
3. Click **Create API Key**, name it "Omnix", and copy the key (starts with \`gsk_…\`). It's shown once — copy it now.
4. Groq's free tier needs no card. For higher limits, add billing under **Settings → Billing**.

## OpenRouter

1. Go to [openrouter.ai](https://openrouter.ai) and sign up.
2. Add credit under **Credits** (pay-as-you-go; start with a few dollars).
3. Open **Keys → Create Key**, name it, and copy the key (starts with \`sk-or-…\`).

## Anthropic (Claude)

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign up.
2. Add a payment method under **Billing** and buy credits.
3. Open **API Keys → Create Key**, name it, and copy the key (starts with \`sk-ant-…\`).

## Enter it in Omnix

1. Open **Settings → AI**.
2. Pick your provider from the dropdown.
3. Paste the key and save. Omnix stores it encrypted on your machine.
4. Press **Ctrl+J** anywhere to open the assistant.

## Cost control

Set a spending limit in your provider's dashboard. The assistant is opt-in per query — it never calls the provider unless you ask it something.`,
  },
  {
    slug: 'licence-activation',
    title: 'Licence & activation',
    excerpt: 'How licensing works, machine binding, and transferring to a new device.',
    category: 'Billing',
    icon: 'Key',
    body: scaffold('Licensing', 'Everything about your Omnix licence.', ['How per-machine licensing works', 'Finding your machine ID', 'Transferring to a new device', 'Maintenance and updates window']),
  },
  {
    slug: 'trial-to-buy',
    title: 'Trial to purchase',
    excerpt: 'Buy a licence mid-trial without losing your data.',
    category: 'Billing',
    icon: 'ShoppingBag',
    body: scaffold('Trial to buy', 'Upgrade from trial to a paid licence seamlessly.', ['Buying during a trial', 'What happens to your data', 'Entering your new key', 'Pricing — pay once, no subscription']),
  },
  {
    slug: 'permissions',
    title: 'Users & permissions',
    excerpt: 'Roles, groups, and the access model that keeps cashiers out of the books.',
    category: 'Basics',
    icon: 'Lock',
    body: scaffold('Permissions', 'Control who can do what.', ['Roles and the permission matrix', 'Groups', 'Creating a cashier vs manager', 'The access explorer / audit']),
  },
  {
    slug: 'install-troubleshooting',
    title: 'Install troubleshooting',
    excerpt: 'SmartScreen warnings, antivirus false positives, and rare startup issues.',
    category: 'Troubleshooting',
    icon: 'Warning',
    body: `Most Omnix installs succeed in a single click. When they don't, it's almost always one of these.

## SmartScreen warning

Windows shows a "Windows protected your PC" dialog for any installer not signed by an extended-validation certificate. Click **More info → Run anyway**. The installer is verified by a SHA-256 hash shown on the downloads page.

## Antivirus false positive

Some AV tools flag the installer because it bundles SQLite and writes to a local data directory — a heuristic false positive, not a real threat. Add the installer to your AV exclusions, or wait 24 hours for the vendor to auto-clear it.

## "Database is locked"

Rare. Happens if Omnix is force-killed mid-write. Restart your machine; SQLite recovers cleanly. If it persists, send a diagnostic from Settings → Help.`,
  },

  // ─── v0.10 priority docs ────────────────────────────────────────────
  {
    slug: 'receiving-stock',
    title: 'Receiving stock',
    excerpt: 'Manual receive vs PO-receive vs reverse-GRN. How batches get created, when stock_qty updates, what each path means for your books.',
    category: 'Core',
    icon: 'PackageDuotone',
    body: `Receiving stock is the single most-used flow after the till. There are three paths, and they all create the same downstream effect: a new \`batches\` row, a stock_movement record, and an updated supplier balance. Where they differ is the audit trail and what happens to the related PO.

## 1. Manual receive (no PO)

Use this for petty replenishment — e.g. you bought a box of chewing gum from the kiosk next door for the till. Open Inventory → Products → Receive Stock, search for the product, set quantity + unit cost + batch number + expiry. Click Save. Omnix inserts a batch and increments the on-hand count.

There is no PO, no GRN, no three-way match — just a stock movement of type \`purchase\` with reference_type \`manual_receive\`. Use sparingly; for anything bigger than a single SKU you want a PO.

## 2. Receive against a PO

The standard flow. Open Purchases → the PO → Receive. The dialog pre-fills line items from the PO, lets you edit received quantity per line (so partial receipts work), records the supplier invoice number for three-way match, and creates the GRN.

What gets written:
- A \`goods_receipts\` row with a sequential GRN number (GRN-XXXXX)
- One \`goods_receipt_items\` per received line
- One new \`batches\` row per product (so you can FIFO out of it later)
- One \`stock_movement\` per batch
- Updated \`received_quantity\` on each PO line — the PO status flips to \`partial\` or \`received\` based on cumulative coverage
- Supplier \`balance_owed\` increments by the GRN total

## 3. Receive from product detail (#42)

A shortcut: from any product detail page click the **Receive stock** button at the top right. The same dialog opens but with the product pre-loaded in the line list. This is the fastest path when you know exactly what you're receiving and don't want to hunt through the supplier's PO.

This path always **adds** to existing stock (it inserts a batch). It never overwrites the on-hand quantity — that's a deliberate guarantee, because overwriting would silently destroy older batches.

## Reverse-GRN

If you discover a receiving error (wrong supplier, double-counted line, expiry typed wrong), use Purchases → GRN list → the GRN → Reverse. Omnix:

1. Refuses if any of the originally-received batches have been partially sold or transferred. Those goods are out of the warehouse — you need a stock adjustment, not a reverse-GRN.
2. Deletes the \`batches\` rows and corresponding \`stock_movements\`.
3. Resets \`received_quantity\` on each PO line item.
4. Recomputes PO status (likely back to \`partial\` or \`sent\`).
5. Decrements the supplier's \`balance_owed\`.
6. Stamps the GRN with \`reversed_at\` + \`reversed_by\` so the original record stays in the audit log.

## What ends up in your books

Every receive path writes the unit cost into \`batches.buying_price\`. Every COGS calculation downstream — P&L, day book, top products, dead stock — reads from there. Get the unit cost right at receive time and your reports will be right forever.`,
  },
  {
    slug: 'purchase-orders',
    title: 'Purchase orders',
    excerpt: 'Full PO lifecycle: draft → approval → sent → partial → received. Three-way match, mixed currency, reverse-GRN, approval threshold.',
    category: 'Core',
    icon: 'ClipboardText',
    body: `A purchase order is a contract — yours, with the supplier. Omnix tracks every state transition so when something goes wrong (price drift, short delivery, currency dispute) you have the receipts.

## States

\`\`\`
draft
  ↓
pending_approval (only if total >= approval threshold)
  ↓
approved
  ↓
sent (sent to supplier — stock starts arriving)
  ↓
partial → received (driven by GRN cumulative quantities)
  ↓
[paid]
\`\`\`

\`cancelled\` is reachable from any state. Once a PO is \`cancelled\` no further GRNs can be applied against it.

## Approval threshold

Settings → Purchasing → Approval Threshold. Default is **KES 100,000**. POs with a total at or above the threshold transition through \`pending_approval\` instead of going straight to \`sent\`. An owner or admin clicks Approve — Omnix records the approver + timestamp.

You can disable the gate entirely (Settings → Purchasing → Required = off) for businesses that don't need a separation-of-duties workflow.

## Three-way match

Three-way match compares PO total ↔ GRN total ↔ supplier-invoice total. Tolerance defaults to **1%** (Settings → Purchasing → Tolerance). When you mark a PO as paid, Omnix runs the match and refuses if any pair drifts beyond tolerance. To unblock: reverse a GRN and re-receive at the right quantity, edit the supplier invoice total to match what you actually received, or override (recorded with a written reason in the audit log).

## Mixed currency

When you create a PO with a foreign supplier, set the PO currency (USD, EUR, CNY, etc.) and the exchange rate. Line items stay in foreign currency on the PO. The moment goods are received Omnix snapshots the rate **at GRN time** and writes cost-of-goods into \`batches.buying_price\` in your base currency (KES). So your P&L stays correct even if the rate moves between order and delivery.

The original foreign-currency line item is preserved on the GRN for audit. The base-currency cost goes into the books.

## Partial receipts

POs frequently arrive in batches. Open the PO, click Receive, set received quantity per line — for lines that haven't fully arrived just enter the quantity that did. Omnix flips the PO status to \`partial\`. Receive the rest later; status flips to \`received\` once all lines are at-or-above their ordered quantity.

## See also

- [Receiving stock](/docs/receiving-stock) — the receive flow itself
- [Suppliers](/docs/suppliers) — supplier ledger + balances`,
  },
  {
    slug: 'vat3-filing',
    title: 'VAT3 filing',
    excerpt: 'How Omnix populates the VAT3 PDF, what to copy into iTax, how to reconcile the figures with eTIMS.',
    category: 'Integrations',
    icon: 'Receipt',
    body: `VAT3 is the monthly KRA return that summarises your taxable supplies (sales) and taxable purchases. Omnix doesn't file directly with KRA (the iTax API isn't open to third parties) — but it does the hard part: producing a populated VAT3 PDF in your business colours so you can copy figures into iTax in five minutes instead of fifty.

## When to file

By the **20th of the following month**, on iTax. Late filers pay a penalty.

## How Omnix populates the figures

Open Reports → VAT Report. Pick the period (defaults to the current month). Omnix queries:

- **Total taxable supplies (sales) — net**: sum of \`sales.subtotal\` for completed sales in the period where the customer was VAT-applicable.
- **Output VAT @ 16%**: sum of \`sales.tax_amount\` over the same set.
- **Total taxable purchases — net**: sum of \`goods_receipts.total\` net of VAT for the period.
- **Input VAT @ 16%**: derived from the GRN total at the configured VAT rate.
- **Payable**: output VAT minus input VAT. Negative values mean a credit carried forward.

Click the PDF button. The output is an A4 PDF with your masthead, KRA PIN, period, every line above, and a payable/credit line at the bottom.

## What to copy across

Open the iTax web portal → File Returns → VAT (VAT3). The form mirrors the PDF. Copy figure-by-figure:
- Line A1: total taxable supplies → from PDF row 1
- Line A2: output VAT → from PDF row 2
- Line B1: total taxable purchases → from PDF row 3
- Line B2: input VAT → from PDF row 4

Submit. Pay any payable through your bank or M-Pesa per KRA's payment instructions.

## Reconciling with eTIMS

eTIMS is the receipt-signing layer. Every sale you ring up gets signed in real time and the figures are visible on the KRA portal too. Cross-check:

1. Pull your eTIMS dashboard summary for the period
2. Compare with the Omnix VAT3 PDF
3. They should match. If not, the most common cause is a sale completed offline that hasn't yet synced to eTIMS — Settings → eTIMS → queue shows pending submissions

## Edge cases

- **Sales returns**: Omnix subtracts returned VAT from output VAT automatically.
- **Mixed-rate goods**: products with a non-16% VAT rate are computed at their saved rate, not 16%.
- **Zero-rated exports**: zero-rated supplies show in the supplies total but contribute zero VAT.

## See also

- [eTIMS integration](/docs/etims) — receipt signing
- [Reports](/docs/reports) — every report PDF`,
  },
  {
    slug: 'p9-p10-filing',
    title: 'P9 & P10 filing (PAYE)',
    excerpt: 'How to run payroll, generate P9 yearly certificates, file P10 monthly batches with iTax. Filing calendar, common gotchas.',
    category: 'Integrations',
    icon: 'Wallet',
    body: `PAYE is Kenya's pay-as-you-earn tax. As an employer you do two things every year:

1. **Every month**: file a P10 batch with KRA listing every employee's pay + deductions, and pay the PAYE total.
2. **Every year (by 28 February)**: issue every employee a P9 certificate showing their year's earnings + tax paid.

Omnix handles both as one-click PDFs.

## Run the monthly payroll

Open HR → Payroll → New run. Pick the period (auto-defaults to the current month). For each employee Omnix computes:

- **Gross pay**: basic salary + benefits + overtime − unpaid leave
- **PAYE**: banded by the current Finance Act (auto-updated)
- **NSSF**: Tier 1 + Tier 2
- **SHIF**: 2.75% of gross
- **Housing Levy**: 1.5% of gross
- **Reliefs**: personal (KES 2,400/month) + insurance + disability + mortgage + pension contributions
- **Net pay**: gross − all deductions + reliefs

Review. Approve. Once approved the figures lock — nothing changes after this point.

## Pay everyone

Click M-Pesa Salary Export. Omnix generates a CSV in the exact column shape Safaricom's Business M-Pesa portal expects (phone, amount, reference). Upload it, approve from your phone, salaries land.

## File P10 with KRA

Click the P10 button. Omnix prints a single PDF batch with every employee's row: employee #, name, KRA PIN, gross, PAYE, NSSF, SHIF, Housing Levy. Totals at the bottom.

Open iTax → File Returns → PAYE → P10. Copy the totals across. Submit. Pay the PAYE total via M-Pesa or bank.

## Issue P9 certificates (year-end)

By 28 February of the following year. HR → Payroll → P9 certificates → Generate. One PDF per employee with their year's monthly summary. Distribute via the dashboard (employees can sign in and download themselves) or print + hand out.

## Filing calendar

| Date | Action |
|---|---|
| 9th of each month | File last month's P10 + pay PAYE total |
| 28 February | Issue P9s for the previous tax year |

## Mid-month hires + terminations

Omnix prorates basic salary by working days. Final-month adjustments (severance, gratuity) live as line items on the run. The P9 reflects only the months the employee was active.

## See also

- [Omnix products](/modules) — the five products payroll ships inside
- [Sample P10 PDF](/samples/p10-sample.pdf)
- [Sample P9 PDF](/samples/p9-sample.pdf)`,
  },
  {
    slug: 'customer-display',
    title: 'Customer display setup',
    excerpt: 'Open a second-monitor cashier display, configure idle playlist (image / video / iframe), per-module privacy mode.',
    category: 'Modules',
    icon: 'MonitorPlay',
    body: `Customer display is a separate Tauri window that runs on a second monitor facing the customer. It mirrors the cart in real time and shows your branding when the till is idle.

## Hardware

Plug a second monitor into the same Windows machine the till runs on. Any HDMI / USB-C / DisplayPort works — Omnix doesn't care.

## Open it

Settings → Customer Display → Open Display. A new window appears titled "Customer Display". Drag it to the second monitor. Right-click the title bar → Move to Other Screen if your OS doesn't auto-detect. Once it's positioned, leave it open.

## What the customer sees

Three states:

1. **Idle** — your business logo, name, current time and date. Or the playlist if you've configured one.
2. **Active sale** — clean cart breakdown: each line item with quantity + unit price + line total, subtotal, discount, tax, grand total in big bold tabular numbers.
3. **Paid** — brief "Paid · KES X" panel for 6 seconds after a sale completes, then back to idle.

## Idle playlist

Settings → Customer Display → Idle playlist. Add slides:

- **Image**: a JPG/PNG promo. Use full-screen 1920×1080 or larger; smaller images get scaled.
- **Video / YouTube**: paste a YouTube embed URL (e.g. \`https://www.youtube.com/embed/XXXXX?autoplay=1&mute=1\`). Plays inline.
- **Iframe**: any URL that allows being embedded. Useful for live menus, ticker boards, custom HTML.

Each slide has a duration in seconds. Omnix rotates through them while the cart is empty. The moment a cashier rings up an item, the display switches to the active-sale view.

## Privacy mode (per module)

Some businesses (pharmacies in particular) don't want item names visible on the display — patient privacy. Settings → Customer Display → Privacy → set per module:
- Dawa (Pharmacy): **on by default** (medication names hidden)
- Retail / Hardware / Hospitality: **off by default** (customer needs to see what they're paying for)

When privacy is on, the display shows "Item" or a generic label instead of the actual product name. Quantities and prices stay visible.

## Branding

The display reads your business name + logo from \`settings.business.name\` and \`settings.business.logo_path\`. Same source as receipts and PDFs.

## Resource budget

The customer display window is governed by Tauri's webview. Memory budget: ~150 MB. CPU: minimal when idle, modest during cart updates. If you embed YouTube iframes, expect 100–200 MB more depending on video resolution.`,
  },
  {
    slug: 'onboarding',
    title: 'Onboarding',
    excerpt: 'What the 7-step wizard asks for, what you can skip, where to change everything later.',
    category: 'Basics',
    icon: 'RocketLaunch',
    body: `When you first sign in to omnix.co.ke after buying a licence, Omnix runs a 7-step onboarding wizard. It captures the minimum needed to issue your licence and set your currency.

## What it asks

1. **Business name** (required) — what shows on receipts, invoices, customer display.
2. **Country** — picks your currency default. Defaults to Kenya.
3. **Currency** — auto-fills from country. Three-letter ISO code.
4. **Team size** (optional, skippable) — used for analytics and recommending sensible defaults.
5. **Phone** (required) — for licence-key SMS and critical alerts.
6. **KRA PIN / tax ID** (optional, skippable) — required for KRA eTIMS sale signing later, but not at onboarding time.
7. **Variant** (required) — which module you'll use first. Pick Dawa, Retail, Hardware, Hospitality, or Salon & Spa.

Steps 4 and 6 have a "Skip for now" button. You can fill them in later from Settings → Profile or your dashboard.

## What happens next

After step 7, Omnix:
- Saves your profile to the user record
- Sends you back to /dashboard with the variant pre-selected
- Prepares your licence for the chosen variant
- Emails you a licence key to activate the desktop install

## Where to change things later

- **Business name + phone + country + currency**: /dashboard/profile
- **KRA PIN + team size + addresses**: /dashboard/profile (under "Compliance + extras")
- **Variant**: you can run more than one. /dashboard → "Add another variant"`,
  },
  {
    slug: 'reports-overview',
    title: 'Reports overview',
    excerpt: 'Every PDF Omnix generates, what it shows, when to use it. P&L, day book, aged AR, dead stock, and 12 more.',
    category: 'Core',
    icon: 'ChartBar',
    body: `Omnix ships with sixteen PDF reports. Every one is generated by the same engine — same masthead, same currency formatting, same layout language — so once you know one, you know them all.

## Daily

- **Day book** — every product sold today, every payment method, refunds, expenses, net cash. Use at end-of-day to know what came in and what went out.
- **Z-report** — shift-close. Cash + M-Pesa + card + insurance reconciled with cash variance flagged. Print at lock-up.

## Weekly + monthly

- **Top products** — best sellers by units or revenue, optional profit column. Default range last 30 days.
- **Payment mix** — share of cash vs M-Pesa vs card. Useful for negotiating settlement fees.
- **Aged receivables** — customers who owe you, bucketed 0/30/60/90/90+. Trigger collections on the 90+ column.
- **Aged payables** — suppliers you owe, same bucket layout.

## KRA filings

- **VAT3** — monthly. See [VAT3 filing](/docs/vat3-filing).
- **P10** — monthly. See [P9 & P10 filing](/docs/p9-p10-filing).
- **P9** — yearly. Same.

## Inventory

- **Reorder list** — products at-or-below their reorder level with suggested order quantity.
- **Dead stock** — products that haven't sold in N days but are still on hand. Default threshold 60 days.
- **Stock-take variance** — expected vs counted, with KES value of the variance.

## Procurement

- **GRN** — Goods Received Note for any single receipt.
- **Hardware Quote** — branded quotation with bulk discount + VAT lines.

## Pharmacy + insurance

- **Controlled substances register** — daily pharmacy compliance. Required by the Pharmacy & Poisons Board.
- **Insurance claims batch** — every claim submitted in a period, totals at the bottom.

## Profitability

- **P&L** — period-bound. Revenue, COGS, gross profit, expenses, net profit. Ranges: 7d, 30d, MTD, 1Y, custom.

## How to download a sample

Every report has a working sample PDF on the homepage compliance grid. Go to /#pdf-pack — the six tiles each link to a real generated PDF.`,
  },
  {
    slug: 'csv-import',
    title: 'CSV import',
    excerpt: 'Bring your existing inventory in. Auto-mapping for English + Swahili headers, validation, dry-run preview.',
    category: 'Core',
    icon: 'TableLightning',
    body: `Switching from another POS? You don't have to retype every product. Omnix's CSV import understands almost any header shape — English, Swahili, abbreviated, or your old system's quirks.

## Get the template

Inventory → Import → Download Template. The CSV has these columns:
- name, sku, barcode, unit, buying_price, selling_price, initial_stock, reorder_level, tax_rate

Required: \`name\`, \`buying_price\`, \`selling_price\`. Everything else is optional.

## Auto-map

Drop your existing CSV in even if the headers don't match the template. Omnix auto-maps:

| You wrote | Maps to |
|---|---|
| name / product / item / Bidhaa / jina | name |
| buy / cost / wholesale / Bei ya Kununua / gharama | buying_price |
| sell / price / retail / Bei ya Kuuza / bei | selling_price |
| qty / quantity / stock / Idadi / Akiba | initial_stock |
| sku / code / Msimbo | sku |
| ean / upc / barcode | barcode |
| unit / uom / pack / Kipimo | unit |
| tax / vat / Ushuru | tax_rate |
| reorder / par / min_stock | reorder_level |
| category / type / Aina | category |
| notes / description / Maelezo | description |

Casing, whitespace, punctuation are normalised — \`Bei ya Kuuza!\`, \`bei_ya_kuuza\`, \`BEI YA KUUZA\` all map identically.

## Dry-run preview

After upload, Omnix shows a row-by-row preview with errors highlighted (missing fields, invalid prices, duplicate SKUs). Nothing writes to the database until you click Import. You can fix the CSV and re-upload as many times as you need.

## Errors you might hit

- **Invalid buying_price**: empty cell or non-numeric. Required.
- **Missing required columns**: name + buying + selling are mandatory; the rest are optional. The error message lists which canonical columns we couldn't find.
- **Unrecognised columns**: silently dropped with a warning toast. If you wanted us to import them, rename to a known synonym.

## After import

Each imported product becomes a single row in the products table with:
- a new UUID
- \`buying_price\` + \`selling_price\` written to the default price list
- \`initial_stock\` written as one batch dated today
- \`tax_rate\` defaulting to 16% if not provided

You can immediately ring sales with the imported stock.

## See also

- [Receiving stock](/docs/receiving-stock) — for ongoing stock additions
- [Inventory](/docs/inventory) — managing what's already in`,
  },
]

export function docSlugs(): string[] {
  return DOCS_SEED.map((d) => d.slug)
}

export function docBySlug(slug: string): DocSeed | null {
  return DOCS_SEED.find((d) => d.slug === slug) ?? null
}
