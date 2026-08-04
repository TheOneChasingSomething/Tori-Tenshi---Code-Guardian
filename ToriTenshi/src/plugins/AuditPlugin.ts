import { AnalysisResult } from '../core/Types';
import { Logger } from '../core/Logger';
import { Configuration } from '../core/Configuration';
import { SyntaxEngine } from '../analysis/SyntaxEngine';

/**
 * Context provided to each plugin at initialization. It exposes shared services
 * without coupling the plugin to the rest of the extension: a plugin knows only
 * this interface.
 */
export interface PluginContext {
  readonly logger: Logger;
  readonly config: Configuration;
  /** Structural parsing backend (Tree-sitter or a null fallback). */
  readonly syntax: SyntaxEngine;
}

/** Document to analyze, passed to the plugin in a neutral form. */
export interface AnalyzableDocument {
  /** Path relative to the workspace root. */
  relativePath: string;
  /** VS Code language identifier (e.g. "dockerfile", "yaml", "python"). */
  languageId: string;
  /** Text content of the file. */
  text: string;
}

/**
 * Contract that every technology analyzer must implement. Adding a language is
 * limited to providing a new implementation: no change to the core is required
 * (open/closed principle).
 */
export interface AuditPlugin {
  /** Unique, stable identifier (e.g. "docker", "ansible"). */
  readonly id: string;

  /** Human-readable name shown in the UI. */
  readonly displayName: string;

  /**
   * Supported languages or extensions. Used by the PluginManager to route a
   * document to the right analyzers.
   */
  readonly languageIds: string[];

  /** Optional initialization (loading grammars, LSP clients, etc.). */
  activate?(ctx: PluginContext): void | Promise<void>;

  /**
   * Static analysis of a document. Must be pure: no side effects, no disk
   * access beyond the provided text. Returns findings plus nodes/edges.
   */
  analyze(doc: AnalyzableDocument, ctx: PluginContext): AnalysisResult | Promise<AnalysisResult>;

  /** Release of any held resources. */
  dispose?(): void;
}
