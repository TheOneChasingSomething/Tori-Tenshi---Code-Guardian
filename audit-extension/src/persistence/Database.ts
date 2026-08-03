import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { Logger } from '../core/Logger';
import { MIGRATIONS } from './migrations';

/**
 * Enveloppe fine autour de better-sqlite3 (pilote synchrone, standard pour
 * les extensions VS Code car il évite la gestion de callbacks asynchrones
 * dans les fournisseurs de TreeView).
 *
 * La base est stockée dans le `storageUri` global de l'extension : un fichier
 * unique par espace de travail, conforme au modèle « fichier unique » de
 * SQLite [4].
 */
export class AuditDatabase {
  private readonly db: Database.Database;

  private constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Ouvre (ou crée) la base au chemin donné, active les clés étrangères et
   * le mode WAL, puis applique les migrations en attente.
   */
  static open(storageDir: string, logger: Logger): AuditDatabase {
    fs.mkdirSync(storageDir, { recursive: true });
    const file = path.join(storageDir, 'audit.sqlite');
    const raw = new Database(file);
    raw.pragma('journal_mode = WAL');
    raw.pragma('foreign_keys = ON');

    const instance = new AuditDatabase(raw);
    instance.migrate(logger);
    logger.info(`Base ouverte : ${file}`);
    return instance;
  }

  /** Applique séquentiellement les migrations non encore exécutées. */
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
        logger.info(`Migration ${migration.version} appliquée : ${migration.name}`);
      }
    });
    run();
  }

  /** Accès de bas niveau réservé aux dépôts (repositories). */
  get handle(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}
