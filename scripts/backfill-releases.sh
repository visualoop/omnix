#!/usr/bin/env bash
# Backfill existing GitHub Releases into Payload's `releases` collection.
#
# Run once after enabling the new CI Notify-Payload step, so the desktop
# updater has data for versions that shipped before the sync existed.
#
# Required env:
#   PAYLOAD_SYSTEM_TOKEN  — same secret as CI sets on GitHub Actions
#   PAYLOAD_BASE          — defaults to https://omnix.co.ke
#   GH_REPO               — defaults to visualoop/omnix
#
# Each release is published immediately (forcePublish: true).
# Idempotent: re-running updates the existing rows in place.

set -euo pipefail

PAYLOAD_BASE="${PAYLOAD_BASE:-https://omnix.co.ke}"
GH_REPO="${GH_REPO:-visualoop/omnix}"

if [ -z "${PAYLOAD_SYSTEM_TOKEN:-}" ]; then
  echo "PAYLOAD_SYSTEM_TOKEN env var required" >&2
  exit 1
fi

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

# Pull every release tag with assets.
gh release list --repo "$GH_REPO" --limit 50 --json tagName,publishedAt,isDraft,isPrerelease \
  | jq -c '.[] | select(.isDraft | not) | select(.tagName | startswith("v"))' \
  | while read -r row; do
      TAG=$(echo "$row" | jq -r .tagName)
      VERSION="${TAG#v}"
      MAJOR="${VERSION%%.*}"
      CHANNEL=stable
      [[ "$TAG" == *-* ]] && CHANNEL=beta

      ASSETS=$(gh release view "$TAG" --repo "$GH_REPO" --json assets --jq '.assets[].name')

      NSIS_NAME=$(echo "$ASSETS" | grep -E '\-setup\.exe$' | head -1 || true)
      NSIS_SIG_NAME=$(echo "$ASSETS" | grep -E '\-setup\.exe\.sig$' | head -1 || true)
      MSI_NAME=$(echo "$ASSETS" | grep -E '\.msi$' | head -1 || true)

      if [ -z "$NSIS_NAME" ] || [ -z "$NSIS_SIG_NAME" ]; then
        echo "[$TAG] missing NSIS installer or sig — skipping"
        continue
      fi

      # Pull the .sig (small) so we have the updater signature.
      gh release download "$TAG" --repo "$GH_REPO" --pattern "$NSIS_SIG_NAME" --dir "$WORKDIR" --clobber
      SIGNATURE=$(cat "$WORKDIR/$NSIS_SIG_NAME")

      NSIS_URL="https://github.com/$GH_REPO/releases/download/$TAG/$NSIS_NAME"
      MSI_URL=""
      [ -n "$MSI_NAME" ] && MSI_URL="https://github.com/$GH_REPO/releases/download/$TAG/$MSI_NAME"

      BODY=$(jq -n \
        --arg version "$VERSION" \
        --argjson major "$MAJOR" \
        --arg channel "$CHANNEL" \
        --arg tag "$TAG" \
        --arg nsisUrl "$NSIS_URL" \
        --arg msiUrl "$MSI_URL" \
        --arg sig "$SIGNATURE" \
        --arg title "Omnix v$VERSION" \
        --arg summary "See https://github.com/$GH_REPO/releases/tag/$TAG for the full changelog." \
        '{
          version: $version,
          majorVersion: $major,
          channel: $channel,
          gitTag: $tag,
          windowsNsisUrl: $nsisUrl,
          windowsMsiUrl: ($msiUrl | select(. != "")),
          updaterSignature: $sig,
          title: $title,
          summary: $summary,
          forcePublish: true
        } | with_entries(select(.value != null))')

      echo "[$TAG] POST $PAYLOAD_BASE/api/releases"
      HTTP_CODE=$(curl -s -o /tmp/payload-resp.json -w "%{http_code}" \
        -X POST "$PAYLOAD_BASE/api/releases" \
        -H "x-system-token: $PAYLOAD_SYSTEM_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$BODY")
      echo "  → HTTP $HTTP_CODE: $(cat /tmp/payload-resp.json)"
      [ "$HTTP_CODE" = "200" ] || echo "  WARN: non-200 response"
    done

echo "Done."
