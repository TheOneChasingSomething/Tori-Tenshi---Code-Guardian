import { AuditPlugin, AnalyzableDocument, PluginContext } from './AuditPlugin';
import { AnalysisResult, emptyAnalysis, Finding } from '../core/Types';
import { Logger } from '../core/Logger';
import { Configuration } from '../core/Configuration';
import { SyntaxEngine } from '../analysis/SyntaxEngine';

/**
 * Registry and orchestrator of analysis plugins.
 *
 * Responsibilities:
 *  - register plugins (built-in or external);
 *  - route a document to the compatible plugins based on its languageId;
 *  - aggregate the results of several analyzers over the same document;
 *  - isolate failures: a plugin that throws does not break the analysis.
 */
export class PluginManager {
  private readonly plugins = new Map<string, AuditPlugin>();
  private readonly context: PluginContext;

  constructor(logger: Logger, config: Configuration, syntax: SyntaxEngine) {
    this.context = { logger, config, syntax };
  }

  /** Registers a plugin. A duplicate identifier is rejected. */
  async register(plugin: AuditPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      this.context.logger.warn(`Plugin ignored (id already registered): ${plugin.id}`);
      return;
    }
    this.plugins.set(plugin.id, plugin);
    if (plugin.activate) {
      await plugin.activate(this.context);
    }
    this.context.logger.info(`Plugin registered: ${plugin.id} (${plugin.languageIds.join(', ')})`);
  }

  /** Returns the plugins declaring support for this language. */
  private resolve(languageId: string): AuditPlugin[] {
    return [...this.plugins.values()].filter((p) => p.languageIds.includes(languageId));
  }

  list(): AuditPlugin[] {
    return [...this.plugins.values()];
  }

  /**
   * Analyzes a document with every compatible plugin and merges the results.
   * Plugin errors are logged and turned into an `info` finding, without
   * interrupting the other analyzers.
   */
  async analyze(doc: AnalyzableDocument): Promise<AnalysisResult> {
    const plugins = this.resolve(doc.languageId);
    if (plugins.length === 0) {
      return emptyAnalysis();
    }

    const merged = emptyAnalysis();
    for (const plugin of plugins) {
      try {
        const result = await plugin.analyze(doc, this.context);
        merged.findings.push(...result.findings);
        merged.nodes.push(...result.nodes);
        merged.edges.push(...result.edges);
      } catch (e) {
        this.context.logger.error(`Plugin ${plugin.id} failed on ${doc.relativePath}`, e);
        merged.findings.push(this.pluginErrorFinding(plugin.id, doc, e));
      }
    }
    return merged;
  }

  private pluginErrorFinding(pluginId: string, doc: AnalyzableDocument, e: unknown): Finding {
    return {
      pluginId,
      ruleId: 'plugin-error',
      message: `Internal plugin error: ${e instanceof Error ? e.message : String(e)}`,
      severity: 'info' as Finding['severity'],
      range: { file: doc.relativePath, startLine: 0, startChar: 0, endLine: 0, endChar: 0 },
    };
  }

  dispose(): void {
    for (const p of this.plugins.values()) {
      p.dispose?.();
    }
    this.plugins.clear();
  }
}
