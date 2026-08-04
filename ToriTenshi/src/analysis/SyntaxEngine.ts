/**
 * Neutral syntax-engine abstraction. Plugins depend on this interface, never on
 * a concrete parser, so the analysis backend (Tree-sitter WASM, a future native
 * binding, or a null fallback) can change without touching a single analyzer.
 *
 * Design rationale: Tree-sitter is the target backend [3], but it requires
 * per-language `.wasm` grammars fetched at install time. Until a grammar is
 * present, `parse` returns `undefined` and analyzers fall back to their regex
 * rules. This keeps the extension useful out of the box and lets grammars be
 * added incrementally.
 */

/** A single capture produced by a Tree-sitter query. */
export interface Capture {
  /** Capture name from the query (e.g. "call.dangerous"). */
  name: string;
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
  /** Source text spanned by the captured node. */
  text: string;
}

/** Opaque handle to a parsed tree; only the engine interprets it. */
export interface SyntaxTree {
  readonly languageId: string;
}

export interface SyntaxEngine {
  /** True once a grammar for this language has been successfully loaded. */
  isAvailable(languageId: string): boolean;

  /**
   * Loads the grammar for a language (idempotent). Returns false if the grammar
   * file is missing or fails to load — callers then rely on regex fallback.
   */
  load(languageId: string): Promise<boolean>;

  /** Parses text into a tree, or `undefined` if the grammar is unavailable. */
  parse(text: string, languageId: string): SyntaxTree | undefined;

  /** Runs an S-expression query against a tree and returns its captures. */
  query(tree: SyntaxTree, queryString: string): Capture[];
}
