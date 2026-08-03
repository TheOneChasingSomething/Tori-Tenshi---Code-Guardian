import { AuditDatabase } from '../Database';
import { Annotation, NewAnnotation } from '../../models/Annotation';
import { Id } from '../../core/Types';

interface Row {
  id: number;
  file: string;
  start_line: number;
  start_char: number;
  end_line: number;
  end_char: number;
  body: string;
  author: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

/** Persistance des annotations et de leur historique de révisions. */
export class AnnotationRepository {
  constructor(private readonly db: AuditDatabase) {}

  private static map(r: Row): Annotation {
    return {
      id: r.id,
      range: {
        file: r.file,
        startLine: r.start_line,
        startChar: r.start_char,
        endLine: r.end_line,
        endChar: r.end_char,
      },
      body: r.body,
      author: r.author,
      revision: r.revision,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  create(input: NewAnnotation): Annotation {
    const now = new Date().toISOString();
    const h = this.db.handle;
    const insert = h.prepare(
      `INSERT INTO annotations
         (file, start_line, start_char, end_line, end_char, body, author, revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    );
    const info = insert.run(
      input.range.file,
      input.range.startLine,
      input.range.startChar,
      input.range.endLine,
      input.range.endChar,
      input.body,
      input.author,
      now,
      now
    );
    const id = Number(info.lastInsertRowid);
    this.recordRevision(id, 1, input.body, now);
    return { id, range: input.range, body: input.body, author: input.author, revision: 1, createdAt: now, updatedAt: now };
  }

  /** Édite une annotation : incrémente la révision et archive l'ancien corps. */
  edit(id: Id, body: string): void {
    const now = new Date().toISOString();
    const h = this.db.handle;
    const tx = h.transaction(() => {
      const current = h.prepare('SELECT revision FROM annotations WHERE id = ?').get(id) as { revision: number } | undefined;
      if (!current) {
        return;
      }
      const next = current.revision + 1;
      h.prepare('UPDATE annotations SET body = ?, revision = ?, updated_at = ? WHERE id = ?').run(body, next, now, id);
      this.recordRevision(id, next, body, now);
    });
    tx();
  }

  private recordRevision(annotationId: Id, revision: number, body: string, at: string): void {
    this.db.handle
      .prepare('INSERT INTO annotation_revisions (annotation_id, revision, body, created_at) VALUES (?, ?, ?, ?)')
      .run(annotationId, revision, body, at);
  }

  findByFile(file: string): Annotation[] {
    return (this.db.handle.prepare('SELECT * FROM annotations WHERE file = ? ORDER BY start_line').all(file) as Row[]).map(
      AnnotationRepository.map
    );
  }

  all(): Annotation[] {
    return (this.db.handle.prepare('SELECT * FROM annotations ORDER BY file, start_line').all() as Row[]).map(
      AnnotationRepository.map
    );
  }

  delete(id: Id): void {
    this.db.handle.prepare('DELETE FROM annotations WHERE id = ?').run(id);
  }
}
