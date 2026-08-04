import { AuditDatabase } from '../Database';
import { KnowledgeNote, NewKnowledgeNote, ObsidianNoteType } from '../../models/KnowledgeNote';
import { Id } from '../../core/Types';

interface Row {
  id: number;
  title: string;
  content: string;
  file: string | null;
  start_line: number | null;
  end_line: number | null;
  obsidian_path: string | null;
  obsidian_type: string | null;
  obsidian_id: string | null;
  source_annotation_id: number | null;
  created_at: string;
}

/** Persistence of knowledge-base notes and their Obsidian metadata. */
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
      obsidianType: (r.obsidian_type as ObsidianNoteType | null) ?? undefined,
      obsidianId: r.obsidian_id ?? undefined,
      sourceAnnotationId: r.source_annotation_id ?? undefined,
      createdAt: r.created_at,
    };
  }

  create(input: NewKnowledgeNote): KnowledgeNote {
    const now = new Date().toISOString();
    const info = this.db.run(
      `INSERT INTO knowledge_notes (title, content, file, start_line, end_line, obsidian_path, obsidian_type, obsidian_id, source_annotation_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.title,
        input.content,
        input.sourceRange?.file ?? null,
        input.sourceRange?.startLine ?? null,
        input.sourceRange?.endLine ?? null,
        input.obsidianPath ?? null,
        input.obsidianType ?? null,
        input.obsidianId ?? null,
        input.sourceAnnotationId ?? null,
        now,
      ]
    );
    return { ...input, id: info.lastInsertRowid, createdAt: now };
  }

  findById(id: Id): KnowledgeNote | undefined {
    const row = this.db.get<Row>('SELECT * FROM knowledge_notes WHERE id = ?', [id]);
    return row ? KnowledgeRepository.map(row) : undefined;
  }

  setObsidianPath(id: Id, obsidianPath: string): void {
    this.db.run('UPDATE knowledge_notes SET obsidian_path = ? WHERE id = ?', [obsidianPath, id]);
  }

  pendingExport(): KnowledgeNote[] {
    return this.db.all<Row>('SELECT * FROM knowledge_notes WHERE obsidian_path IS NULL ORDER BY created_at').map(KnowledgeRepository.map);
  }

  all(): KnowledgeNote[] {
    return this.db.all<Row>('SELECT * FROM knowledge_notes ORDER BY created_at DESC').map(KnowledgeRepository.map);
  }
}
