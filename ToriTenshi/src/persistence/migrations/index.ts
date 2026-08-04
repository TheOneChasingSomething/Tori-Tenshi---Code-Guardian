/**
 * Ordered migrations. Each migration is idempotent at the runner level (it is
 * executed only if its version has not already been applied), but its SQL does
 * not need to be.
 */
export interface Migration {
  version: number;
  name: string;
  up: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial-schema',
    up: `
      CREATE TABLE annotations (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        file       TEXT    NOT NULL,
        start_line INTEGER NOT NULL,
        start_char INTEGER NOT NULL,
        end_line   INTEGER NOT NULL,
        end_char   INTEGER NOT NULL,
        body       TEXT    NOT NULL,
        author     TEXT    NOT NULL,
        revision   INTEGER NOT NULL DEFAULT 1,
        created_at TEXT    NOT NULL,
        updated_at TEXT    NOT NULL
      );

      -- History of annotation revisions (versioned understanding).
      CREATE TABLE annotation_revisions (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        annotation_id INTEGER NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
        revision      INTEGER NOT NULL,
        body          TEXT    NOT NULL,
        created_at    TEXT    NOT NULL
      );

      CREATE TABLE trust_nodes (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        key        TEXT    NOT NULL UNIQUE,
        label      TEXT    NOT NULL,
        kind       TEXT    NOT NULL,
        state      TEXT    NOT NULL DEFAULT 'unreviewed',
        file       TEXT,
        updated_at TEXT    NOT NULL
      );

      CREATE TABLE trust_edges (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id INTEGER NOT NULL REFERENCES trust_nodes(id) ON DELETE CASCADE,
        to_id   INTEGER NOT NULL REFERENCES trust_nodes(id) ON DELETE CASCADE,
        label   TEXT,
        UNIQUE (from_id, to_id)
      );

      CREATE TABLE knowledge_notes (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        title         TEXT    NOT NULL,
        content       TEXT    NOT NULL,
        file          TEXT,
        start_line    INTEGER,
        end_line      INTEGER,
        obsidian_path TEXT,
        created_at    TEXT    NOT NULL
      );

      CREATE INDEX idx_annotations_file ON annotations(file);
      CREATE INDEX idx_trust_nodes_state ON trust_nodes(state);
    `,
  },
];

MIGRATIONS.push({
  version: 2,
  name: 'bookmarks-and-note-provenance',
  up: `
    CREATE TABLE bookmarks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      file       TEXT    NOT NULL,
      start_line INTEGER NOT NULL,
      start_char INTEGER NOT NULL,
      end_line   INTEGER NOT NULL,
      end_char   INTEGER NOT NULL,
      label      TEXT    NOT NULL,
      category   TEXT    NOT NULL DEFAULT 'general',
      created_at TEXT    NOT NULL
    );
    CREATE INDEX idx_bookmarks_file ON bookmarks(file);
    CREATE INDEX idx_bookmarks_category ON bookmarks(category);

    -- Provenance and Obsidian metadata for knowledge notes.
    ALTER TABLE knowledge_notes ADD COLUMN obsidian_type TEXT;
    ALTER TABLE knowledge_notes ADD COLUMN obsidian_id TEXT;
    ALTER TABLE knowledge_notes ADD COLUMN source_annotation_id INTEGER;
  `,
});
