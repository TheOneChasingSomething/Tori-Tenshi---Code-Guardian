import * as vscode from 'vscode';
import { Logger } from '../core/Logger';
import { Configuration } from '../core/Configuration';
import { KnowledgeRepository } from '../persistence/repositories/KnowledgeRepository';
import { KnowledgeNote, ObsidianNoteType } from '../models/KnowledgeNote';
import { NOTE_TYPES, timestampId } from './noteTypes';

/** Result of a single note export. */
export interface ExportResult {
  note: KnowledgeNote;
  vaultPath: string;
}

/**
 * Native Obsidian integration. Materializes knowledge notes as Markdown files
 * inside the configured vault, following the vault conventions: a timestamped
 * id, a decorated file name, the per-type subfolder under the knowledge root,
 * and YAML frontmatter (`rédaction`, tags, `Knowledge-index`).
 *
 * All disk access goes through `vscode.workspace.fs`, which works uniformly
 * across desktop and remote/web hosts [2].
 */
export class ObsidianService {
  constructor(
    private readonly config: Configuration,
    private readonly logger: Logger,
    private readonly notes: KnowledgeRepository
  ) {}

  /** True when a vault path is configured; export commands no-op otherwise. */
  isConfigured(): boolean {
    return this.config.obsidianVaultPath.length > 0;
  }

  /**
   * Builds the Markdown payload for a note: YAML frontmatter derived from the
   * vault conventions, followed by the note body. Kept pure and testable.
   */
  buildMarkdown(note: KnowledgeNote, type: ObsidianNoteType): string {
    const spec = NOTE_TYPES[type];
    const today = new Date().toISOString().slice(0, 10);
    const index = this.config.obsidianKnowledgeIndex;

    const front: string[] = ['---', `rédaction: ${today}`, 'tags:', `  - ${spec.tag}`];
    if (index) {
      front.push(`Knowledge-index: "[[${index}]]"`);
    }
    if (type === 'slides' || type === 'groom') {
      front.push('ImpactScore: None');
    }
    front.push('---', '');

    const provenance =
      note.sourceRange !== undefined
        ? `> Source: \`${note.sourceRange.file}\` (L${note.sourceRange.startLine + 1})\n\n`
        : '';

    return front.join('\n') + provenance + note.content.trimEnd() + '\n';
  }

  /** Computes the vault-relative file path "<root>/<folder>/<id> - <deco>.md". */
  relativePathFor(note: KnowledgeNote, type: ObsidianNoteType, id: string): string {
    const spec = NOTE_TYPES[type];
    const safeSubject = note.title.replace(/[\\/:*?"<>|]/g, ' ').trim();
    const fileName = `${id} - ${spec.decorate(safeSubject)}.md`;
    return `${this.config.obsidianKnowledgeRoot}/${spec.folder}/${fileName}`;
  }

  /**
   * Writes one note into the vault and records its path in the database.
   * Chooses the note type from the argument, else the configured default.
   */
  async export(note: KnowledgeNote, type?: ObsidianNoteType): Promise<ExportResult | undefined> {
    if (!this.isConfigured()) {
      this.logger.warn('Obsidian export skipped: no vault path configured (audit.obsidian.vaultPath).');
      return undefined;
    }
    const resolvedType = type ?? note.obsidianType ?? this.config.obsidianDefaultNoteType;
    const id = note.obsidianId ?? timestampId();
    const relative = this.relativePathFor(note, resolvedType, id);

    const vaultRoot = vscode.Uri.file(this.config.obsidianVaultPath);
    const target = vscode.Uri.joinPath(vaultRoot, ...relative.split('/'));
    const folder = vscode.Uri.joinPath(target, '..');

    const markdown = this.buildMarkdown(note, resolvedType);
    await vscode.workspace.fs.createDirectory(folder);
    await vscode.workspace.fs.writeFile(target, Buffer.from(markdown, 'utf8'));

    this.notes.setObsidianPath(note.id, target.fsPath);
    this.logger.info(`Obsidian note written: ${relative}`);
    return { note, vaultPath: target.fsPath };
  }

  /** Exports every not-yet-materialized note; returns the count written. */
  async syncPending(): Promise<number> {
    if (!this.isConfigured()) {
      return 0;
    }
    let count = 0;
    for (const note of this.notes.pendingExport()) {
      const res = await this.export(note);
      if (res) {
        count += 1;
      }
    }
    return count;
  }
}
