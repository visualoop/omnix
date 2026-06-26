# MCPs and testing tools for Omnix

These are the tools that should live on your local dev machine so
the agent can see what it builds and verify the work, not just write
hopeful code.

## On-this-machine (already installed or will be)

Running on this Linux workspace where the agent operates:

| Tool | Purpose | Install command |
|---|---|---|
| Playwright + Chromium | E2E + visual regression | `pnpm add -D @playwright/test && npx playwright install --with-deps chromium` |
| Lighthouse CLI | SEO/perf/a11y scores | `pnpm add -D lighthouse` |
| @lhci/cli | Lighthouse CI assertions | `pnpm add -D @lhci/cli` |
| axe-core + vitest-axe | a11y in unit tests | `pnpm add -D axe-core vitest-axe` |
| @axe-core/playwright | a11y in E2E | `pnpm add -D @axe-core/playwright` |
| http-server | Quick static-serve for built site | `pnpm add -D serve` |

The agent installs and runs these from this machine.

## Local-dev (your laptop) — MCPs to connect your editor

These are MCPs the agent can call when running in YOUR editor
(Cursor/Claude Code/Kiro). They expand what the agent can do during
interactive sessions.

### chrome-devtools-mcp

What it does: gives the agent a live Chrome session — DOM inspect,
screenshot, network trace, console log, Lighthouse audit.

Config (`~/.kiro/mcp.json` or equivalent):
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp"]
    }
  }
}
```

Source: github.com/ChromeDevTools/chrome-devtools-mcp

### playwright-mcp

Browser automation with structured accessibility snapshots — faster
than chrome-devtools-mcp for pure E2E.

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

Source: playwright.dev/mcp

### lighthouse-mcp-server

13+ tools for performance, accessibility, SEO, security audits.

```json
{
  "mcpServers": {
    "lighthouse": {
      "command": "npx",
      "args": ["-y", "lighthouse-mcp-server"]
    }
  }
}
```

Source: github.com/danielsogl/lighthouse-mcp-server

### a11y-mcp

axe-core driven a11y audits with agent-loop remediation.

```json
{
  "mcpServers": {
    "a11y": {
      "command": "npx",
      "args": ["-y", "a11y-mcp"]
    }
  }
}
```

Source: github.com/priyankark/a11y-mcp

### shadcn MCP

Search + install shadcn/ui components from the registry.

Source: ui.shadcn.com/docs/mcp

### daraja-skills

Per-page reviewed Daraja API context for the agent.

```bash
npx -y daraja-skills install
```

Source: daraja-skills.vercel.app

## Skills shipped in this repo (no install)

`.kiro/skills/` contains:

- `frontend-design` — distinctive visual direction
- `emil-design-eng` — polish + animation philosophy
- `hallmark` — anti-AI-slop design for greenfield + redesigns
- `ui-ux-pro-max` — component-level UX guidance
- `anti-slop-writing` — copy that reads human

Invoke by name in prompts.

## CI integration (after v0.12.0)

We wire these into `.github/workflows/ci.yml`:

1. `pnpm exec vitest run` — unit + a11y tests
2. `npx playwright test` — E2E
3. `lhci autorun` — Lighthouse against the Vercel preview URL
   (fails the build if any score < 95 on SEO/Best Practices/A11y)

## Quality bar

- Lighthouse: SEO 100, Best Practices 100, Accessibility 100,
  Performance ≥ 95 (with image optimisation in place)
- 0 axe violations
- 0 console errors in production
- TBT < 200ms on landing pages
