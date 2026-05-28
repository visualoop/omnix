# CircleCI Setup for Omnix

## 1. Sign up at circleci.com
Go to https://circleci.com/signup/ — click "Sign Up with GitHub".
Authorize the justinelut/sokoOS repository.

## 2. Add environment variables
In CircleCI Dashboard → Project Settings → Environment Variables, add:

| Variable | Value |
|----------|-------|
| `GITHUB_TOKEN` | A GitHub Personal Access Token with `repo` scope |

Get the token at: https://github.com/settings/tokens → Generate new token (classic) → check "repo" → copy it.

## 3. Trigger a build
Push a tag to GitHub:
```
git tag v0.2.1
git push origin v0.2.1
```

CircleCI automatically picks up new tags matching `v*.*.*`.

## 4. Download builds
Every build stores artifacts you can download:
- **CircleCI Dashboard** → click the pipeline → Artifacts tab → download MSI and NSIS installers
- **Tagged releases** ALSO publish to GitHub Releases automatically via `gh release create`

No GitHub Actions minutes needed — CircleCI has its own free tier (6,000 credits/week).
