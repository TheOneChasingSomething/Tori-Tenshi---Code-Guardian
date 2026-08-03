import { Id, SourceRange } from '../core/Types';

/**
 * Advanced bookmark: a lightweight, categorized navigation marker, distinct
 * from an annotation (which carries reviewer prose and revision history).
 * Bookmarks are meant for fast "come back here" navigation during a review.
 */
export interface Bookmark {
  id: Id;
  range: SourceRange;
  label: string;
  /** Free-form category/tag used to group bookmarks in the tree (e.g. "todo", "entrypoint"). */
  category: string;
  createdAt: string;
}

export type NewBookmark = Omit<Bookmark, 'id' | 'createdAt'>;
