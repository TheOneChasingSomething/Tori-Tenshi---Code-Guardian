import { AuditDatabase } from '../Database';
import { KnowledgeNote, NewKnowledgeNote } from '../../models/KnowledgeNote';
import { Id } from '../../core/Types';

interface Row {
  id: number;
  title: string;
  content: string;
  file: string | null;
  start_line: number | null;
  end_line: number | null;
  obsidian_path: string | null;
  created_at: string;
}

/** Persistance des notes de la base de connaissances. */
export class KnowledgeRepository {
  constructor(private readonly db: AuditDatabase) {}

  private static map(r: Row): KnowledgeNote {
    return {
      id: r.id,
      title: r.title,
      content: r.content,
      sourceRange:
        r.file && r.start_line !== null && r.end_line !== null
          ? { file: r.file, startLine: r.start_line, startChar: 0, endLine: r.end_line, endChar: 0 }
          : undefined,
      obsidianPath: r.obsidian_path ?? undefined,
      createdAt: r.created_at,
    };
  }

  create(input: NewKnowledgeNote): KnowledgeNote {
    const now = new Date().toISOString();
    const info = this.db.handle
      .prepare(
        `INSERT INTO knowledge_notes (title, content, file, start_line, end_line, obsidian_path, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.title,
        input.content,
        input.sourceRange?.file ?? null,
        input.sourceRange?.startLine ?? null,
        input.sourceRange?.endLine ?? null,
        input.obsidianPath ?? null,
        now
      );
    return { ...input, id: Number(info.lastInsertRowid), createdAt: now };
  }

  setObsidianPath(id: Id, obsidianPath: string): void {
    this.db.handle.prepare('UPDATE knowledge_notes SET obsidian_path = ? WHERE id = ?').run(obsidianPath, id);
  }

  all(): KnowledgeNote[] {
    return (this.db.handle.prepare('SELECT * FROM knowledge_notes ORDER BY created_at DESC').all() as Row[]).map(
      KnowledgeRepository.map
    );
  }
}
