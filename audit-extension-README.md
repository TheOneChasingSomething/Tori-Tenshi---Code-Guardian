# Audit Extension

A VS Code extension for **assisted code review and security auditing**, built on
a plugin-oriented architecture. Each technology (Ansible, Docker, Packer, Python,
JavaScript, C, C++, HTML…) is analyzed by an independent plugin: the core never
contains language-specific analysis logic.

> Status: **all seven phases of the specification implemented.**
> 1 architecture/plugins/SQLite · 2 annotations/bookmarks/knowledge/Obsidian ·
> 3 analyzers (Tree-sitter rule framework) + diagnostics · 4 graph engine + WebView ·
> 5 dynamic analysis (linters + QEMU) · 6 AI connectors (local / local-model / gated
> Windsurf) · 7 audit reports (Markdown/HTML/PDF) + progress dashboard.

## Architecture

```
src/
├── extension.ts          Entry point: activation + dependency injection
├── core/                 Types, Logger, EventBus, Result, Configuration
├── models/               Domain entities (Annotation, TrustNode/Edge, KnowledgeNote, Bookmark)
├── persistence/          SQLite database, migrator, repositories
│   ├── Database.ts
│   ├── migrations/       v1 initial schema · v2 bookmarks + note provenance
│   └── repositories/
├── analysis/             SyntaxEngine (Tree-sitter WASM + null fallback) + RuleBasedPlugin
├── graph/                GraphService (build, filter, depth) + GraphModel
├── dynamic/              ProcessRunner, Linter framework, DynamicService, QemuInspector
│   └── linters/          hadolint, eslint, ansible-lint, ruff, cppcheck, shellcheck
├── ai/                   AiService (gates) + connectors (local, llm-local, remote-agent)
├── report/               ReportService (aggregate + Markdown/HTML renderers) + model
├── plugins/              AuditPlugin contract + PluginManager
│   └── builtin/          Docker, Ansible, Packer, Python, JS/TS, C, C++, HTML
├── obsidian/             Native Obsidian integration (note types + service)
├── services/             AnnotationService (decorations, re-anchoring, providers)
├── ui/                   Tree views + hover/CodeLens/decoration providers
└── commands/             VS Code command registration
```

The layering follows a hexagonal style: `core/` and `models/` have **no**
dependency on the VS Code API and are testable in isolation. Cross-layer
communication goes through a typed `EventBus`, which avoids direct coupling and
eases the addition of plugins [1].

## Phase 2 features

**Annotation engine.** Annotations are shown in the editor via decorations
(overview-ruler mark + subtle highlight), a **hover** popup, and a **CodeLens**
offering edit/history/delete. Every edit is versioned (`annotation_revisions`).
A lightweight **re-anchoring** shifts anchors by the line delta when text is
inserted or removed above them.

**Advanced bookmarks.** Category-grouped navigation markers, distinct from
annotations, with `Ctrl+Alt+K` to toggle, a dedicated tree view, and quick
"go to bookmark".

**Native Obsidian integration.** Knowledge notes are written into the configured
vault following the *5_Knowledges* conventions: a timestamped id, per-type
subfolder and filename decoration (`{{ … }}`, `== … ==`, `"" … ""`, `@@ … @@`,
`** … **`, `;; … ;;`), and YAML frontmatter (`rédaction`, per-type tags,
`Knowledge-index`). All disk access uses `vscode.workspace.fs` [2].

## Phase 3 analyzers

Analyzers are declarative rule sets on a shared `RuleBasedPlugin` base. Each
declares **regex rules** (an immediate, grammar-free baseline) and optional
**Tree-sitter query rules** (precise, structural) that activate once the matching
grammar is present. A `SyntaxEngine` abstraction backs both: `WebTreeSitterEngine`
(WASM [3]) is the primary implementation, `NullSyntaxEngine` the fallback.

Coverage: Docker (DKR001–003 + base-image graph), Ansible (ANS001–003, guarded),
Packer/HCL (PKR001–003), Python (PY001–005 + a query rule), JavaScript/TypeScript
(JS001–005), C and C++ (shared CWE-120/676 libc rules + C++ smells), HTML
(HTML001–004). Findings are published as VS Code **diagnostics** (squiggles +
Problems panel) and files are re-analyzed on save.

> Tree-sitter grammars are not vendored; drop the `.wasm` files into `grammars/`
> (see that folder's README) or set `audit.analysis.grammarsPath`. Analyzers work
> via regex until then.

## Phase 4 trust graph

`GraphService` assembles the trust graph from persisted nodes/edges, applies
state/kind filters, and computes each node's depth (longest path from a root) so
the WebView can offer a **layered "architecture" layout** — the reverse-
engineering view where the dependency chain reads top to bottom.

`GraphPanel` hosts an interactive WebView (`media/graph.js` + `graph.css`): a
dependency-free force-directed graph on a canvas, nodes coloured by trust state,
with a force/layered toggle, per-state filters, label search, double-click to
open a node in the editor, and an in-graph state selector. The panel is theme-
native (VS Code CSS variables) and served under a strict CSP with a per-load
nonce. Open it via **Audit: Open trust graph** or the trust-graph view title.

## Phase 5 dynamic analysis

Static rules are enriched by running external tools as child processes. This is
**opt-in** (`audit.dynamic.enabled`, off by default) and safety-first:

- processes are spawned with an **argument array and no shell**, so file paths
  and code can never be shell-interpreted (`ProcessRunner`);
- every run is **timeout-bounded**; a missing binary is detected and skipped
  silently (availability is probed once and cached);
- **QEMU is inspection-only** — `qemu-img info` reads image metadata; no VM is
  booted and no guest code runs, preserving the local-only guarantee.

Linters: hadolint (Docker), ansible-lint (YAML), ruff (Python), eslint (JS/TS),
cppcheck (C/C++), shellcheck (shell). Their output is parsed into findings and
merged with the static ones into the same diagnostics. Commands: **Run linters
on file**, **Check external tools** (shows what's installed), **Inspect disk
image (QEMU)**.

## Phase 6 AI connectors

The three privacy modes from Phase 1 are now wired to real assistance through a
single choke point, `AiService`, which enforces every gate so connectors never
have to:

- **local** (default) — `LocalConnector` performs no external inference at all:
  it composes a deterministic synthesis (metrics, findings, TODO markers) so the
  default mode is useful without any model;
- **llm-local** — `LocalLlmConnector` calls an OpenAI-compatible endpoint on the
  machine (Ollama, LM Studio, vLLM) at `audit.llm.localEndpoint`; nothing reaches
  the Internet;
- **remote-agent** (Windsurf) — the only connector that transmits externally. It
  runs only when the mode is selected **and** `audit.remoteAgent.enabled` is set
  **and** a one-time, recorded consent has been granted **and** the file does not
  match an exclusion glob. The bearer token lives in VS Code SecretStorage, never
  in settings.

No file matching `audit.exclusionGlobs` is ever sent to *any* model (local or
remote) — only the fully local synthesis may process it. Commands: **Explain
selection**, **Review file**, **AI status**, **Authorize remote agent**, **Set
remote agent token**. Results open as an untitled Markdown document (easy to keep
or turn into an Obsidian note).

## Phase 7 reports & dashboard

`ReportService` aggregates the whole audit — trust-graph states, current
diagnostics (static + dynamic), annotations, bookmarks and knowledge notes — into
a `ReportData` and renders it two ways:

- **Markdown**, opened as a document (drops into the Obsidian flow);
- **HTML**, a self-contained, printable page written to disk and opened in the
  browser, where **Print → Save as PDF** produces the PDF. This avoids bundling a
  headless browser while still delivering the PDF the specification asks for.

`DashboardPanel` is a live progress dashboard (WebView, theme-native, CSP+nonce):
cards for nodes/coverage/findings/annotations/notes, a trust-state distribution
bar, a findings-by-severity bar, and one-click report export. Coverage is
(validated + documented) / total nodes. Open via **Audit: Open dashboard** or the
Annotations view title; generate reports via **Audit: Generate report**.

### Privacy (three AI modes)

| Mode           | Behavior                                                            |
| -------------- | ------------------------------------------------------------------- |
| `local`        | Default. No code leaves the machine (LSP/Tree-sitter/linters).      |
| `llm-local`    | Local model (Ollama, LM Studio, vLLM). No Internet transmission.    |
| `remote-agent` | Remote agent (Windsurf). **Disabled** until `audit.remoteAgent.enabled` is explicitly set. |

`audit.exclusionGlobs` (default `*.pem`, `secrets.yml`, `inventory`, `.env`) are
never transmitted externally (`Configuration.isTransmittable`).

## Install and run

Requirements: Node.js ≥ 18, VS Code ≥ 1.90.

```bash
npm install          # installs better-sqlite3 and the types
npm run compile      # tsc -> out/
# Then, in VS Code: F5 ("Run Extension") to launch a test window.
```

> Note: `better-sqlite3` is a native module recompiled on install. This repository
> was **type-checked offline** (`.typecheck/`, external modules stubbed) but not
> compiled with its real dependencies.

## Commands

| Command                       | Effect                                              |
| ----------------------------- | --------------------------------------------------- |
| `audit.scanWorkspace`         | Analyze the workspace through the plugins.          |
| `audit.addAnnotation`         | Annotate the current selection (versioned).         |
| `audit.editAnnotation`        | Edit an annotation (bumps its revision).            |
| `audit.showAnnotationHistory` | Show an annotation's revision history.              |
| `audit.toggleBookmark`        | `Ctrl+Alt+K` — toggle a bookmark at the cursor.     |
| `audit.gotoBookmark`          | Jump to a bookmark.                                 |
| `audit.setNodeState`          | Change a trust-node's state.                        |
| `audit.showGraph`             | Open the interactive trust-graph WebView.           |
| `audit.runLinters`            | Run external linters on the active file.            |
| `audit.checkTools`            | Show which external tools are installed.            |
| `audit.inspectImage`          | Inspect a disk image with qemu-img (metadata).      |
| `audit.explainSelection`      | Explain the selection with the active AI connector. |
| `audit.reviewFile`            | AI review of the active file.                        |
| `audit.authorizeRemoteAgent`  | Grant/revoke Windsurf consent for the workspace.    |
| `audit.setRemoteAgentToken`   | Store the remote-agent token in SecretStorage.      |
| `audit.showDashboard`         | Open the progress dashboard.                        |
| `audit.generateReport`        | Generate a Markdown or HTML/PDF audit report.       |
| `audit.exportObsidian`        | `Ctrl+Shift+O` — create a note (and write to vault).|
| `audit.syncObsidian`          | Write all pending notes into the vault.             |

## Roadmap

1. ✅ Architecture, plugins, SQLite, tree views, persistence.
2. ✅ Annotation engine, advanced bookmarks, knowledge base, Obsidian integration.
3. ✅ Ansible/Docker/Packer/Python/JS/C/C++/HTML analyzers (Tree-sitter + diagnostics).
4. ✅ Graph engine + interactive visualization (WebView).
5. ✅ Dynamic analysis (linters + QEMU image inspection).
6. ✅ AI connectors (local default, local model, gated Windsurf).
7. ✅ Audit reports in Markdown/HTML/PDF + progress dashboard.

## References

1. Martin, R. C. *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall, 2017.
2. Visual Studio Code. *Extension API*. https://code.visualstudio.com/api
3. Tree-sitter. *Incremental Parsing System*. https://tree-sitter.github.io/tree-sitter/
4. SQLite. *The SQLite Database File Format* & *Documentation*. https://sqlite.org/docs.html
5. Microsoft. *Language Server Protocol Specification*. https://microsoft.github.io/language-server-protocol/

## Appendix — Acronyms

- **API** — *Application Programming Interface*.
- **HCL** — *HashiCorp Configuration Language* (Packer/Terraform).
- **LLM** — *Large Language Model*.
- **LSP** — *Language Server Protocol*.
- **PDF** — *Portable Document Format*.
- **QEMU** — *Quick Emulator*.
- **SQL** — *Structured Query Language*.
- **WAL** — *Write-Ahead Logging* (SQLite journaling mode).
- **YAML** — *YAML Ain't Markup Language*.
