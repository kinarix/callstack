# Graph Report - .  (2026-05-05)

## Corpus Check
- 96 files · ~85,689 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 533 nodes · 529 edges · 82 communities detected
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Automation & DB Commands|Automation & DB Commands]]
- [[_COMMUNITY_UI Event Handlers|UI Event Handlers]]
- [[_COMMUNITY_App Architecture & Data Model|App Architecture & Data Model]]
- [[_COMMUNITY_Visual Branding & Identity|Visual Branding & Identity]]
- [[_COMMUNITY_HTTP Client & DB Utilities|HTTP Client & DB Utilities]]
- [[_COMMUNITY_Content Detection & Body Format|Content Detection & Body Format]]
- [[_COMMUNITY_Automation Runner Utilities|Automation Runner Utilities]]
- [[_COMMUNITY_Request Builder Utilities|Request Builder Utilities]]
- [[_COMMUNITY_Rust HTTP Execution|Rust HTTP Execution]]
- [[_COMMUNITY_Core Features & Architecture|Core Features & Architecture]]
- [[_COMMUNITY_Postman ImportExport|Postman Import/Export]]
- [[_COMMUNITY_Documentation Scripts|Documentation Scripts]]
- [[_COMMUNITY_Icon Generation Script|Icon Generation Script]]
- [[_COMMUNITY_Script Execution Engine|Script Execution Engine]]
- [[_COMMUNITY_Project Archive Management|Project Archive Management]]
- [[_COMMUNITY_System Stats & Shortcuts|System Stats & Shortcuts]]
- [[_COMMUNITY_Popover & UI Utilities|Popover & UI Utilities]]
- [[_COMMUNITY_Key-Value Parameter Editor|Key-Value Parameter Editor]]
- [[_COMMUNITY_Script Editor (CodeMirror)|Script Editor (CodeMirror)]]
- [[_COMMUNITY_Accent Theme System|Accent Theme System]]
- [[_COMMUNITY_App Icon Design|App Icon Design]]
- [[_COMMUNITY_Keyboard & Animation Handlers|Keyboard & Animation Handlers]]
- [[_COMMUNITY_Database Row Utilities|Database Row Utilities]]
- [[_COMMUNITY_Template Variable System|Template Variable System]]
- [[_COMMUNITY_JWT Decode Utilities|JWT Decode Utilities]]
- [[_COMMUNITY_HTTP Method Utilities|HTTP Method Utilities]]
- [[_COMMUNITY_Sidebar Panel Handlers|Sidebar Panel Handlers]]
- [[_COMMUNITY_Project & Folder Parsing|Project & Folder Parsing]]
- [[_COMMUNITY_Settings & Shortcuts|Settings & Shortcuts]]
- [[_COMMUNITY_Automation Runner|Automation Runner]]
- [[_COMMUNITY_App State Context Reducer|App State Context Reducer]]
- [[_COMMUNITY_System Stats Sparkline|System Stats Sparkline]]
- [[_COMMUNITY_File Picker Modal|File Picker Modal]]
- [[_COMMUNITY_Theme Toggle|Theme Toggle]]
- [[_COMMUNITY_Body Editor Component|Body Editor Component]]
- [[_COMMUNITY_Environment Selector|Environment Selector]]
- [[_COMMUNITY_Template Resolution|Template Resolution]]
- [[_COMMUNITY_Body Formatting Utilities|Body Formatting Utilities]]
- [[_COMMUNITY_Release Version Script|Release Version Script]]
- [[_COMMUNITY_Update Checker|Update Checker]]
- [[_COMMUNITY_Error Boundary|Error Boundary]]
- [[_COMMUNITY_Cookie View|Cookie View]]
- [[_COMMUNITY_Shortcut Modal|Shortcut Modal]]
- [[_COMMUNITY_URL Bar|URL Bar]]
- [[_COMMUNITY_Shortcuts Hook|Shortcuts Hook]]
- [[_COMMUNITY_CSV Parser|CSV Parser]]
- [[_COMMUNITY_Project Row Component|Project Row Component]]
- [[_COMMUNITY_Request Item Component|Request Item Component]]
- [[_COMMUNITY_Response Footer|Response Footer]]
- [[_COMMUNITY_Import Modal|Import Modal]]
- [[_COMMUNITY_Refresh Button|Refresh Button]]
- [[_COMMUNITY_File Upload Component|File Upload Component]]
- [[_COMMUNITY_Vite Config|Vite Config]]
- [[_COMMUNITY_New Project Modal|New Project Modal]]
- [[_COMMUNITY_New Folder Modal|New Folder Modal]]
- [[_COMMUNITY_Sidebar Icons|Sidebar Icons]]
- [[_COMMUNITY_Export Modal|Export Modal]]
- [[_COMMUNITY_Response Viewer|Response Viewer]]
- [[_COMMUNITY_Method Badge|Method Badge]]
- [[_COMMUNITY_Confirm Modal|Confirm Modal]]
- [[_COMMUNITY_Accent Toggle|Accent Toggle]]
- [[_COMMUNITY_User Section|User Section]]
- [[_COMMUNITY_Script Examples|Script Examples]]
- [[_COMMUNITY_Content Type Selector|Content Type Selector]]
- [[_COMMUNITY_HTTP Client Hook|HTTP Client Hook]]
- [[_COMMUNITY_Auth Hook|Auth Hook]]
- [[_COMMUNITY_Theme Hook|Theme Hook]]
- [[_COMMUNITY_Editor Memory Hook|Editor Memory Hook]]
- [[_COMMUNITY_Accent Theme Hook|Accent Theme Hook]]
- [[_COMMUNITY_Environment Color Utils|Environment Color Utils]]
- [[_COMMUNITY_Rust Build Script|Rust Build Script]]
- [[_COMMUNITY_Rust Main Entry|Rust Main Entry]]
- [[_COMMUNITY_React Entry Point|React Entry Point]]
- [[_COMMUNITY_Type Declarations|Type Declarations]]
- [[_COMMUNITY_Environment View|Environment View]]
- [[_COMMUNITY_Header Component|Header Component]]
- [[_COMMUNITY_Database Schema Types|Database Schema Types]]
- [[_COMMUNITY_Global Types|Global Types]]
- [[_COMMUNITY_Body Format Worker|Body Format Worker]]
- [[_COMMUNITY_Primary App Icon|Primary App Icon]]
- [[_COMMUNITY_Branded App Icon|Branded App Icon]]
- [[_COMMUNITY_Small App Icon|Small App Icon]]

## God Nodes (most connected - your core abstractions)
1. `SQLite Database` - 12 edges
2. `REST API Testing Tool` - 10 edges
3. `handleSend()` - 7 edges
4. `Callstack App Identity` - 7 edges
5. `Frontend Layer` - 6 edges
6. `project_id Foreign Key` - 6 edges
7. `Callstack App Icon` - 6 edges
8. `create_icon()` - 5 edges
9. `parseItem()` - 5 edges
10. `Callstack` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Callstack Logo 512px (web/public)` --conceptually_related_to--> `Network/Connectivity Design Concept`  [INFERRED]
  web/public/icon-512.png → icon-192.png
- `Bright Color Palette (neon cyan, magenta, bright blue)` --shares_data_with--> `Callstack App Identity`  [INFERRED]
  web/public/icon-512.png → icon-192.png
- `Frontend Layer` --implements--> `React`  [EXTRACTED]
  CLAUDE.md → README.md
- `Data Persistence` --shares_data_with--> `SQLite Database`  [EXTRACTED]
  CLAUDE.md → README.md
- `projects Table` --shares_data_with--> `SQLite Database`  [EXTRACTED]
  CLAUDE.md → README.md

## Hyperedges (group relationships)
- **Frontend-Backend Architecture** — frontend_layer, backend_layer, ipc_communication [EXTRACTED 1.00]
- **Data Flow Pattern** — react_context_reducer, data_persistence, sqlite_database [EXTRACTED 1.00]
- **Design System** — accent_theme_system, spacing_system, jetbrains_mono_font, outfit_font [EXTRACTED 1.00]
- **Callstack Multi-Scale Icon Visual Identity System** — icon_192, icon_32, icon_512_web, icon_512_docs [EXTRACTED 1.00]
- **Performance and Network Connectivity Design Language** — design_concept_speed, design_concept_connectivity, symbolic_lightning, design_style_connector [INFERRED 0.80]
- **Callstack App Icon Design System** — icon_png_callstack_app_icon, design_lightning_bolt_symbol, design_dark_blue_background, design_white_accent_elements [EXTRACTED 1.00]
- **Icon Visual Design System** — icon_design_lightning_bolt, icon_color_dark_navy, icon_color_white_accent, icon_color_teal_highlight [EXTRACTED 1.00]

## Communities

### Community 0 - "Automation & DB Commands"
Cohesion: 0.03
Nodes (15): Automation, AutomationRun, Cookie, Database, DataFile, DuplicateFolderResult, Environment, Folder (+7 more)

### Community 1 - "UI Event Handlers"
Cohesion: 0.06
Nodes (4): applyRequestMove(), handleDropOnFolder(), handleDropOnProject(), handleDropOnRequest()

### Community 2 - "App Architecture & Data Model"
Cohesion: 0.08
Nodes (32): AppContext, automation_runs Table, automations Table, Backend Layer, Callstack, data_files Table, Data Persistence, database.rs (+24 more)

### Community 3 - "Visual Branding & Identity"
Cohesion: 0.13
Nodes (20): Callstack App Icon, Callstack App Identity, Bright Color Palette (neon cyan, magenta, bright blue), Monochromatic Color Palette (white, dark navy), Network/Connectivity Design Concept, Speed/Performance Design Concept, Connector/Network Visual Design, Callstack App Icon 192px (+12 more)

### Community 4 - "HTTP Client & DB Utilities"
Cohesion: 0.13
Nodes (9): AttachmentMeta, CancelHandle, guess_mime(), pick_attachment_files(), run(), save_binary_file(), save_file(), SysInfo (+1 more)

### Community 5 - "Content Detection & Body Format"
Cohesion: 0.13
Nodes (2): onUp(), saveHeights()

### Community 6 - "Automation Runner Utilities"
Cohesion: 0.13
Nodes (0): 

### Community 7 - "Request Builder Utilities"
Cohesion: 0.22
Nodes (11): buildCurl(), buildUrlWithParams(), formatBodyAsync(), getContentType(), handleMethodChange(), handleRequestChange(), handleSend(), normalizeUrl() (+3 more)

### Community 8 - "Rust HTTP Execution"
Cohesion: 0.23
Nodes (12): decompress_body(), execute_request(), FileAttachment, friendly_network_error(), KeyValueParam, load_cookies_for_request(), parse_set_cookie(), ParsedCookie (+4 more)

### Community 9 - "Core Features & Architecture"
Cohesion: 0.17
Nodes (12): CSS Custom Properties Theming, Environments Feature, Google Sign-In, Google Sign-In Authentication, HTTP Methods Support, Offline, Local-First Architecture, Projects and Folders Organization, Request Builder (+4 more)

### Community 10 - "Postman Import/Export"
Cohesion: 0.31
Nodes (6): collectRequests(), parseBody(), parseHeaders(), parseItem(), parsePostmanCollection(), parseUrl()

### Community 11 - "Documentation Scripts"
Cohesion: 0.22
Nodes (2): applyTheme(), toggleTheme()

### Community 12 - "Icon Generation Script"
Cohesion: 0.33
Nodes (8): bolt_polygon(), create_gradient(), create_icon(), generate_all(), hex_to_rgb(), Create a vertical gradient image., Lightning bolt polygon scaled to `size`.     Based on Lucide Zap proportions (v, Create the lightning bolt icon at the given size.

### Community 13 - "Script Execution Engine"
Cohesion: 0.22
Nodes (3): ScriptError, Success, Warn

### Community 14 - "Project Archive Management"
Cohesion: 0.25
Nodes (0): 

### Community 15 - "System Stats & Shortcuts"
Cohesion: 0.29
Nodes (2): captureShortcut(), onKey()

### Community 16 - "Popover & UI Utilities"
Cohesion: 0.36
Nodes (5): calcPopoverPos(), formatTimestamp(), handleClick(), readZoom(), renderValue()

### Community 17 - "Key-Value Parameter Editor"
Cohesion: 0.25
Nodes (0): 

### Community 18 - "Script Editor (CodeMirror)"
Cohesion: 0.25
Nodes (0): 

### Community 19 - "Accent Theme System"
Cohesion: 0.25
Nodes (8): AccentToggle Component, Accent Color Tokens, Accent Theme System, color-mix() Pattern, envUtils Library, getEnvColor() Function, Rationale: Use CSS Tokens Not Hardcoded Hex, useAccentTheme Hook

### Community 20 - "App Icon Design"
Cohesion: 0.36
Nodes (8): Dark Blue Background Color, Geometric Design Style, Lightning Bolt Symbol, White Accent Elements, Callstack 128x128@2x Icon, Callstack 32x32 Icon, Callstack App Icon, Tauri App Branding

### Community 21 - "Keyboard & Animation Handlers"
Cohesion: 0.29
Nodes (0): 

### Community 22 - "Database Row Utilities"
Cohesion: 0.29
Nodes (0): 

### Community 23 - "Template Variable System"
Cohesion: 0.52
Nodes (5): getTemplateContext(), handleChange(), handleKeyDown(), insertSuggestion(), updateSuggestions()

### Community 24 - "JWT Decode Utilities"
Cohesion: 0.52
Nodes (5): b64urlDecode(), decodeJwt(), findJwtsInBody(), isJwt(), stripBearer()

### Community 25 - "HTTP Method Utilities"
Cohesion: 0.33
Nodes (2): getImplicitDefaults(), getImplicitHeaders()

### Community 26 - "Sidebar Panel Handlers"
Cohesion: 0.33
Nodes (0): 

### Community 27 - "Project & Folder Parsing"
Cohesion: 0.33
Nodes (0): 

### Community 28 - "Settings & Shortcuts"
Cohesion: 0.33
Nodes (0): 

### Community 29 - "Automation Runner"
Cohesion: 0.33
Nodes (0): 

### Community 30 - "App State Context Reducer"
Cohesion: 0.5
Nodes (2): appReducer(), safeReducer()

### Community 31 - "System Stats Sparkline"
Cohesion: 0.4
Nodes (0): 

### Community 32 - "File Picker Modal"
Cohesion: 0.4
Nodes (0): 

### Community 33 - "Theme Toggle"
Cohesion: 0.4
Nodes (0): 

### Community 34 - "Body Editor Component"
Cohesion: 0.4
Nodes (0): 

### Community 35 - "Environment Selector"
Cohesion: 0.4
Nodes (0): 

### Community 36 - "Template Resolution"
Cohesion: 0.4
Nodes (0): 

### Community 37 - "Body Formatting Utilities"
Cohesion: 0.7
Nodes (4): formatBody(), formatJson(), formatXml(), normalizeLineEndings()

### Community 38 - "Release Version Script"
Cohesion: 0.7
Nodes (4): currentVersion(), git(), main(), prompt()

### Community 39 - "Update Checker"
Cohesion: 0.5
Nodes (0): 

### Community 40 - "Error Boundary"
Cohesion: 0.5
Nodes (0): 

### Community 41 - "Cookie View"
Cohesion: 0.5
Nodes (0): 

### Community 42 - "Shortcut Modal"
Cohesion: 0.5
Nodes (0): 

### Community 43 - "URL Bar"
Cohesion: 0.5
Nodes (0): 

### Community 44 - "Shortcuts Hook"
Cohesion: 0.5
Nodes (0): 

### Community 45 - "CSV Parser"
Cohesion: 0.5
Nodes (0): 

### Community 46 - "Project Row Component"
Cohesion: 0.67
Nodes (0): 

### Community 47 - "Request Item Component"
Cohesion: 1.0
Nodes (2): commit(), handleKeyDown()

### Community 48 - "Response Footer"
Cohesion: 0.67
Nodes (0): 

### Community 49 - "Import Modal"
Cohesion: 0.67
Nodes (0): 

### Community 50 - "Refresh Button"
Cohesion: 0.67
Nodes (0): 

### Community 51 - "File Upload Component"
Cohesion: 0.67
Nodes (0): 

### Community 52 - "Vite Config"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "New Project Modal"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "New Folder Modal"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Sidebar Icons"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Export Modal"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Response Viewer"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Method Badge"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Confirm Modal"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Accent Toggle"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "User Section"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Script Examples"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Content Type Selector"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "HTTP Client Hook"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Auth Hook"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Theme Hook"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Editor Memory Hook"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Accent Theme Hook"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Environment Color Utils"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Rust Build Script"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Rust Main Entry"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "React Entry Point"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Type Declarations"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "Environment View"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "Header Component"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "Database Schema Types"
Cohesion: 1.0
Nodes (0): 

### Community 77 - "Global Types"
Cohesion: 1.0
Nodes (0): 

### Community 78 - "Body Format Worker"
Cohesion: 1.0
Nodes (0): 

### Community 79 - "Primary App Icon"
Cohesion: 1.0
Nodes (1): Callstack Lightning Bolt Icon (Primary Design)

### Community 80 - "Branded App Icon"
Cohesion: 1.0
Nodes (1): Callstack Icon with Text Branding

### Community 81 - "Small App Icon"
Cohesion: 1.0
Nodes (1): Simplified 128x128 Lightning Bolt Icon

## Knowledge Gaps
- **56 isolated node(s):** `Create a vertical gradient image.`, `Lightning bolt polygon scaled to `size`.     Based on Lucide Zap proportions (v`, `Create the lightning bolt icon at the given size.`, `Project`, `Request` (+51 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Vite Config`** (2 nodes): `manualChunks()`, `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `New Project Modal`** (2 nodes): `NewProjectModal()`, `NewProjectModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `New Folder Modal`** (2 nodes): `NewFolderModal()`, `NewFolderModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sidebar Icons`** (2 nodes): `Chevron()`, `SidebarIcons.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Export Modal`** (2 nodes): `MethodBadge()`, `ExportModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Response Viewer`** (2 nodes): `ResponseViewer()`, `ResponseViewer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Method Badge`** (2 nodes): `MethodBadge()`, `MethodBadge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Confirm Modal`** (2 nodes): `ConfirmModal()`, `ConfirmModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Accent Toggle`** (2 nodes): `ColorIcon()`, `AccentToggle.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `User Section`** (2 nodes): `UserSection()`, `UserSection.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Script Examples`** (2 nodes): `handleCopy()`, `ScriptExamples.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Content Type Selector`** (2 nodes): `handler()`, `ContentTypeSelector.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `HTTP Client Hook`** (2 nodes): `useHttpClient()`, `useHttpClient.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Hook`** (2 nodes): `useAuth()`, `useAuth.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Theme Hook`** (2 nodes): `useTheme()`, `useTheme.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Editor Memory Hook`** (2 nodes): `useEditorMemory()`, `useEditorMemory.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Accent Theme Hook`** (2 nodes): `useAccentTheme()`, `useAccentTheme.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Environment Color Utils`** (2 nodes): `getEnvColor()`, `envUtils.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Rust Build Script`** (2 nodes): `main()`, `build.rs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Rust Main Entry`** (2 nodes): `main()`, `main.rs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `React Entry Point`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Type Declarations`** (1 nodes): `env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Environment View`** (1 nodes): `EnvironmentView.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Header Component`** (1 nodes): `Header.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Database Schema Types`** (1 nodes): `callstackSchema.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Global Types`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Body Format Worker`** (1 nodes): `formatBody.worker.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Primary App Icon`** (1 nodes): `Callstack Lightning Bolt Icon (Primary Design)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Branded App Icon`** (1 nodes): `Callstack Icon with Text Branding`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Small App Icon`** (1 nodes): `Simplified 128x128 Lightning Bolt Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Callstack` connect `App Architecture & Data Model` to `Core Features & Architecture`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `REST API Testing Tool` connect `Core Features & Architecture` to `App Architecture & Data Model`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Callstack App Identity` (e.g. with `Bright Color Palette (neon cyan, magenta, bright blue)` and `Lightning Bolt Symbol`) actually correct?**
  _`Callstack App Identity` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Create a vertical gradient image.`, `Lightning bolt polygon scaled to `size`.     Based on Lucide Zap proportions (v`, `Create the lightning bolt icon at the given size.` to the rest of the system?**
  _56 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Automation & DB Commands` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `UI Event Handlers` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `App Architecture & Data Model` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._