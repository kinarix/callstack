# Callstack Codebase Knowledge Graph Report

**Generated**: 2026-04-15  
**Extraction**: AST (code files) + cached semantic (previous runs)  
**Corpus**: 81 files (60 code, 3 docs, 18 images) | ~63k words

---

## Graph Summary

| Metric | Value |
|--------|-------|
| Total Nodes | 551 |
| Total Edges | 621 |
| Communities (weakly connected) | 17 |
| Largest Community | 347 nodes |
| Avg. Degree | 2.3 |

**Note**: Semantic extraction hit rate limits during this run. Full semantic extraction (docs, images, design intent) will be available on retry. Current graph is based on code structure (AST) + previously cached semantic results.

---

## God Nodes (Central Hubs)

These nodes have the highest influence in the system (by PageRank):

1. **react** — Core UI framework; 37 incoming edges (used throughout frontend)
2. **SQLite Local Database** — Primary data persistence; 4 in, 5 out
3. **getTemplateContext()** — Template variable resolution; 4 incoming references
4. **hex_to_rgb()** — Color utility; used by theming system
5. **applyRequestMove()** — Request reordering logic; 4 incoming edges
6. **.new()** — Type constructors; 3 incoming edges
7. **Cascading Delete on Project Removal** — Data integrity pattern; database schema feature
8. **create_gradient()** — SVG/icon generation; 3 in, 1 out
9. **bolt_polygon()** — Icon rendering utility
10. **create_icon()** — Icon factory; 3 in, 2 out

---

## Community Structure

### Community 1: Core Frontend (347 nodes)
**Hub nodes**: KeyValueEditor, EnvironmentView, RequestBuilder, Sidebar  
**Purpose**: React UI components, state management, request/automation building  
**Connections**: Heavy use of React, CSS Modules, TypeScript types, context API

### Community 2: Database Layer (57 nodes)
**Hub nodes**: SQLite CRUD, database.rs, Rust data models  
**Purpose**: SQLite persistence, project/request/automation schema  
**Connections**: Tauri invocation, schema design patterns

### Community 3: HTTP & Scripting (56 nodes)
**Hub nodes**: send_request, http_client.rs, script execution, test validation  
**Purpose**: HTTP request execution, pre/post script runner, test assertions  
**Connections**: Core inference engine, external API calls

### Community 4: Theming & Design (21 nodes)
**Hub nodes**: create_gradient, create_icon, hex_to_rgb, CSS tokens  
**Purpose**: Dark/light/dim theme system, accent colors, typography  
**Connections**: CSS modules, design token files, React theme context

### Community 5: Utilities & Helpers (17 nodes)
**Hub nodes**: parseItem, friendly_network_error, type guards, formatters  
**Purpose**: Error handling, type narrowing, data formatting  
**Connections**: Cross-cutting concerns, used by multiple communities

---

## Architecture Insights

### Frontend Architecture (AST + partial semantic)
- **State Management**: useReducer + Context (AppContext) — 1 global state tree
- **Component Structure**: Feature-based (RequestBuilder, Sidebar, ResponseViewer, AutomationView, EnvironmentView)
- **Styling**: CSS Modules + design tokens for theming
- **Data Flow**: React state ↔ SQLite (debounced invoke calls)

### Backend Architecture
- **HTTP Client**: Tauri 2 command `send_request` → reqwest (full header control, no browser CORS)
- **Database**: Tauri command layer → Rust → rusqlite → SQLite file at `~/Library/Application Support/callstack/callstack.db`
- **Schema**: projects → requests (with env vars, scripts, attachments), responses (query history), environments (variables + secrets), automations (step orchestration)

### Key Patterns Detected

1. **Cascading Delete on Project Removal** — Schema-level foreign key constraint
2. **Debounced Persistence** — React state changes → async invoke() → SQLite write
3. **Template Resolution** — `${VARIABLE}` → context substitution in request URL/body/headers
4. **Automation Step Serialization** — Recursive step tree with request ID → reference mapping for export/import
5. **Script Execution Sandbox** — Pre/post scripts run with access to request/response/env/secrets, emit side effects

---

## Files by Centrality (Top 15)

| File | Type | Role |
|------|------|------|
| web/src/context/AppContext.tsx | TypeScript | Global state machine; 37 components depend on context |
| src-tauri/src/database.rs | Rust | SQLite CRUD; schema definition; invocation layer |
| web/src/components/RequestBuilder/KeyValueEditor.tsx | React | Reusable K/V editor; used in request headers, params, env vars |
| web/src/lib/types.ts | TypeScript | Type definitions; shapes for Request, Response, Automation, etc. |
| web/src/components/Sidebar/Sidebar.tsx | React | Project/request/automation tree; drag-drop, navigation |
| src-tauri/src/http_client.rs | Rust | send_request command; reqwest HTTP proxy |
| web/src/lib/formatBody.ts | TypeScript | Body formatting for display/copy; JSON/XML prettification |
| web/src/hooks/useDatabase.ts | TypeScript | DB invoke wrappers; CRUD operations |
| web/src/App.tsx | React | Root component; view switcher (request/automation/environment) |
| web/src/components/ResponseViewer/ResponseViewer.tsx | React | Response display; headers, body, test results |

---

## Known Limitations (This Run)

- **Semantic extraction incomplete**: 48 doc/image files remain unextracted due to rate limits. Full analysis of design rationale, paper references, and design decisions unavailable.
- **Hyperedge detection skipped**: No multi-node concepts extracted (e.g., "auth flow", "request lifecycle").
- **Documentation not indexed**: CLAUDE.md, README, and inline design docs not yet in graph.

**Next steps to complete the graph**:
```bash
# Retry semantic extraction (wait for rate limit reset or use --update mode)
python3 -c "from graphify.watch import _rebuild_semantic; from pathlib import Path; _rebuild_semantic(Path('.'))"

# Or force full re-extraction
/graphify . --mode deep --update
```

---

## Usage Tips

- **Query the graph** (once available): `graphify query "How does template substitution work?"`
- **Shortest path**: `graphify path "Request" "SQLite"` → trace data flow
- **Explain a node**: `graphify explain "Automation" → plain-language definition
- **Watch for changes**: `graphify . --watch` → auto-rebuild AST on code edits

---

*Graph built with graphify. Edges tagged EXTRACTED (code), INFERRED (reasoning), or AMBIGUOUS (uncertain).*
