import { AuditPlugin, AnalyzableDocument, PluginContext } from '../plugins/AuditPlugin';
import {
  AnalysisResult,
  DiscoveredEdge,
  DiscoveredNode,
  Finding,
  Severity,
  emptyAnalysis,
} from '../core/Types';

/** A per-line regular-expression rule (immediate, grammar-free baseline). */
export interface RegexRule {
  id: string;
  severity: Severity;
  /** Tested against each line of the document. */
  pattern: RegExp;
  message: string | ((match: RegExpMatchArray, line: string) => string);
}

/**
 * A Tree-sitter query rule (precise, structural). Exercised only when a grammar
 * is available; `captureName` selects which capture from `query` triggers the
 * finding.
 */
export interface QueryRule {
  id: string;
  severity: Severity;
  query: string;
  captureName: string;
  message: string;
}

/**
 * Base class turning an analyzer into a declarative set of rules. Subclasses
 * declare `regexRules` (baseline) and optionally `queryRules` (Tree-sitter),
 * plus optional `guard`, `fileFindings` and `discover` hooks. The `analyze`
 * flow is shared, uniform and testable.
 */
export abstract class RuleBasedPlugin implements AuditPlugin {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly languageIds: string[];

  protected regexRules: RegexRule[] = [];
  protected queryRules: QueryRule[] = [];

  /** Optional coarse gate (e.g. only analyze YAML that looks like Ansible). */
  protected guard(_doc: AnalyzableDocument): boolean {
    return true;
  }

  /** Optional whole-file checks not expressible as a single line regex. */
  protected fileFindings(_doc: AnalyzableDocument): Finding[] {
    return [];
  }

  /** Optional graph discovery (nodes/edges) specific to the language. */
  protected discover(_doc: AnalyzableDocument): { nodes: DiscoveredNode[]; edges: DiscoveredEdge[] } {
    return { nodes: [], edges: [] };
  }

  analyze(doc: AnalyzableDocument, ctx: PluginContext): AnalysisResult {
    const result = emptyAnalysis();
    if (!this.guard(doc)) {
      return result;
    }

    // 1) Regex baseline, line by line.
    const lines = doc.text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const rule of this.regexRules) {
        const m = line.match(rule.pattern);
        if (m) {
          result.findings.push(this.finding(rule.id, this.render(rule.message, m, line), rule.severity, doc.relativePath, index));
        }
      }
    });

    // 2) Whole-file checks.
    result.findings.push(...this.fileFindings(doc));

    // 3) Tree-sitter query rules, only when a grammar is available.
    if (this.queryRules.length > 0) {
      const tree = ctx.syntax.parse(doc.text, doc.languageId);
      if (tree) {
        for (const rule of this.queryRules) {
          for (const cap of ctx.syntax.query(tree, rule.query)) {
            if (cap.name !== rule.captureName) {
              continue;
            }
            result.findings.push({
              pluginId: this.id,
              ruleId: rule.id,
              message: rule.message,
              severity: rule.severity,
              range: { file: doc.relativePath, startLine: cap.startLine, startChar: cap.startChar, endLine: cap.endLine, endChar: cap.endChar },
            });
          }
        }
      }
    }

    // 4) Graph discovery.
    const d = this.discover(doc);
    result.nodes.push(...d.nodes);
    result.edges.push(...d.edges);
    return result;
  }

  private render(message: RegexRule['message'], m: RegExpMatchArray, line: string): string {
    return typeof message === 'function' ? message(m, line) : message;
  }

  protected finding(ruleId: string, message: string, severity: Severity, file: string, line: number): Finding {
    return { pluginId: this.id, ruleId, message, severity, range: { file, startLine: line, startChar: 0, endLine: line, endChar: 200 } };
  }
}
