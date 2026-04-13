[![Build](https://github.com/kinarix/callstack/actions/workflows/build.yml/badge.svg)](https://github.com/kinarix/callstack/actions/workflows/build.yml)

# Callstack
[![Build](https://github.com/kinarix/callstack/actions/workflows/build.yml/badge.svg)](https://github.com/kinarix/callstack/actions/workflows/build.yml)

A desktop REST API testing tool built with Tauri 2 and React. Runs as a native OS window with a Rust HTTP client — no browser CORS or Origin restrictions.

## Features

- **Full HTTP method support**: GET, POST, PUT, DELETE, PATCH
- **Projects and folders**: Organize requests into projects with nested folders; drag-and-drop reordering
- **Environments**: Per-project variable sets; template syntax (`{{variable}}`) resolved at send time
- **Request builder**:
  - URL params editor (key-value, auto-appended to URL)
  - Headers editor with enable/disable toggle per row
  - Body editor with JSON/XML validation and auto Content-Type insertion
  - File attachments for multipart requests
  - Pinnable tabs (persist visible alongside others)
- **Response viewer**:
  - Body tab: JSON syntax highlighting, XML/HTML pretty-printing, plain text
  - Headers tab
  - Preview tab: rendered HTML, images, video, and audio (base64)
  - Copy body, save to file, clear response actions
  - Status code, response time (ms), and size (bytes) in the toolbar
- **Request log panel**: Collapsible footer showing all requests sent in the session; expands each entry to show the equivalent `curl` command (with copy button)
- **Resizable layout**: Sidebar width and request/response split are both draggable and persisted
- **Theming**: Dark, light, or system preference — toggled in the header
- **Google Sign-In**: Optional; scopes requests to the signed-in user's email so multiple users share one local database
- **Offline, local-first**: All data lives in a SQLite file on disk — no network required after install

## Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Node.js](https://nodejs.org/) 18+
- [Tauri CLI v2](https://tauri.app/start/prerequisites/)

### Run in development

```bash
make dev
```

This starts Vite (HMR) and the Tauri native window together. The Rust backend recompiles on changes.

### Build a distributable

```bash
make build
```

Produces a platform-native bundle (`.app` + `.dmg` on macOS, `.msi` on Windows, `.AppImage` on Linux) in `src-tauri/target/release/bundle/`.

### Other commands

```bash
make web-dev    # Vite dev server only (no Rust backend, useful for pure UI work)
make clean      # Remove web/dist and src-tauri/target
make icons      # Regenerate app icons from source (requires Pillow)
make help       # List all targets
```

## Architecture

```
callstack/
├── src-tauri/          # Rust / Tauri 2 backend
│   ├── src/
│   │   ├── lib.rs          # App setup, command registration
│   │   ├── http_client.rs  # send_request — reqwest-based HTTP proxy
│   │   └── database.rs     # All SQLite CRUD (rusqlite)
│   └── tauri.conf.json
└── web/                # React 19 + Vite + TypeScript frontend
    └── src/
        ├── components/     # Feature-grouped UI components
        ├── context/        # AppContext (useReducer global state)
        ├── hooks/          # useHttpClient, useDatabase, useAuth
        └── lib/            # types.ts, template.ts
```

**IPC**: The frontend calls Rust commands via `invoke()` from `@tauri-apps/api/core`. There is no HTTP server or REST API between frontend and backend.

**Data flow**: React state (Context + useReducer) drives the UI. Every mutation is also persisted to SQLite via debounced `invoke()` calls (300 ms). On startup, all projects, requests, folders, and environments are loaded from SQLite into React state.

**HTTP client**: All requests are sent by `reqwest` in Rust. This means no browser-imposed CORS restrictions, no forced `Origin` header, and full control over every header sent.

## Database

SQLite file location: `~/Library/Application Support/callstack/callstack.db` (macOS).

```sql
projects    (id, user_email, name, description, created_at, updated_at)
folders     (id, project_id, name, created_at, updated_at)
requests    (id, project_id, folder_id, user_email, name, method, url,
             params, headers, body, attachments, position, created_at, updated_at)
responses   (id, request_id, status, status_text, headers, body,
             time_ms, size, timestamp_ms, created_at)
environments (id, project_id, name, variables, created_at, updated_at)
```

`params`, `headers`, `attachments`, and `variables` are stored as JSON strings. `responses` captures the full last response per request (overwritten on each send).

## Design Conventions

**Accent colors by HTTP method**:

| Method | Token | Color |
|--------|-------|-------|
| GET | `--accent-get` | `#10b981` teal |
| POST | `--accent-post` | `#3b82f6` blue |
| PUT | `--accent-put` | `#f59e0b` amber |
| DELETE | `--accent-delete` | `#ef4444` red |
| PATCH | `--accent-patch` | `#a855f7` purple |

**Typography**: JetBrains Mono for code, URLs, and response bodies. Outfit for UI chrome. Both fonts are self-hosted in `web/public/fonts/` — no external font requests.

**Spacing**: 8 px base grid — `--space-half` (4 px), `--space-1` (8 px), `--space-2` (16 px), `--space-3` (24 px), `--space-4` (32 px).

**Theming**: CSS custom properties scoped to `[data-theme="light"]` / `[data-theme="dark"]`. Defaults to `prefers-color-scheme`.

## License

Apache License Version 2.0
