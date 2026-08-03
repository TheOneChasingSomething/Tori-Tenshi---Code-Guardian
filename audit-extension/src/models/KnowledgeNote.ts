import { Id, SourceRange } from '../core/Types';

/**
 * Note de la base de connaissances, potentiellement exportée vers Obsidian.
 * `obsidianPath` est renseigné une fois la note matérialisée dans le coffre.
 */
export interface KnowledgeNote {
  id: Id;
  title: string;
  content: string;
  sourceRange?: SourceRange;
  obsidianPath?: string;
  createdAt: string;
}

export type NewKnowledgeNote = Omit<KnowledgeNote, 'id' | 'createdAt'>;
