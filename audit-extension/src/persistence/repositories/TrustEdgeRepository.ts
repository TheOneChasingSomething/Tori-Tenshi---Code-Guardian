import { AuditDatabase } from '../Database';
import { TrustEdge } from '../../models/TrustEdge';
import { Id } from '../../core/Types';

interface Row {
  id: number;
  from_id: number;
  to_id: number;
  label: string | null;
}

/** Persistance des arêtes du graphe de confiance. */
export class TrustEdgeRepository {
  constructor(private readonly db: AuditDatabase) {}

  private static map(r: Row): TrustEdge {
    return { id: r.id, fromId: r.from_id, toId: r.to_id, label: r.label ?? undefined };
  }

  /** Ajoute une arête si elle n'existe pas déjà (contrainte UNIQUE). */
  upsert(fromId: Id, toId: Id, label?: string): void {
    this.db.handle
      .prepare(
        `INSERT INTO trust_edges (from_id, to_id, label) VALUES (?, ?, ?)
         ON CONFLICT(from_id, to_id) DO UPDATE SET label = excluded.label`
      )
      .run(fromId, toId, label ?? null);
  }

  all(): TrustEdge[] {
    return (this.db.handle.prepare('SELECT * FROM trust_edges').all() as Row[]).map(TrustEdgeRepository.map);
  }
}
