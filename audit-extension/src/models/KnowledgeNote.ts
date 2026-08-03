import { Id, SourceRange } from '../core/Types';

/** Obsidian note type, mirroring the user's 5_Knowledges taxonomy. */
export type ObsidianNoteType = 'index' | 'flashcard' | 'cheatsheet' | 'gist' | 'slides' | 'groom';

/**
 * Knowledge-base note, optionally exported to Obsidian.
 * `obsidianPath` is set once the note is materialized inside the vault;
 * `obsidianType`/`obsidianId` capture the vault taxonomy and timestamped id.
 * `sourceAnnotationId` records provenance when the note is derived from an
 * annotation.
 */
export interface KnowledgeNote {
  id: Id;
  title: string;
  content: string;
  sourceRange?: SourceRange;
  obsidianPath?: string;
  obsidianType?: ObsidianNoteType;
  obsidianId?: string;
  sourceAnnotationId?: Id;
  createdAt: string;
}

export type NewKnowledgeNote = Omit<KnowledgeNote, 'id' | 'createdAt'>;
