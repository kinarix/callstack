# Graph Report - .  (2026-04-13)

## Corpus Check
- Corpus is ~47,273 words - fits in a single context window. You may not need a graph.

## Summary
- 336 nodes · 320 edges · 60 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Database CRUD Layer|Database CRUD Layer]]
- [[_COMMUNITY_Sidebar Drag & Drop|Sidebar Drag & Drop]]
- [[_COMMUNITY_App Architecture Overview|App Architecture Overview]]
- [[_COMMUNITY_Callstack Core Concepts|Callstack Core Concepts]]
- [[_COMMUNITY_Request Builder Logic|Request Builder Logic]]
- [[_COMMUNITY_Data Persistence Rationale|Data Persistence Rationale]]
- [[_COMMUNITY_Postman ImportExport|Postman Import/Export]]
- [[_COMMUNITY_UI Icon Components|UI Icon Components]]
- [[_COMMUNITY_App Icon Generation|App Icon Generation]]
- [[_COMMUNITY_Tauri Native Commands|Tauri Native Commands]]
- [[_COMMUNITY_App Icon Design|App Icon Design]]
- [[_COMMUNITY_Environment Secret Manager|Environment Secret Manager]]
- [[_COMMUNITY_Content Type Detection|Content Type Detection]]
- [[_COMMUNITY_HTTP Request Execution|HTTP Request Execution]]
- [[_COMMUNITY_Script Runner|Script Runner]]
- [[_COMMUNITY_Key-Value Param Editor|Key-Value Param Editor]]
- [[_COMMUNITY_CodeMirror Editor Features|CodeMirror Editor Features]]
- [[_COMMUNITY_Settings & Shortcuts|Settings & Shortcuts]]
- [[_COMMUNITY_Archive ImportExport|Archive Import/Export]]
- [[_COMMUNITY_Update Checker|Update Checker]]
- [[_COMMUNITY_Modal UI Components|Modal UI Components]]
- [[_COMMUNITY_Theme Toggle Icons|Theme Toggle Icons]]
- [[_COMMUNITY_Database Hook Layer|Database Hook Layer]]
- [[_COMMUNITY_Method & Status Utilities|Method & Status Utilities]]
- [[_COMMUNITY_App Context & Reducer|App Context & Reducer]]
- [[_COMMUNITY_Settings Modal|Settings Modal]]
- [[_COMMUNITY_Shortcut Capture Modal|Shortcut Capture Modal]]
- [[_COMMUNITY_Body Editor|Body Editor]]
- [[_COMMUNITY_File Upload|File Upload]]
- [[_COMMUNITY_Keyboard Shortcuts Hook|Keyboard Shortcuts Hook]]
- [[_COMMUNITY_Body Formatting Utilities|Body Formatting Utilities]]
- [[_COMMUNITY_App Root|App Root]]
- [[_COMMUNITY_Request Item|Request Item]]
- [[_COMMUNITY_Response Footer|Response Footer]]
- [[_COMMUNITY_Import Modal|Import Modal]]
- [[_COMMUNITY_Refresh Button|Refresh Button]]
- [[_COMMUNITY_Vite Build Config|Vite Build Config]]
- [[_COMMUNITY_New Project Modal|New Project Modal]]
- [[_COMMUNITY_New Folder Modal|New Folder Modal]]
- [[_COMMUNITY_Export Modal|Export Modal]]
- [[_COMMUNITY_Method Badge|Method Badge]]
- [[_COMMUNITY_Confirm Modal|Confirm Modal]]
- [[_COMMUNITY_User Section|User Section]]
- [[_COMMUNITY_URL Bar|URL Bar]]
- [[_COMMUNITY_Script Examples|Script Examples]]
- [[_COMMUNITY_Env Selector|Env Selector]]
- [[_COMMUNITY_HTTP Client Hook|HTTP Client Hook]]
- [[_COMMUNITY_Auth Hook|Auth Hook]]
- [[_COMMUNITY_Theme Hook|Theme Hook]]
- [[_COMMUNITY_JWT Utilities|JWT Utilities]]
- [[_COMMUNITY_Template Resolution|Template Resolution]]
- [[_COMMUNITY_Tauri Build Script|Tauri Build Script]]
- [[_COMMUNITY_Rust Entry Point|Rust Entry Point]]
- [[_COMMUNITY_React Entry Point|React Entry Point]]
- [[_COMMUNITY_Env Type Declarations|Env Type Declarations]]
- [[_COMMUNITY_Project Row|Project Row]]
- [[_COMMUNITY_Response Viewer|Response Viewer]]
- [[_COMMUNITY_Header|Header]]
- [[_COMMUNITY_Callstack Schema|Callstack Schema]]
- [[_COMMUNITY_TypeScript Types|TypeScript Types]]

## God Nodes (most connected - your core abstractions)
1. `Callstack Application` - 16 edges
2. `React 18 + Vite + TypeScript Frontend` - 11 edges
3. `SQLite Local Database` - 9 edges
4. `handleSend()` - 6 edges
5. `create_icon()` - 5 edges
6. `parseItem()` - 5 edges
7. `Tauri 2 + Rust Backend` - 5 edges
8. `create_gradient()` - 4 edges
9. `applyRequestMove()` - 4 edges
10. `Callstack Icon with Text Branding` - 4 edges

## Surprising Connections (you probably didn't know these)
- `React 18 + Vite + TypeScript Frontend` --implements--> `useHttpClient Hook`  [EXTRACTED]
  README.md → CLAUDE.md
- `React 18 + Vite + TypeScript Frontend` --implements--> `useDatabase Hook`  [EXTRACTED]
  README.md → CLAUDE.md
- `React 18 + Vite + TypeScript Frontend` --implements--> `AppContext - Global State Management`  [EXTRACTED]
  README.md → CLAUDE.md
- `Google Sign-In` --implements--> `Google Sign-In Authentication`  [EXTRACTED]
  README.md → CLAUDE.md
- `React 18 + Vite + TypeScript Frontend` --implements--> `Sidebar Layout - Projects and Requests`  [EXTRACTED]
  README.md → CLAUDE.md

## Hyperedges (group relationships)
- **IPC and Data Flow Architecture** — frontend_react_vite, ipc_invoke_api, backend_tauri_rust, sqlite_database [EXTRACTED 1.00]
- **Design System and Visual Tokens** — css_theming_system, accent_colors_design, typography_design, spacing_grid [EXTRACTED 1.00]
- **Rust Backend Service Layer** — http_client_rs, database_rs, lib_rs [EXTRACTED 1.00]
- **Offline-First Persistence Architecture** — sqlite_database, react_state_management, debounced_persistence, ipc_invoke_api [EXTRACTED 1.00]
- **Authentication and Multi-User Support** — google_signin_optional, user_email_column, local_storage [EXTRACTED 1.00]

## Communities

### Community 0 - "Database CRUD Layer"
Cohesion: 0.06
Nodes (10): Database, DuplicateFolderResult, Environment, Folder, import_requests(), ImportRequestData, Project, Request (+2 more)

### Community 1 - "Sidebar Drag & Drop"
Cohesion: 0.1
Nodes (4): applyRequestMove(), handleDropOnFolder(), handleDropOnProject(), handleDropOnRequest()

### Community 2 - "App Architecture Overview"
Cohesion: 0.09
Nodes (23): AppContext - Global State Management, HTTP Method Accent Colors Design Tokens, Tauri 2 + Rust Backend, CSS Custom Properties Theming, database.rs - SQLite CRUD, Delete Button Hover Interaction, Design System Tokens, Expand/Collapse Button (▼/-90°) (+15 more)

### Community 3 - "Callstack Core Concepts"
Cohesion: 0.1
Nodes (20): Callstack Application, CORS Restriction Bypass, Environments Feature, Google Sign-In, Google Sign-In Authentication, HTTP Method Support, localStorage for User Data, Native OS Window (+12 more)

### Community 4 - "Request Builder Logic"
Cohesion: 0.26
Nodes (10): buildCurl(), getActiveEnvKey(), getContentType(), handleEnvSelect(), handleMethodChange(), handleSend(), normalizeUrl(), upsertContentType() (+2 more)

### Community 5 - "Data Persistence Rationale"
Cohesion: 0.17
Nodes (13): Cascading Delete on Project Removal, Debounced SQLite Persistence (300ms), Offline, Local-First Database, Projects-Requests Foreign Key Relationship, Rationale: Debounced React-to-SQLite Sync, Rationale: Offline-First, Local SQLite Database, React State (Context + useReducer), SQLite Local Database (+5 more)

### Community 6 - "Postman Import/Export"
Cohesion: 0.31
Nodes (6): collectRequests(), parseBody(), parseHeaders(), parseItem(), parsePostmanCollection(), parseUrl()

### Community 7 - "UI Icon Components"
Cohesion: 0.2
Nodes (0): 

### Community 8 - "App Icon Generation"
Cohesion: 0.33
Nodes (8): bolt_polygon(), create_gradient(), create_icon(), generate_all(), hex_to_rgb(), Create a vertical gradient image., Lightning bolt polygon scaled to `size`.     Based on Lucide Zap proportions (vi, Create the lightning bolt icon at the given size.

### Community 9 - "Tauri Native Commands"
Cohesion: 0.28
Nodes (4): CancelHandle, run(), save_binary_file(), save_file()

### Community 10 - "App Icon Design"
Cohesion: 0.36
Nodes (9): Callstack App Icon Family (Multi-Resolution), Cyan (#00FFFF approximate), Neon Green (#00FF00 approximate), Purple/Magenta accent, White Lightning Bolt / Chevron Symbol, Dark Navy/Black Background with Bright Accents, Callstack Lightning Bolt Icon (Primary Design), Simplified 128x128 Lightning Bolt Icon (+1 more)

### Community 11 - "Environment Secret Manager"
Cohesion: 0.29
Nodes (2): handleOverlayClick(), handleSave()

### Community 12 - "Content Type Detection"
Cohesion: 0.25
Nodes (0): 

### Community 13 - "HTTP Request Execution"
Cohesion: 0.32
Nodes (7): execute_request(), FileAttachment, friendly_network_error(), KeyValueParam, ResponseHeader, send_request(), SendResponse

### Community 14 - "Script Runner"
Cohesion: 0.29
Nodes (2): Success, Warn

### Community 15 - "Key-Value Param Editor"
Cohesion: 0.33
Nodes (0): 

### Community 16 - "CodeMirror Editor Features"
Cohesion: 0.33
Nodes (0): 

### Community 17 - "Settings & Shortcuts"
Cohesion: 0.33
Nodes (0): 

### Community 18 - "Archive Import/Export"
Cohesion: 0.4
Nodes (0): 

### Community 19 - "Update Checker"
Cohesion: 0.4
Nodes (0): 

### Community 20 - "Modal UI Components"
Cohesion: 0.4
Nodes (0): 

### Community 21 - "Theme Toggle Icons"
Cohesion: 0.4
Nodes (0): 

### Community 22 - "Database Hook Layer"
Cohesion: 0.4
Nodes (0): 

### Community 23 - "Method & Status Utilities"
Cohesion: 0.4
Nodes (0): 

### Community 24 - "App Context & Reducer"
Cohesion: 0.5
Nodes (0): 

### Community 25 - "Settings Modal"
Cohesion: 0.67
Nodes (2): captureShortcut(), onKey()

### Community 26 - "Shortcut Capture Modal"
Cohesion: 0.5
Nodes (0): 

### Community 27 - "Body Editor"
Cohesion: 0.5
Nodes (0): 

### Community 28 - "File Upload"
Cohesion: 0.5
Nodes (0): 

### Community 29 - "Keyboard Shortcuts Hook"
Cohesion: 0.5
Nodes (0): 

### Community 30 - "Body Formatting Utilities"
Cohesion: 0.83
Nodes (3): formatBody(), formatXml(), normalizeLineEndings()

### Community 31 - "App Root"
Cohesion: 0.67
Nodes (0): 

### Community 32 - "Request Item"
Cohesion: 1.0
Nodes (2): commit(), handleKeyDown()

### Community 33 - "Response Footer"
Cohesion: 0.67
Nodes (0): 

### Community 34 - "Import Modal"
Cohesion: 0.67
Nodes (0): 

### Community 35 - "Refresh Button"
Cohesion: 0.67
Nodes (0): 

### Community 36 - "Vite Build Config"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "New Project Modal"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "New Folder Modal"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Export Modal"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Method Badge"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Confirm Modal"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "User Section"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "URL Bar"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Script Examples"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Env Selector"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "HTTP Client Hook"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Auth Hook"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Theme Hook"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "JWT Utilities"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Template Resolution"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Tauri Build Script"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Rust Entry Point"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "React Entry Point"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Env Type Declarations"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Project Row"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Response Viewer"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Header"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Callstack Schema"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "TypeScript Types"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **46 isolated node(s):** `Create a vertical gradient image.`, `Lightning bolt polygon scaled to `size`.     Based on Lucide Zap proportions (vi`, `Create the lightning bolt icon at the given size.`, `Project`, `Request` (+41 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Vite Build Config`** (2 nodes): `manualChunks()`, `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `New Project Modal`** (2 nodes): `NewProjectModal()`, `NewProjectModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `New Folder Modal`** (2 nodes): `NewFolderModal()`, `NewFolderModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Export Modal`** (2 nodes): `MethodBadge()`, `ExportModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Method Badge`** (2 nodes): `MethodBadge()`, `MethodBadge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Confirm Modal`** (2 nodes): `ConfirmModal()`, `ConfirmModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `User Section`** (2 nodes): `UserSection()`, `UserSection.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `URL Bar`** (2 nodes): `handler()`, `UrlBar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Script Examples`** (2 nodes): `handleCopy()`, `ScriptExamples.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Env Selector`** (2 nodes): `EnvSelector()`, `EnvSelector.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `HTTP Client Hook`** (2 nodes): `useHttpClient()`, `useHttpClient.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Hook`** (2 nodes): `useAuth()`, `useAuth.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Theme Hook`** (2 nodes): `useTheme()`, `useTheme.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `JWT Utilities`** (2 nodes): `parseJwt()`, `jwt.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Template Resolution`** (2 nodes): `resolveTemplate()`, `template.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tauri Build Script`** (2 nodes): `main()`, `build.rs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Rust Entry Point`** (2 nodes): `main()`, `main.rs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `React Entry Point`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Env Type Declarations`** (1 nodes): `env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Project Row`** (1 nodes): `ProjectRow.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Response Viewer`** (1 nodes): `ResponseViewer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Header`** (1 nodes): `Header.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Callstack Schema`** (1 nodes): `callstackSchema.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `TypeScript Types`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Callstack Application` connect `Callstack Core Concepts` to `App Architecture Overview`, `Data Persistence Rationale`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `React 18 + Vite + TypeScript Frontend` connect `App Architecture Overview` to `Callstack Core Concepts`, `Data Persistence Rationale`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `SQLite Local Database` connect `Data Persistence Rationale` to `App Architecture Overview`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `Create a vertical gradient image.`, `Lightning bolt polygon scaled to `size`.     Based on Lucide Zap proportions (vi`, `Create the lightning bolt icon at the given size.` to the rest of the system?**
  _46 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Database CRUD Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Sidebar Drag & Drop` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `App Architecture Overview` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._