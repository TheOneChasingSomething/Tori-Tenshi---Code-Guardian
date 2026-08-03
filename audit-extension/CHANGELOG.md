# Changelog

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
