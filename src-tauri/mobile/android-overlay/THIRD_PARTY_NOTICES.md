# Android third-party notices

Retain this file in APK/AAB notices and release artifacts. Dependency license files from resolved AARs remain authoritative; CI must produce an SBOM and fail if a resolved native dependency is unpinned or has an unreviewed license.

| Coordinate | Version | Use | License |
|---|---:|---|---|
| `com.wireguard.android:tunnel` | `1.0.20260102` | Embedded private mesh tunnel | Apache License 2.0 |
| `androidx.biometric:biometric` | `1.1.0` | Protected biometric prompt | Apache License 2.0 |
| `androidx.camera:camera-camera2` | `1.4.2` | In-app scanner camera | Apache License 2.0 |
| `androidx.camera:camera-lifecycle` | `1.4.2` | Camera lifecycle binding | Apache License 2.0 |
| `androidx.camera:camera-view` | `1.4.2` | Scanner preview | Apache License 2.0 |
| `com.google.mlkit:barcode-scanning` | `17.3.0` | Bundled barcode decoding | Google/Android SDK terms; legal review required before release |
| `androidx.work:work-runtime-ktx` | `2.10.1` | Inexact local notification scheduling | Apache License 2.0 |
| `com.android.tools:desugar_jdk_libs` | `2.1.5` | Java API desugaring | GPLv2 with Classpath Exception and upstream notices |

WireGuard source and notice: https://git.zx2c4.com/wireguard-android and `NOTICE-WIREGUARD`. Apache License 2.0 text: https://www.apache.org/licenses/LICENSE-2.0.txt.

Release gate: legal must approve the ML Kit SDK terms and generated transitive-license report. If not approved, replace the decoder behind the same scanner contract; do not silently drop notices or switch to a dynamically downloaded model.
