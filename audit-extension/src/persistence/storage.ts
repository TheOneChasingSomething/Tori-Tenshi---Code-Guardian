import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../core/Logger';
import { Configuration } from '../core/Configuration';
import { AuditDatabase } from './Database';
import { SqlDriver } from './SqlDriver';
import { Storage } from './ports';
import { AnnotationRepository } from './repositories/AnnotationRepository';
import { TrustNodeRepository } from './repositories/TrustNodeRepository';
import { TrustEdgeRepository } from './repositories/TrustEdgeRepository';
import { KnowledgeRepository } from './repositories/KnowledgeRepository';
import { BookmarkRepository } from './repositories/BookmarkRepository';

/**
 * SQL-backed Storage: assembles the SQL repositories over one `AuditDatabase`.
 * Because repositories only touch the `SqlDriver` port, this same class works
 * unchanged over any SQL engine.
 */
class SqlStorage implements Storage {
  readonly annotations: AnnotationRepository;
  readonly nodes: TrustNodeRepository;
  readonly edges: TrustEdgeRepository;
  readonly knowledge: KnowledgeRepository;
  readonly bookmarks: BookmarkRepository;

  constructor(private readonly db: AuditDatabase) {
    this.annotations = new AnnotationRepository(db);
    this.nodes = new TrustNodeRepository(db);
    this.edges = new TrustEdgeRepository(db);
    this.knowledge = new KnowledgeRepository(db);
    this.bookmarks = new BookmarkRepository(db);
  }

  persist(): Promise<void> {
    return this.db.persist();
  }

  close(): void {
    this.db.close();
  }
}

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Driver factories are loaded lazily (dynamic import) so that selecting one
 * engine never forces the other to load. This matters for `better-sqlite3`,
 * whose native binary can fail to load (e.g. a glibc mismatch under a Snap
 * VS Code) — importing it eagerly would crash activation even when the user
 * asked for sql.js.
 */
async function openNative(file: string): Promise<SqlDriver> {
  const { BetterSqliteDriver } = await import('./drivers/BetterSqliteDriver');
  return BetterSqliteDriver.open(file);
}
async function openWasm(file: string, logger: Logger): Promise<SqlDriver> {
  const { SqlJsDriver } = await import('./drivers/SqlJsDriver');
  return SqlJsDriver.open(file, logger);
}

/**
 * Opens the configured storage backend with automatic, bidirectional fallback:
 * if the preferred engine cannot be loaded/opened (missing optional dependency,
 * native binary incompatible with the runtime, …) the other engine is tried, so
 * the extension still activates.
 */
export async function openStorage(config: Configuration, storageDir: string, logger: Logger): Promise<Storage> {
  fs.mkdirSync(storageDir, { recursive: true });
  const file = config.storageFile || path.join(storageDir, 'audit.sqlite');

  const preferWasm = config.storageBackend === 'sql.js';
  let driver: SqlDriver;
  let used: string;

  try {
    driver = preferWasm ? await openWasm(file, logger) : await openNative(file);
    used = preferWasm ? 'sql.js' : 'better-sqlite3';
  } catch (primary) {
    const other = preferWasm ? 'better-sqlite3' : 'sql.js';
    logger.warn(`Storage backend "${config.storageBackend}" unavailable (${msg(primary)}); falling back to ${other}.`);
    try {
      driver = preferWasm ? await openNative(file) : await openWasm(file, logger);
      used = other;
    } catch (secondary) {
      throw new Error(
        `No storage backend could be opened. Native: ${msg(preferWasm ? secondary : primary)}. ` +
          `WASM: ${msg(preferWasm ? primary : secondary)}. ` +
          `Install "sql.js" (npm install sql.js) or set audit.storage.backend accordingly.`
      );
    }
  }

  logger.info(`Storage backend: ${used} · file: ${file}`);
  return new SqlStorage(new AuditDatabase(driver, logger));
}
