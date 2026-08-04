import { Annotation, NewAnnotation } from '../models/Annotation';
import { TrustNode, NewTrustNode } from '../models/TrustNode';
import { TrustEdge } from '../models/TrustEdge';
import { KnowledgeNote, NewKnowledgeNote } from '../models/KnowledgeNote';
import { Bookmark, NewBookmark } from '../models/Bookmark';
import { Id, TrustState } from '../core/Types';

/**
 * Repository ports. Every consumer (services, UI, commands) depends on these
 * interfaces, never on the SQL classes. A completely different backend — a REST
 * API, a document store, an in-memory fake for tests — is supported by
 * implementing these and assembling them into a `Storage`.
 */

export interface AnnotationStore {
  create(input: NewAnnotation): Annotation;
  edit(id: Id, body: string): void;
  updateRange(id: Id, startLine: number, startChar: number, endLine: number, endChar: number): void;
  findById(id: Id): Annotation | undefined;
  getRevisions(id: Id): { revision: number; body: string; createdAt: string }[];
  findByFile(file: string): Annotation[];
  all(): Annotation[];
  delete(id: Id): void;
}

export interface TrustNodeStore {
  upsert(input: NewTrustNode): TrustNode;
  setState(id: Id, state: TrustState): void;
  findByKey(key: string): TrustNode | undefined;
  all(): TrustNode[];
  countByState(): Record<string, number>;
}

export interface TrustEdgeStore {
  upsert(fromId: Id, toId: Id, label?: string): void;
  all(): TrustEdge[];
}

export interface KnowledgeStore {
  create(input: NewKnowledgeNote): KnowledgeNote;
  findById(id: Id): KnowledgeNote | undefined;
  setObsidianPath(id: Id, obsidianPath: string): void;
  pendingExport(): KnowledgeNote[];
  all(): KnowledgeNote[];
}

export interface BookmarkStore {
  create(input: NewBookmark): Bookmark;
  findAt(file: string, startLine: number): Bookmark | undefined;
  findByFile(file: string): Bookmark[];
  all(): Bookmark[];
  delete(id: Id): void;
  clear(): void;
}

/** The full set of repositories plus lifecycle, independent of any engine. */
export interface Storage {
  readonly annotations: AnnotationStore;
  readonly nodes: TrustNodeStore;
  readonly edges: TrustEdgeStore;
  readonly knowledge: KnowledgeStore;
  readonly bookmarks: BookmarkStore;
  /** Flush to durable storage (relevant for in-memory backends). */
  persist(): Promise<void>;
  close(): void;
}
