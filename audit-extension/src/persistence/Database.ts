import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { Logger } from '../core/Logger';
import { MIGRATIONS } from './migrations';

/**
 * Thin wrapper around better-sqlite3 (synchronous driver, standard for VS Code
 * extensions because it avoids handling asynchronous callbacks inside
 * TreeView providers).
 *
 * The database lives in the extension's global `storageUri`: a single file per
 * workspace, matching SQLite's single-file model [4].
 */
export class AuditDatabase {
  private readonly db: Database.Database;

  private constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Opens (or creates) the database at the given path, enables foreign keys
   * and WAL mode, then applies any pending migrations.
   */
  static open(storageDir: string, logger: Logger): AuditDatabase {
    fs.mkdirSync(storageDir, { recursive: true });
    const file = path.join(storageDir, 'audit.sqlite');
    const raw = new Database(file);
    raw.pragma('journal_mode = WAL');
    raw.pragma('foreign_keys = ON');

    const instance = new AuditDatabase(raw);
    instance.migrate(logger);
    logger.info(`Database opened: ${file}`);
    return instance;
  }

  /** Applies, in order, the migrations not yet executed. */
  private migrate(logger: Logger): void {
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)'
    );
    const applied = new Set(
      (this.db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version)
    );
    const record = this.db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');

    const run = this.db.transaction(() => {
      for (const migration of MIGRATIONS) {
        if (applied.has(migration.version)) {
          continue;
        }
        this.db.exec(migration.up);
        record.run(migration.version, new Date().toISOString());
        logger.info(`Migration ${migration.version} applied: ${migration.name}`);
      }
    });
    run();
  }

  /** Low-level access reserved for repositories. */
  get handle(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}
