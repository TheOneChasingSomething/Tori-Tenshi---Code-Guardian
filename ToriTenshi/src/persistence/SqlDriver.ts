/**
 * Persistence port. Repositories depend only on this minimal, synchronous SQL
 * surface, never on a concrete engine. Any SQL backend (native better-sqlite3,
 * WASM sql.js, or another) is plugged in by implementing `SqlDriver`; a fully
 * non-SQL backend is supported one level up via the repository interfaces in
 * `ports.ts`.
 */

export interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

/** Prepared statement, parameters bound positionally (`?`). */
export interface SqlStatement {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface SqlDriver {
  /** Executes one or more statements with no result (used by migrations). */
  exec(sql: string): void;
  prepare(sql: string): SqlStatement;
  /** Wraps `fn` in a transaction; returns a callable that runs it. */
  transaction(fn: () => void): () => void;
  /**
   * Flushes in-memory state to durable storage. A no-op for engines that write
   * through (better-sqlite3); a real export for in-memory engines (sql.js).
   */
  persist(): Promise<void>;
  close(): void;
}
