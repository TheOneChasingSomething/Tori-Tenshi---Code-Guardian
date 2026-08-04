import { AuditDatabase } from '../Database';
import { Bookmark, NewBookmark } from '../../models/Bookmark';
import { Id } from '../../core/Types';

interface Row {
  id: number;
  file: string;
  start_line: number;
  start_char: number;
  end_line: number;
  end_char: number;
  label: string;
  category: string;
  created_at: string;
}

/** Persistence of advanced bookmarks. */
export class BookmarkRepository {
  constructor(private readonly db: AuditDatabase) {}

  private static map(r: Row): Bookmark {
    return {
      id: r.id,
      range: { file: r.file, startLine: r.start_line, startChar: r.start_char, endLine: r.end_line, endChar: r.end_char },
      label: r.label,
      category: r.category,
      createdAt: r.created_at,
    };
  }

  create(input: NewBookmark): Bookmark {
    const now = new Date().toISOString();
    const info = this.db.run(
      `INSERT INTO bookmarks (file, start_line, start_char, end_line, end_char, label, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.range.file, input.range.startLine, input.range.startChar, input.range.endLine, input.range.endChar, input.label, input.category, now]
    );
    return { ...input, id: info.lastInsertRowid, createdAt: now };
  }

  findAt(file: string, startLine: number): Bookmark | undefined {
    const row = this.db.get<Row>('SELECT * FROM bookmarks WHERE file = ? AND start_line = ? LIMIT 1', [file, startLine]);
    return row ? BookmarkRepository.map(row) : undefined;
  }

  findByFile(file: string): Bookmark[] {
    return this.db.all<Row>('SELECT * FROM bookmarks WHERE file = ? ORDER BY start_line', [file]).map(BookmarkRepository.map);
  }

  all(): Bookmark[] {
    return this.db.all<Row>('SELECT * FROM bookmarks ORDER BY category, file, start_line').map(BookmarkRepository.map);
  }

  delete(id: Id): void {
    this.db.run('DELETE FROM bookmarks WHERE id = ?', [id]);
  }

  clear(): void {
    this.db.run('DELETE FROM bookmarks');
  }
}
