# Audit Extension

A VS Code extension for **assisted code review and security auditing**, built on
a plugin-oriented architecture. Each technology (Ansible, Docker, Packer, Python,
JavaScript, C, C++, HTML…) is analyzed by an independent plugin: the core never
contains language-specific analysis logic.

> Status: **Phases 1–3** of the specification.
> Phase 1 — architecture, plugin system, SQLite persistence, tree views, commands.
> Phase 2 — annotation engine, advanced bookmarks, knowledge base, Obsidian integration.
> Phase 3 — analyzers for Docker, Ansible, Packer, Python, JS/TS, C, C++, HTML on a
> Tree-sitter-backed rule framework, with findings surfaced as VS Code diagnostics.
> Phases 4–7 (interactive graph, dynamic analysis, AI connectors, reports) remain.

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
| `audit.exportObsidian`        | `Ctrl+Shift+O` — create a note (and write to vault).|
| `audit.syncObsidian`          | Write all pending notes into the vault.             |

## Roadmap

1. ✅ Architecture, plugins, SQLite, tree views, persistence.
2. ✅ Annotation engine, advanced bookmarks, knowledge base, Obsidian integration.
3. ✅ Ansible/Docker/Packer/Python/JS/C/C++/HTML analyzers (Tree-sitter + diagnostics).
4. ⬜ Graph engine + interactive visualization (WebView).
5. ⬜ Dynamic analysis (Ansible, Docker, QEMU) + linters.
6. ⬜ AI connectors (local by default, Windsurf on authorization).
7. ⬜ Audit reports in Markdown/HTML/PDF + progress dashboard.

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
