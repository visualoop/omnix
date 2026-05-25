# Skills & MCPs Installation Guide

Install these BEFORE writing any application code.

---

## 1. Anthropic Frontend Design Skill

**Purpose:** Guards against generic/template UI output. Forces Linear-grade design thinking.

**Install:**
```bash
/skills add https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md
```

**When to invoke:** Before drafting any new page or component.

---

## 2. shadcn/ui MCP Server

**Purpose:** Live awareness of all shadcn components, correct installation commands.

**Config:** Already in `.claude/mcp.json`

**Verify:** Ask "List available shadcn components" — should return real list.

---

## 3. Anthropic Webapp Testing Skill

**Purpose:** Screenshot and critique your own output against design standards.

**Install:**
```bash
/skills add https://raw.githubusercontent.com/anthropics/skills/main/skills/webapp-testing/SKILL.md
```

**When to invoke:** After every major page/component is built.

---

## 4. Playwright MCP

**Purpose:** Browser automation for testing, screenshots, accessibility audits.

**Config:** Already in `.claude/mcp.json`

**Use for:**
- Screenshot after building each screen
- Accessibility tree inspection
- End-to-end test scaffolding

---

## 5. Context7 MCP

**Purpose:** Fetches real-time, version-correct docs for any library. Prevents stale API usage.

**Config:** Already in `.claude/mcp.json`

**When to invoke:** Append `use context7` when working with Tauri, shadcn, Zustand, React Router, sqlx, or any external library.

---

## 6. .cursorrules (if using Cursor)

**Install:**
```bash
curl -o .cursorrules https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/main/rules/typescript-shadcn-ui-nextjs-cursorrules-prompt-fil/.cursorrules
```

Adapt for Vite + React Router (not Next.js) after downloading.

---

## Build Order with Skills

### Phase 0 (Tooling):
1. Install all skills and MCPs above
2. Verify all respond correctly
3. Then proceed to scaffolding

### Every new page/component:
1. Invoke frontend-design skill (B.1)
2. Draft the component
3. Screenshot with webapp-testing (B.3) or Playwright (B.4)
4. Compare against design reference (Linear, Notion, Figma)
5. If it looks template-y, rebuild

### Every library question:
- Use Context7 MCP — never guess API signatures from memory
