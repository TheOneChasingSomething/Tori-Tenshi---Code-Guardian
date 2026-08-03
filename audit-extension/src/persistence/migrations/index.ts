/**
 * Migrations ordonnées. Chaque migration est idempotente au niveau du
 * runner (elle n'est exécutée que si sa version n'a pas déjà été appliquée),
 * mais son SQL n'a pas besoin de l'être.
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

      -- Historique des révisions d'annotations (compréhension versionnée).
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
