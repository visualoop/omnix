# Repairing incomplete desktop releases

Never recreate a release tag, hand-build a signature, or upload an unsigned installer. The Tauri-generated `.sig` must stay paired with the exact NSIS executable it signs.

## Re-sync all v0.74.1 desktop metadata

Run this only after the corrected website `/api/releases-sync` route is deployed. Run `30709255209` already attached and mirrored all five signed installers; only its metadata requests failed. The commands below download those exact GitHub release assets, point metadata at their existing R2 locations, submit each variant independently, and verify the public updater's exact URL and signature.

Prerequisites: authenticated `gh`, `curl`, `jq`, and `sha256sum`. Obtain the production ingest token from the existing secret store; do not paste it into shell history.

```bash
set -euo pipefail
REPO=visualoop/omnix
TAG=v0.74.1
VERSION=0.74.1
BASE=https://omnix.co.ke
PUBLIC_BASE=https://media.omnix.co.ke
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

read -rsp 'RELEASE_INGEST_TOKEN: ' RELEASE_INGEST_TOKEN
echo
export RELEASE_INGEST_TOKEN

gh release download "$TAG" --repo "$REPO" --dir "$WORK" \
  --pattern '*_x64-setup.exe' \
  --pattern '*_x64-setup.exe.sig' \
  --pattern '*_x64_en-US.msi' \
  --pattern '*_x64_en-US.msi.sig'

declare -A PRODUCT=(
  [dawa]='Omnix.Dawa'
  [retail]='Omnix.Retail'
  [hospitality]='Omnix.Hospitality'
  [hardware]='Omnix.Hardware.and.Equipment'
  [salon]='Omnix.Salon.and.Spa'
)

for VARIANT in dawa retail hospitality hardware salon; do
  STEM=${PRODUCT[$VARIANT]}_${VERSION}_x64
  NSIS=$WORK/${STEM}-setup.exe
  NSIS_SIG=${NSIS}.sig
  MSI=$WORK/${STEM}_en-US.msi
  MSI_SIG=${MSI}.sig
  test -s "$NSIS" && test -s "$NSIS_SIG" && test -s "$MSI" && test -s "$MSI_SIG"

  PREFIX=releases/$TAG/$VARIANT
  NSIS_URL=$PUBLIC_BASE/$PREFIX/$(basename "$NSIS")
  MSI_URL=$PUBLIC_BASE/$PREFIX/$(basename "$MSI")
  curl --fail --silent --show-error --head "$NSIS_URL" >/dev/null
  curl --fail --silent --show-error --head "$MSI_URL" >/dev/null

  BODY=$WORK/$VARIANT.json
  jq -n \
    --arg version "$VERSION" \
    --arg variant "$VARIANT" \
    --arg tag "$TAG" \
    --arg nsisUrl "$NSIS_URL" \
    --arg msiUrl "$MSI_URL" \
    --argjson nsisSize "$(stat -c '%s' "$NSIS")" \
    --argjson msiSize "$(stat -c '%s' "$MSI")" \
    --arg nsisSha "$(sha256sum "$NSIS" | awk '{print $1}')" \
    --arg msiSha "$(sha256sum "$MSI" | awk '{print $1}')" \
    --arg signature "$(cat "$NSIS_SIG")" \
    '{
      version: $version,
      variant: $variant,
      majorVersion: 0,
      channel: "stable",
      gitTag: $tag,
      windowsNsisUrl: $nsisUrl,
      windowsMsiUrl: $msiUrl,
      windowsNsisSize: $nsisSize,
      windowsMsiSize: $msiSize,
      sha256Nsis: $nsisSha,
      sha256Msi: $msiSha,
      updaterSignature: $signature,
      title: ("Omnix v" + $version + " (" + $variant + ")"),
      summary: ("Omnix " + $variant + " " + $version + " — bug fixes and improvements."),
      forcePublish: true
    }' > "$BODY"

  RESPONSE=$WORK/$VARIANT-response.json
  HTTP_CODE=$(curl --silent --show-error --output "$RESPONSE" --write-out '%{http_code}' \
    --request POST "$BASE/api/releases-sync" \
    --header "x-system-token: $RELEASE_INGEST_TOKEN" \
    --header 'Content-Type: application/json' \
    --data-binary "@$BODY")
  test "$HTTP_CODE" = 200 || { cat "$RESPONSE"; exit 1; }
  jq -e --arg variant "$VARIANT" --arg exe "$NSIS_URL" \
    '.ok == true and .variant == $variant and .desktop.exe == $exe and .desktop.signatureStored == true' \
    "$RESPONSE" >/dev/null

  EXPECTED_URL=$(node -e 'process.stdout.write(encodeURI(process.argv[1]))' "$NSIS_URL")
  EXPECTED_SIGNATURE=$(cat "$NSIS_SIG")
  curl --fail --silent --show-error \
    "$BASE/api/releases-latest?variant=$VARIANT&license=0.0.0" \
    | jq -e --arg version "$VERSION" --arg url "$EXPECTED_URL" --arg signature "$EXPECTED_SIGNATURE" \
      '.version == $version
       and .platforms["windows-x86_64"].url == $url
       and .platforms["windows-x86_64"].signature == $signature' >/dev/null
  echo "verified $VARIANT $VERSION"
done
```

Do not print `$RELEASE_INGEST_TOKEN`, the request headers, or the generated request bodies in CI logs. Re-running the script is safe: the endpoint upserts by version and atomically merges each variant key.

## Attach and publish the missing Dawa installer for v0.74.0

The Dawa assets are absent from the GitHub release, so metadata-only recovery is not enough. After the workflow changes are on `main`, dispatch a signed build from the immutable existing tag:

```bash
gh workflow run ci.yml \
  --repo visualoop/omnix \
  --ref main \
  -f release_version=v0.74.0 \
  -f release_variant=dawa

RUN_ID=$(gh run list \
  --repo visualoop/omnix \
  --workflow ci.yml \
  --event workflow_dispatch \
  --limit 1 \
  --json databaseId \
  --jq '.[0].databaseId')
gh run watch "$RUN_ID" --repo visualoop/omnix --exit-status
```

The desktop build job signs the executable, attaches it and its `.sig` to the existing release, mirrors it to R2, and uploads a metadata payload. The separate `sync-desktop-metadata` job then writes and verifies the updater entry. If only metadata sync fails, use **Re-run failed jobs** in GitHub Actions; the successful artifact-publishing job remains successful and its retained payload is reused.

Verify both release assets and the installed-client endpoint:

```bash
gh release view v0.74.0 --repo visualoop/omnix --json assets --jq \
  '.assets[].name | select(test("^Omnix\\.Dawa_0\\.74\\.0_x64(-setup\\.exe|_en-US\\.msi)(\\.sig)?$"))'

curl --fail --silent --show-error \
  'https://omnix.co.ke/api/releases-latest?variant=dawa&license=0.73.0' \
  | jq -e '.version == "0.74.0"
    and (.platforms["windows-x86_64"].url | contains("/v0.74.0/dawa/"))
    and (.platforms["windows-x86_64"].signature | length > 0)'
```

A `204` is correct only when the installed version is already current. An older client must receive the signed update; incomplete variant metadata is an observable `503`.
