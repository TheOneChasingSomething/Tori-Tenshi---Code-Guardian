import * as fs from 'fs';
import * as path from 'path';
import { SqlDriver, SqlStatement, RunResult } from '../SqlDriver';
import { Logger } from '../../core/Logger';

/**
 * Portable driver over sql.js (SQLite compiled to WASM). No native build step,
 * so it runs anywhere Node runs. sql.js is fully in-memory, so `persist()`
 * exports the database to disk. `sql.js` is an optional dependency loaded via a
 * non-literal dynamic import, so its absence degrades gracefully (storage.ts
 * falls back to better-sqlite3).
 */
export class SqlJsDriver implements SqlDriver {
  private constructor(private readonly db: any, private readonly file: string, private readonly logger: Logger) {}

  static async open(file: string, logger: Logger): Promise<SqlJsDriver> {
    const moduleName = 'sql.js';
    const mod: any = await import(moduleName);
    const initSqlJs = mod.default ?? mod;
    // Locate sql-wasm.wasm inside the installed sql.js package (Node has no
    // web fetch for it). Falls back to sql.js's own default resolution.
    let locateFile: ((f: string) => string) | undefined;
    try {
      const dist = path.join(path.dirname(require.resolve('sql.js/package.json')), 'dist');
      locateFile = (f: string) => path.join(dist, f);
    } catch {
      locateFile = undefined;
    }
    const SQL = await initSqlJs(locateFile ? { locateFile } : undefined);
    const bytes = fs.existsSync(file) ? new Uint8Array(fs.readFileSync(file)) : undefined;
    const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
    return new SqlJsDriver(db, file, logger);
  }

  exec(sql: string): void {
    this.db.run(sql);
  }

  prepare(sql: string): SqlStatement {
    const db = this.db;
    return {
      run: (...params: unknown[]): RunResult => {
        db.run(sql, params as unknown[]);
        const res = db.exec('SELECT last_insert_rowid() AS id')[0];
        return { lastInsertRowid: res ? Number(res.values[0][0]) : 0, changes: db.getRowsModified() };
      },
      get: (...params: unknown[]): unknown => {
        const stmt = db.prepare(sql);
        try {
          stmt.bind(params as unknown[]);
          return stmt.step() ? stmt.getAsObject() : undefined;
        } finally {
          stmt.free();
        }
      },
      all: (...params: unknown[]): unknown[] => {
        const stmt = db.prepare(sql);
        const rows: unknown[] = [];
        try {
          stmt.bind(params as unknown[]);
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
        } finally {
          stmt.free();
        }
        return rows;
      },
    };
  }

  transaction(fn: () => void): () => void {
    return () => {
      this.db.run('BEGIN');
      try {
        fn();
        this.db.run('COMMIT');
      } catch (e) {
        this.db.run('ROLLBACK');
        throw e;
      }
      void this.persist();
    };
  }

  async persist(): Promise<void> {
    try {
      fs.writeFileSync(this.file, Buffer.from(this.db.export()));
    } catch (e) {
      this.logger.warn(`sql.js persist failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  close(): void {
    this.db.close();
  }
}
