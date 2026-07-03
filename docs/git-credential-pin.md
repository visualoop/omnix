# Git credential pin — v0.38.5

## Problem

The workspace has two GitHub CLI accounts (`visualoop`, `justinelut`).
When `gh auth switch` drifts to the wrong account, `git push origin main`
returns `remote: Repository not found` because `justinelut` doesn't have
push access to `visualoop/omnix`.

During the v0.37.x → v0.38.x release train we hit this twice, each time
fixed with `gh auth switch --user visualoop` before pushing.

## Fix

Local git config pins the credential helper for `https://github.com`
in this repo to always fetch a token belonging to the `visualoop` account,
independent of `gh`'s active-account state.

Set in `.git/config`:

```ini
[credential "https://github.com"]
    helper =
    helper = "!f() { echo \"username=visualoop\"; echo \"password=$(gh auth token --user visualoop)\"; }; f"
```

The empty `helper =` line clears any global/system helper first (git
appends multiple helpers in order and asks each one — we want visualoop
first, no fallback).

## Verify

```bash
# Even if gh's active account is wrong:
gh auth switch --user justinelut
# ...ls-remote should still succeed:
git ls-remote origin
# expected: HEAD sha + refs/heads/main sha
```

## Reproducing the setup on another workstation

```bash
gh auth login --hostname github.com --scopes 'repo,workflow,gist,read:org' \
  --with-token < /path/to/visualoop-token.txt

# In the omnix repo:
git config --local credential.https://github.com.helper ""
git config --local --add credential.https://github.com.helper \
  '!f() { echo "username=visualoop"; echo "password=$(gh auth token --user visualoop)"; }; f'
```

## When this doesn't apply

- **CI (GitHub Actions)** — uses `GITHUB_TOKEN` injected by the runner;
  no `gh` involvement.
- **Direct SSH clone** — the credential helper only runs for HTTPS remotes.
  If you flip the remote to SSH (`git remote set-url origin
  git@github.com:visualoop/omnix.git`), the pin is moot but you need SSH
  keys registered against the visualoop account.
