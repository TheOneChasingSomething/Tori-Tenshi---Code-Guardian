import { Id, SourceRange } from '../core/Types';

/**
 * Annotation attached to a portion of code. Every annotation is versioned
 * (cf. "Understanding history" in the specification): editing creates a new
 * revision rather than overwriting the previous one.
 */
export interface Annotation {
  id: Id;
  range: SourceRange;
  body: string;
  author: string;
  revision: number;      // incremented on every edit
  createdAt: string;     // ISO-8601
  updatedAt: string;     // ISO-8601
}

export type NewAnnotation = Omit<Annotation, 'id' | 'revision' | 'createdAt' | 'updatedAt'>;
