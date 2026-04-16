# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**CALLSTACK** is a desktop REST API testing tool (like Postman) built with Tauri 2 + React. Native OS window, Rust HTTP client (no browser CORS/Origin), local SQLite database, offline-capable.

## Building & Running

```bash
make dev        # Tauri dev mode — Vite HMR + Rust backend, native window
make build      # Build distributable app (.app / .dmg / .msi / .AppImage)
make web-dev    # Vite dev server only (no Rust backend)
make clean      # Remove web/dist and src-tauri/target
make icons      # Regenerate app icons (requires Pillow)
make help       # Show all commands
```

There are no automated tests.

## Architecture

**Frontend**: React 18 + Vite + TypeScript in `web/src/`. Components grouped by feature (Header, Sidebar, RequestBuilder, ResponseViewer). CSS Modules for styling with design tokens for dark/light/system theming. Fonts (JetBrains Mono, Outfit) bundled locally in `web/public/fonts/`.

**Backend**: Tauri 2 + Rust in `src-tauri/src/`. Two modules:
- `http_client.rs` — `send_request` command using `reqwest`. Full header control, no browser Origin/CORS.
- `database.rs` — SQLite CRUD via `rusqlite`. DB file at `~/Library/Application Support/callstack/callstack.db` (macOS).

**IPC**: Frontend calls Rust functions via `invoke()` from `@tauri-apps/api/core`. No REST API, no HTTP server.

**Data flow**: React state (Context + useReducer) for UI. All mutations also persist to SQLite via debounced `invoke()` calls. On load, data is fetched from SQLite into React state.

**Authentication**: Google Sign-In (optional); user data stored in `requests.user_email` column and `localStorage`.

**Theming**: CSS custom properties with `[data-theme="light|dark"]` attribute. Defaults to system preference. Theme toggle in header.

### SQLite Schema

```sql
projects (id, user_email, name, description, created_at, updated_at)
requests (id, project_id, user_email, name, method, url, params, headers, body, created_at, updated_at)
responses (id, request_id, status, status_text, headers, body, time_ms, created_at)
folders (id, project_id, name, created_at, updated_at)
environments (id, project_id, name, variables, created_at, updated_at)
automations (id, project_id, name, steps, created_at, updated_at)
automation_runs (id, automation_id, status, results, created_at)
data_files (id, project_id, name, content, created_at, updated_at)
```

**Key structure**: Projects contain Requests, Folders, Environments, Automations, and Data Files via `project_id` foreign key. Cascading delete on project removal.

### Key Files

- `src-tauri/src/lib.rs` — Tauri app setup, command registration
- `src-tauri/src/http_client.rs` — HTTP proxy command (`send_request`)
- `src-tauri/src/database.rs` — All DB commands (list/create/update/delete projects & requests)
- `web/src/hooks/useHttpClient.ts` — Frontend wrapper for `send_request` invoke
- `web/src/hooks/useDatabase.ts` — Frontend wrapper for all DB invokes
- `web/src/context/AppContext.tsx` — Global state (useReducer)

## Design Conventions

**Sidebar Layout**: Projects are expandable/collapsible sections containing requests. The expand button (▼) rotates -90° when collapsed. Delete button (×) appears on project header hover.

**Accent colors by HTTP method** (via CSS tokens):
- GET: `--accent-get` (#10b981 teal)
- POST: `--accent-post` (#3b82f6 blue)
- PUT: `--accent-put` (#f59e0b amber)
- DELETE: `--accent-delete` (#ef4444 red)
- PATCH: `--accent-patch` (#a855f7 purple)

**Typography**: JetBrains Mono for code/URLs/responses. Outfit for UI chrome. Both self-hosted in `web/public/fonts/`.

**Spacing**: 8px base grid (space-half: 4px, space-1: 8px, space-2: 16px, space-3: 24px, space-4: 32px)

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
