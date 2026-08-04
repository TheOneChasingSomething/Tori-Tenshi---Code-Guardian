import Database from 'better-sqlite3';
import { SqlDriver, SqlStatement, RunResult } from '../SqlDriver';

/**
 * Default driver over better-sqlite3 (native, synchronous, write-through).
 * Prepared statements are cached per SQL string. `persist()` is a no-op because
 * the engine already writes to disk on every statement.
 */
export class BetterSqliteDriver implements SqlDriver {
  private readonly cache = new Map<string, Database.Statement>();

  private constructor(private readonly db: Database.Database) {}

  static open(file: string): BetterSqliteDriver {
    const db = new Database(file);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    return new BetterSqliteDriver(db);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string): SqlStatement {
    let stmt = this.cache.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.cache.set(sql, stmt);
    }
    const s = stmt;
    return {
      run: (...params: unknown[]): RunResult => {
        const info = s.run(...params);
        return { lastInsertRowid: Number(info.lastInsertRowid), changes: info.changes };
      },
      get: (...params: unknown[]): unknown => s.get(...params),
      all: (...params: unknown[]): unknown[] => s.all(...params),
    };
  }

  transaction(fn: () => void): () => void {
    return this.db.transaction(fn);
  }

  async persist(): Promise<void> {
    // Write-through engine: nothing to flush.
  }

  close(): void {
    this.db.close();
  }
}
