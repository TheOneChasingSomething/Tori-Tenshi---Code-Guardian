import { AuditDatabase } from '../Database';
import { TrustNode, NewTrustNode } from '../../models/TrustNode';
import { Id, NodeKind, TrustState } from '../../core/Types';

interface Row {
  id: number;
  key: string;
  label: string;
  kind: string;
  state: string;
  file: string | null;
  updated_at: string;
}

/**
 * Persistence of trust-graph nodes. Insertion is an `upsert` on the stable key:
 * re-analyzing a file updates the label without clobbering the review state.
 */
export class TrustNodeRepository {
  constructor(private readonly db: AuditDatabase) {}

  private static map(r: Row): TrustNode {
    return { id: r.id, key: r.key, label: r.label, kind: r.kind as NodeKind, state: r.state as TrustState, file: r.file ?? undefined, updatedAt: r.updated_at };
  }

  /** Inserts or updates the node identified by `key`, preserving its state. */
  upsert(input: NewTrustNode): TrustNode {
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO trust_nodes (key, label, kind, state, file, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET label = excluded.label, kind = excluded.kind, file = excluded.file, updated_at = excluded.updated_at`,
      [input.key, input.label, input.kind, input.state, input.file ?? null, now]
    );
    return this.findByKey(input.key)!;
  }

  setState(id: Id, state: TrustState): void {
    this.db.run('UPDATE trust_nodes SET state = ?, updated_at = ? WHERE id = ?', [state, new Date().toISOString(), id]);
  }

  findByKey(key: string): TrustNode | undefined {
    const row = this.db.get<Row>('SELECT * FROM trust_nodes WHERE key = ?', [key]);
    return row ? TrustNodeRepository.map(row) : undefined;
  }

  all(): TrustNode[] {
    return this.db.all<Row>('SELECT * FROM trust_nodes ORDER BY label').map(TrustNodeRepository.map);
  }

  /** Counts nodes per state, for the progress dashboard. */
  countByState(): Record<string, number> {
    const rows = this.db.all<{ state: string; n: number }>('SELECT state, COUNT(*) AS n FROM trust_nodes GROUP BY state');
    const out: Record<string, number> = {};
    for (const r of rows) {
      out[r.state] = r.n;
    }
    return out;
  }
}
