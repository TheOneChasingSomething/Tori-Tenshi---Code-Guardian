import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SyntaxEngine, SyntaxTree, Capture } from './SyntaxEngine';
import { Logger } from '../core/Logger';

/**
 * Tree-sitter backend built on `web-tree-sitter` (WASM) [3]. WASM is preferred
 * over native bindings because it runs unchanged in every VS Code host
 * (desktop, remote, web) without per-platform recompilation.
 *
 * Grammars are `.wasm` files resolved under `grammarsDir`, one per language
 * (e.g. `tree-sitter-python.wasm`). They are loaded lazily and cached. If a
 * grammar is missing, the language is marked unavailable and analyzers fall
 * back to regex rules.
 *
 * NOTE: the `web-tree-sitter` dependency and the grammar files are not vendored
 * in this repository; see the README for the fetch step. The code below follows
 * the documented web-tree-sitter API and is guarded so a missing module or
 * grammar never breaks activation.
 */

/** Maps a VS Code languageId to its grammar wasm base name. */
const GRAMMAR_FILE: Record<string, string> = {
  dockerfile: 'tree-sitter-dockerfile.wasm',
  yaml: 'tree-sitter-yaml.wasm',
  hcl: 'tree-sitter-hcl.wasm',
  python: 'tree-sitter-python.wasm',
  javascript: 'tree-sitter-javascript.wasm',
  typescript: 'tree-sitter-typescript.wasm',
  c: 'tree-sitter-c.wasm',
  cpp: 'tree-sitter-cpp.wasm',
  html: 'tree-sitter-html.wasm',
};

interface LoadedLanguage {
  language: unknown; // Parser.Language
  parser: unknown; // Parser
}

interface InternalTree extends SyntaxTree {
  readonly tree: unknown; // Parser.Tree
}

export class WebTreeSitterEngine implements SyntaxEngine {
  private initialized = false;
  private Parser: any; // web-tree-sitter module export
  private readonly languages = new Map<string, LoadedLanguage>();

  constructor(private readonly configuredDir: string, private readonly bundledDir: string, private readonly logger: Logger) {}

  isAvailable(languageId: string): boolean {
    return this.languages.has(languageId);
  }

  /**
   * Directory bundling prebuilt WASM grammars from the `tree-sitter-wasms`
   * package (the WASM counterpart of the nvim-treesitter parser set), if it is
   * installed. Resolved lazily and cached.
   */
  private treeSitterWasmsDir(): string | undefined {
    try {
      const req = eval('require') as NodeRequire;
      return path.join(path.dirname(req.resolve('tree-sitter-wasms/package.json')), 'out');
    } catch {
      return undefined;
    }
  }

  /**
   * Resolves a grammar file across, in order: the configured directory, the
   * `tree-sitter-wasms` package, then the bundled `grammars/` folder. Returns
   * the first path that exists, or undefined (→ regex fallback).
   */
  private resolveWasm(file: string): string | undefined {
    const dirs = [this.configuredDir, this.treeSitterWasmsDir(), this.bundledDir].filter(Boolean) as string[];
    for (const dir of dirs) {
      const candidate = path.join(dir, file);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return undefined;
  }

  private async ensureInit(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    try {
      // Optional runtime dependency. A non-literal specifier keeps the module
      // out of static type resolution, so the extension compiles and runs even
      // when `web-tree-sitter` is not installed (analyzers use regex fallback).
      const moduleName: string = 'web-tree-sitter';
      const mod: any = await import(moduleName);
      this.Parser = mod.default ?? mod;
      await this.Parser.init();
      this.initialized = true;
      return true;
    } catch (e) {
      this.logger.warn(`web-tree-sitter unavailable, using regex fallback: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  async load(languageId: string): Promise<boolean> {
    if (this.languages.has(languageId)) {
      return true;
    }
    const file = GRAMMAR_FILE[languageId];
    if (!file) {
      return false;
    }
    const wasmPath = this.resolveWasm(file);
    if (!wasmPath) {
      return false; // no grammar found anywhere → regex fallback
    }
    if (!(await this.ensureInit())) {
      return false;
    }
    try {
      const language = await this.Parser.Language.load(wasmPath);
      const parser = new this.Parser();
      parser.setLanguage(language);
      this.languages.set(languageId, { language, parser });
      this.logger.info(`Grammar loaded: ${languageId} (${file})`);
      return true;
    } catch (e) {
      this.logger.warn(`Grammar for ${languageId} not loaded (${file}): ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  parse(text: string, languageId: string): SyntaxTree | undefined {
    const loaded = this.languages.get(languageId);
    if (!loaded) {
      return undefined;
    }
    try {
      const tree = (loaded.parser as any).parse(text);
      const wrapper: InternalTree = { languageId, tree };
      return wrapper;
    } catch (e) {
      this.logger.warn(`Parse failed for ${languageId}: ${e instanceof Error ? e.message : String(e)}`);
      return undefined;
    }
  }

  query(tree: SyntaxTree, queryString: string): Capture[] {
    const loaded = this.languages.get(tree.languageId);
    const internal = tree as InternalTree;
    if (!loaded) {
      return [];
    }
    try {
      const q = (loaded.language as any).query(queryString);
      const captures = q.captures((internal.tree as any).rootNode) as any[];
      return captures.map((c) => {
        const node = c.node;
        return {
          name: c.name,
          startLine: node.startPosition.row,
          startChar: node.startPosition.column,
          endLine: node.endPosition.row,
          endChar: node.endPosition.column,
          text: node.text,
        } as Capture;
      });
    } catch (e) {
      this.logger.warn(`Query failed for ${tree.languageId}: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  }

  /** Convenience: absolute grammars directory bundled with the extension. */
  static defaultGrammarsDir(extensionUri: vscode.Uri): string {
    return vscode.Uri.joinPath(extensionUri, 'grammars').fsPath;
  }
}
