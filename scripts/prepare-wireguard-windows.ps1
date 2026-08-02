param(
  [string]$StageDir = "src-tauri/wireguard/staged/windows-x86_64",
  [switch]$Release,
  [string]$CertificateBase64 = $env:WINDOWS_CODE_SIGNING_CERT,
  [string]$CertificatePassword = $env:WINDOWS_CODE_SIGNING_PASSWORD
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$SourceRevision = "4e6726c23ae9c5cb58e0c9910f3b7515621d133d"
$SourceUrl = "https://git.zx2c4.com/wireguard-windows/snapshot/wireguard-windows-$SourceRevision.tar.xz"
$SourceSha256 = "24a33b83e8d0962f849a43657d52c58c4157ec9f87cef83754027dfb8804689c"
$NtVersion = "1.1"
$NtUrl = "https://download.wireguard.com/wireguard-nt/wireguard-nt-$NtVersion.zip"
$NtArchiveSha256 = "dceb30a9bc4be48cce0f74160fc88a585a2c2627366e8f846fc6658f9038dace"
$NtDllSha256 = "b1b85e072c45d81358be29d94c599dc76652f912be8c0f0a41e2d5d89a6461d3"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$DependencyManifest = Join-Path $Root "src-tauri\wireguard\windows-embeddable-dll-service.toml"
$ManifestText = Get-Content -LiteralPath $DependencyManifest -Raw
$RequiredManifestPins = @(
  "revision = `"$SourceRevision`"",
  "source_archive_url = `"$SourceUrl`"",
  "source_archive_sha256 = `"$SourceSha256`"",
  "version = `"$NtVersion`"",
  "official_archive_url = `"$NtUrl`"",
  "official_archive_sha256 = `"$NtArchiveSha256`"",
  "amd64_dll_sha256 = `"$NtDllSha256`"",
  "staging_script = `"scripts/prepare-wireguard-windows.ps1`""
)
foreach ($pin in $RequiredManifestPins) {
  if (-not $ManifestText.Contains($pin)) {
    throw "WireGuard staging pin does not match $DependencyManifest`: $pin"
  }
}
$TempRoot = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
$Work = Join-Path $TempRoot "omnix-wireguard-$SourceRevision"
$Stage = Join-Path $Root $StageDir

function Assert-Sha256([string]$Path, [string]$Expected) {
  $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $Expected) { throw "SHA-256 mismatch for $Path`nexpected $Expected`nactual   $actual" }
  return $actual
}

function Assert-Authenticode([string]$Path) {
  $signature = Get-AuthenticodeSignature -LiteralPath $Path
  if ($signature.Status -ne "Valid") {
    throw "Authenticode validation failed for $Path ($($signature.Status))"
  }
  return $signature.SignerCertificate.Subject
}

function Sign-Pe([string]$Path, [System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate) {
  $signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Filter signtool.exe -Recurse |
    Sort-Object FullName -Descending | Select-Object -First 1
  if (-not $signtool) { throw "signtool.exe is required" }
  & $signtool.FullName sign /fd SHA256 /td SHA256 /tr http://timestamp.digicert.com /sha1 $Certificate.Thumbprint $Path
  if ($LASTEXITCODE -ne 0) { throw "signtool failed for $Path" }
}

Remove-Item -LiteralPath $Work -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $Stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $Work, $Stage -Force | Out-Null

$sourceArchive = Join-Path $Work "wireguard-windows.tar.xz"
$ntArchive = Join-Path $Work "wireguard-nt-$NtVersion.zip"
Invoke-WebRequest -UseBasicParsing -Uri $SourceUrl -OutFile $sourceArchive
Invoke-WebRequest -UseBasicParsing -Uri $NtUrl -OutFile $ntArchive
Assert-Sha256 $sourceArchive $SourceSha256 | Out-Null
Assert-Sha256 $ntArchive $NtArchiveSha256 | Out-Null

tar -xf $sourceArchive -C $Work
Expand-Archive -LiteralPath $ntArchive -DestinationPath (Join-Path $Work "wireguard-nt")
$sourceRoot = Get-ChildItem $Work -Directory | Where-Object Name -Like "wireguard-windows-*" | Select-Object -First 1
if (-not $sourceRoot) { throw "pinned WireGuard source archive has an unexpected layout" }
Push-Location (Join-Path $sourceRoot.FullName "embeddable-dll-service")
try {
  & .\build.bat
  if ($LASTEXITCODE -ne 0) { throw "pinned WireGuard tunnel.dll build failed" }
} finally {
  Pop-Location
}

$tunnelSource = Join-Path $sourceRoot.FullName "embeddable-dll-service\amd64\tunnel.dll"
$wireguardSource = Join-Path $Work "wireguard-nt\wireguard-nt\bin\amd64\wireguard.dll"
if (-not (Test-Path $tunnelSource)) { throw "tunnel.dll was not produced" }
Assert-Sha256 $wireguardSource $NtDllSha256 | Out-Null
Copy-Item $tunnelSource (Join-Path $Stage "tunnel.dll")
Copy-Item $wireguardSource (Join-Path $Stage "wireguard.dll")

$certificate = $null
$pfxPath = Join-Path $Work "omnix-codesign.pfx"
if ($CertificateBase64 -and $CertificatePassword) {
  [IO.File]::WriteAllBytes($pfxPath, [Convert]::FromBase64String($CertificateBase64))
  $securePassword = ConvertTo-SecureString $CertificatePassword -AsPlainText -Force
  $certificate = Import-PfxCertificate -FilePath $pfxPath -CertStoreLocation Cert:\CurrentUser\My -Password $securePassword
} elseif ($CertificateBase64 -or $CertificatePassword) {
  throw "Both WINDOWS_CODE_SIGNING_CERT and WINDOWS_CODE_SIGNING_PASSWORD are required"
} elseif ($Release) {
  throw "Release Private Mesh staging requires WINDOWS_CODE_SIGNING_CERT and WINDOWS_CODE_SIGNING_PASSWORD"
} else {
  $certificate = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Omnix Private Mesh Development" -CertStoreLocation Cert:\CurrentUser\My
  $rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "CurrentUser")
  $rootStore.Open("ReadWrite")
  $rootStore.Add($certificate)
  $rootStore.Close()
}

Sign-Pe (Join-Path $Stage "tunnel.dll") $certificate
# Official WireGuardNT DLL is upstream-signed; never replace that signature.
$tunnelSigner = Assert-Authenticode (Join-Path $Stage "tunnel.dll")
$wireguardSigner = Assert-Authenticode (Join-Path $Stage "wireguard.dll")
$tunnelHash = (Get-FileHash (Join-Path $Stage "tunnel.dll") -Algorithm SHA256).Hash.ToLowerInvariant()
$wireguardHash = (Get-FileHash (Join-Path $Stage "wireguard.dll") -Algorithm SHA256).Hash.ToLowerInvariant()

$env:OMNIX_TUNNEL_SHA256 = $tunnelHash
$env:OMNIX_WIREGUARD_SHA256 = $wireguardHash
Push-Location (Join-Path $Root "src-tauri")
try {
  cargo build --release --bin omnix-mesh-service --target x86_64-pc-windows-msvc
  if ($LASTEXITCODE -ne 0) { throw "omnix-mesh-service build failed" }
} finally {
  Pop-Location
}
$helperSource = Join-Path $Root "src-tauri\target\x86_64-pc-windows-msvc\release\omnix-mesh-service.exe"
Copy-Item $helperSource (Join-Path $Stage "omnix-mesh-service.exe")
Sign-Pe (Join-Path $Stage "omnix-mesh-service.exe") $certificate
$helperSigner = Assert-Authenticode (Join-Path $Stage "omnix-mesh-service.exe")
$helperHash = (Get-FileHash (Join-Path $Stage "omnix-mesh-service.exe") -Algorithm SHA256).Hash.ToLowerInvariant()

Copy-Item (Join-Path $Root "src-tauri\wireguard\THIRD_PARTY_NOTICES.md") $Stage
Copy-Item (Join-Path $Root "src-tauri\wireguard\LICENSE-MIT-WIREGUARD-WINDOWS.txt") $Stage
Copy-Item (Join-Path $Root "src-tauri\wireguard\windows-embeddable-dll-service.toml") $Stage

$inventory = [ordered]@{
  schemaVersion = 1
  sourceRevision = $SourceRevision
  sourceArchiveSha256 = $SourceSha256
  wireguardNtVersion = $NtVersion
  generatedAt = [DateTimeOffset]::UtcNow.ToString("o")
  authorization = "DLL hashes are embedded in the Authenticode-signed helper and rechecked after UAC"
  artifacts = @(
    [ordered]@{ name = "tunnel.dll"; sha256 = $tunnelHash; authenticodeSubject = $tunnelSigner },
    [ordered]@{ name = "wireguard.dll"; sha256 = $wireguardHash; authenticodeSubject = $wireguardSigner },
    [ordered]@{ name = "omnix-mesh-service.exe"; sha256 = $helperHash; authenticodeSubject = $helperSigner }
  )
}
$inventory | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $Stage "artifact-manifest.json") -Encoding UTF8

foreach ($entry in $inventory.artifacts) {
  Assert-Sha256 (Join-Path $Stage $entry.name) $entry.sha256 | Out-Null
  Assert-Authenticode (Join-Path $Stage $entry.name) | Out-Null
}
Write-Host "Verified Private Mesh resources staged at $Stage"
