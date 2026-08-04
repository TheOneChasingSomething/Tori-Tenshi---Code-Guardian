import { ObsidianNoteType } from '../models/KnowledgeNote';

/**
 * Specification of an Obsidian note type, mirroring the user's 5_Knowledges
 * vault conventions: target subfolder, frontmatter tag, and the filename
 * decoration applied to the subject.
 */
export interface NoteTypeSpec {
  type: ObsidianNoteType;
  /** Subfolder under the knowledge root (e.g. "3 - Gist"). */
  folder: string;
  /** Frontmatter tag applied to notes of this type. */
  tag: string;
  /** Decorates the subject as used in the file name (e.g. "@@ Subject @@"). */
  decorate(subject: string): string;
}

/**
 * Note-type registry. Decorations and folders follow the vault conventions:
 *   index      "{{ S }}"   -> 0 - Index
 *   flashcard  "== S =="   -> 1 - Flashcard
 *   cheatsheet '"" S ""'   -> 2 - CheatSheet
 *   gist       "@@ S @@"   -> 3 - Gist
 *   slides     "** S **"   -> 5 - Slides
 *   groom      ";; S ;;"   -> 6 - Groom
 */
export const NOTE_TYPES: Record<ObsidianNoteType, NoteTypeSpec> = {
  index: { type: 'index', folder: '0 - Index', tag: 'project-knowledge-note', decorate: (s) => `{{ ${s} }}` },
  flashcard: { type: 'flashcard', folder: '1 - Flashcard', tag: 'flashcard-note', decorate: (s) => `== ${s} ==` },
  cheatsheet: { type: 'cheatsheet', folder: '2 - CheatSheet', tag: 'cheatsheet-note', decorate: (s) => `"" ${s} ""` },
  gist: { type: 'gist', folder: '3 - Gist', tag: 'gist-note', decorate: (s) => `@@ ${s} @@` },
  slides: { type: 'slides', folder: '5 - Slides', tag: 'permanent-note', decorate: (s) => `** ${s} **` },
  groom: { type: 'groom', folder: '6 - Groom', tag: 'permanent-note', decorate: (s) => `;; ${s} ;;` },
};

/**
 * Timestamped note id, format YYYYMMDDHHmm (e.g. 202605122044), matching the
 * vault's naming convention.
 */
export function timestampId(now = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}`;
}
