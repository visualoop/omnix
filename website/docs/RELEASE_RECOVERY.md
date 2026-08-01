# Repairing an incomplete desktop release

Use the existing tag as the source. Do not recreate the tag, hand-build a signature, or upload an unsigned installer. The workflow checks out the tag named by `release_version`, builds with the configured Tauri signing secret, attaches the generated installer and `.sig` to the existing GitHub release, mirrors both to R2, writes the exact variant metadata, and then calls the public updater endpoint to verify the URL and signature.

## Restore Dawa for v0.74.0

First deploy the website changes that make `/api/releases-sync` fail closed and persist variant metadata. Merge the workflow fix to `main`, then dispatch only the missing variant:

```bash
gh workflow run ci.yml \
  --repo visualoop/omnix \
  --ref main \
  -f release_version=v0.74.0 \
  -f release_variant=dawa
```

Find and watch the dispatched run:

```bash
RUN_ID=$(gh run list --repo visualoop/omnix --workflow ci.yml --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --repo visualoop/omnix --exit-status
```

The repair is complete only after both checks below pass:

```bash
gh release view v0.74.0 --repo visualoop/omnix --json assets --jq \
  '.assets[].name | select(test("^Omnix\\.Dawa_0\\.74\\.0_x64-(setup\\.exe|en-US\\.msi)(\\.sig)?$"))'

curl --fail --silent --show-error \
  'https://omnix.co.ke/api/releases-latest?variant=dawa&license=0.73.0' \
  | jq -e '.version == "0.74.0"
    and (.platforms["windows-x86_64"].url | contains("/v0.74.0/dawa/"))
    and (.platforms["windows-x86_64"].signature | length > 0)'
```

A 204 is correct only when `license` is already `0.74.0` or newer. For an older client, a missing installer or signature is a release failure and the endpoint returns an observable 503 instead of silently claiming there is no update.
