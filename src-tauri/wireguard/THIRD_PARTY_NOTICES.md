# WireGuard third-party notices

These notices apply only when the corresponding artifact is bundled. The manifests are integration inputs; they do not by themselves add either binary to an Omnix package.

## WireGuard for Windows — embeddable-dll-service

- Project: WireGuard for Windows
- Source: <https://git.zx2c4.com/wireguard-windows>
- Integrated source path: `embeddable-dll-service`
- Copyright: Copyright (C) 2018–2026 WireGuard LLC. All Rights Reserved.
- License: MIT; the required text is in `LICENSE-MIT-WIREGUARD-WINDOWS.txt`.

`tunnel.dll` also requires `wireguard.dll` (WireGuardNT). The release coordinator must inventory its exact source/version, signature, SHA-256, and license before either DLL enters installer staging. No unlisted DLL is permitted.

## WireGuard Android tunnel library

- Maven coordinate: `com.wireguard.android:tunnel:1.0.20260102`
- Project: WireGuard Tunnel Library
- Source: <https://git.zx2c4.com/wireguard-android>
- License: Apache License 2.0; the required text is in `LICENSE-APACHE-2.0.txt`.
- Pinned AAR SHA-256: `2b9c16db026496123e4db695d26d03d1958a201096c7c4c89b21077dc70f3119`

Under Apache-2.0, preserve upstream copyright, patent, trademark, and attribution notices; mark modified files; ship the license; and carry forward any upstream `NOTICE` content found in the resolved artifact. The release job must extract and inspect the pinned AAR before redistribution rather than assuming this repository’s notice is exhaustive.

WireGuard is a registered trademark of Jason A. Donenfeld. This notice describes compatibility and origin; it does not imply endorsement.
