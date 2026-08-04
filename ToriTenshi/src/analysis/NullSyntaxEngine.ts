import { SyntaxEngine, SyntaxTree, Capture } from './SyntaxEngine';

/**
 * No-op syntax engine used when Tree-sitter grammars are not installed.
 * Every analyzer degrades gracefully to its regex rules.
 */
export class NullSyntaxEngine implements SyntaxEngine {
  isAvailable(): boolean {
    return false;
  }
  async load(): Promise<boolean> {
    return false;
  }
  parse(): SyntaxTree | undefined {
    return undefined;
  }
  query(): Capture[] {
    return [];
  }
}
