# Changelog

## [0.8.0] — Modular persistence & grammar sourcing
### Added
- `SqlDriver` port + `BetterSqliteDriver` (native) and `SqlJsDriver` (WASM) implementations, selectable via `audit.storage.backend`.
- Repository interfaces (`ports.ts`) and a `Storage` bundle; every service/UI/command now depends on the interfaces, so a non-SQL backend can be plugged in.
- `storage.ts` factory: picks the driver from config, assembles the SQL `Storage`, falls back to native if sql.js is unavailable.
- Automatic Tree-sitter grammar resolution via the `tree-sitter-wasms` package (nvim-treesitter-style WASM parser set), with configured-path and bundled-dir fallbacks; regex baseline retained.
- Settings `audit.storage.backend`, `audit.storage.file`; optional dependencies `sql.js`, `tree-sitter-wasms`.
### Changed
- `AuditDatabase` no longer depends on better-sqlite3 directly; repositories bind parameters positionally for cross-driver compatibility.

## [0.7.0] — Phase 7
### Added
- `ReportService` / `ReportModel`: aggregate trust states, diagnostics, annotations, bookmarks and notes; compute coverage.
- Markdown renderer (opened as a document) and self-contained printable HTML renderer (browser Print -> Save as PDF).
- `DashboardPanel`: live progress dashboard WebView (state distribution, findings by severity, coverage, counts) with report export, CSP + nonce.
- Commands `audit.showDashboard`, `audit.generateReport`; media/dashboard.js + dashboard.css.

## [0.6.0] — Phase 6
### Added
- AI connector layer: `AiConnector` contract, OpenAI-compatible `chatCompletion` client, prompt builder.
- Connectors: `LocalConnector` (no inference, deterministic synthesis), `LocalLlmConnector` (Ollama/LM Studio/vLLM), `RemoteAgentConnector` (Windsurf, token from SecretStorage).
- `AiService`: single choke point enforcing mode selection, exclusion globs (no excluded file reaches any model), remote enable flag, and one-time recorded consent.
- Commands: `audit.explainSelection`, `audit.reviewFile`, `audit.aiStatus`, `audit.authorizeRemoteAgent`, `audit.setRemoteAgentToken`.
- Settings: `audit.llm.model`, `audit.remoteAgent.endpoint` (token stored in SecretStorage).
- AI results open as an untitled Markdown document.

## [0.5.0] — Phase 5
### Added
- `ProcessRunner`: safe child-process wrapper (array args, no shell, timeout, ENOENT-aware availability probe).
- `Linter` framework + `DynamicService`: opt-in external linters with cached availability detection and concurrent runs.
- Linters: hadolint, eslint, ansible-lint, ruff, cppcheck, shellcheck (JSON or grep-format parsers into Findings).
- `QemuInspector`: read-only disk-image metadata via `qemu-img info` (no VM boot, no guest execution).
- Dynamic findings merged into diagnostics through `AnalysisRunner`; `includeDynamic` flag; on-save gated by `audit.dynamic.runOnSave`.
- Commands `audit.runLinters`, `audit.checkTools`, `audit.inspectImage`.
- Settings `audit.dynamic.enabled` (default off), `audit.dynamic.runOnSave`, `audit.dynamic.timeoutMs`.

## [0.4.0] — Phase 4
### Added
- `GraphService` / `GraphModel`: build the trust graph, filter by state/kind, compute per-node depth (longest path) for the architecture layout.
- `GraphPanel`: interactive trust-graph WebView with a strict CSP + nonce, loading `media/graph.js` and `media/graph.css` as webview URIs.
- Dependency-free force-directed canvas graph: state-coloured nodes, force/layered layouts, per-state filters, label search, drag, double-click to open, in-graph state selector.
- Command `audit.showGraph` and a trust-graph view-title button.

## [0.3.0] — Phase 3
### Added
- Syntax-engine abstraction (`SyntaxEngine`) with `WebTreeSitterEngine` (WASM) and `NullSyntaxEngine` fallback.
- `RuleBasedPlugin` framework: declarative regex rules + optional Tree-sitter query rules.
- Analyzers: Docker, Ansible, Packer/HCL, Python (+ query rule), JavaScript/TypeScript, C, C++, HTML.
- Shared unsafe-libc rule set for C/C++ (CWE-120/242/676/78).
- `DiagnosticsController`: findings surfaced as VS Code diagnostics (Problems panel).
- `AnalysisRunner`: shared analyze -> persist graph -> publish diagnostics pipeline; re-analyze on save.
- Settings: `audit.analysis.grammarsPath`, `audit.analysis.analyzeOnSave`.
- `grammars/` folder with fetch instructions.
### Changed
- Built-in plugins refactored onto the rule framework; `PluginContext` now carries the syntax engine.

## [0.2.0] — Phase 2
### Added
- Annotation engine: gutter/overview-ruler decorations, hover provider, CodeLens (edit/history/delete).
- Annotation editing with revision history and lightweight re-anchoring on text edits.
- Advanced bookmarks: model, migration (v2), repository, tree view, toggle/goto/clear commands, `Ctrl+Alt+K`.
- Knowledge base: note provenance (source annotation) and Obsidian metadata columns.
- Native Obsidian integration: `ObsidianService` writing notes into the vault following the 5_Knowledges conventions (timestamped id, per-type folder/decoration, YAML frontmatter), export + sync commands.
- Settings: `audit.obsidian.vaultPath`, `knowledgeRoot`, `defaultNoteType`, `knowledgeIndex`.
### Changed
- Whole codebase (comments, UI strings, manifest, docs) translated to English.

## [0.1.0] — Phase 1
### Added
- VS Code extension scaffold (manifest, activation, dependency injection).
- Core: Types, Logger, typed EventBus, Result, Configuration (3 AI modes + exclusions).
- SQLite persistence (better-sqlite3): wrapper, migrator, initial schema, repositories.
- Plugin system: AuditPlugin contract, PluginManager (routing, failure isolation).
- Built-in plugins: Docker (DKR001–003), Ansible (ANS001–002), Packer (stub).
- UI: Annotations / Trust graph / Knowledge base tree views.
- Commands: scan, annotate, set state, export Obsidian, refresh.
