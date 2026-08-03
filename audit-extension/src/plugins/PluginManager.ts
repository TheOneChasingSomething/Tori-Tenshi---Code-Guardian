import { AuditPlugin, AnalyzableDocument, PluginContext } from './AuditPlugin';
import { AnalysisResult, emptyAnalysis, Finding } from '../core/Types';
import { Logger } from '../core/Logger';
import { Configuration } from '../core/Configuration';

/**
 * Registre et orchestrateur des plugins d'analyse.
 *
 * Responsabilités :
 *  - enregistrer les plugins (intégrés ou externes) ;
 *  - router un document vers les plugins compatibles selon son languageId ;
 *  - agréger les résultats de plusieurs analyseurs sur un même document ;
 *  - isoler les défaillances : un plugin qui échoue ne casse pas l'analyse.
 */
export class PluginManager {
  private readonly plugins = new Map<string, AuditPlugin>();
  private readonly context: PluginContext;

  constructor(logger: Logger, config: Configuration) {
    this.context = { logger, config };
  }

  /** Enregistre un plugin. Un identifiant en double est rejeté. */
  async register(plugin: AuditPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      this.context.logger.warn(`Plugin ignoré (id déjà enregistré) : ${plugin.id}`);
      return;
    }
    this.plugins.set(plugin.id, plugin);
    if (plugin.activate) {
      await plugin.activate(this.context);
    }
    this.context.logger.info(`Plugin enregistré : ${plugin.id} (${plugin.languageIds.join(', ')})`);
  }

  /** Renvoie les plugins déclarant prendre en charge ce langage. */
  private resolve(languageId: string): AuditPlugin[] {
    return [...this.plugins.values()].filter((p) => p.languageIds.includes(languageId));
  }

  list(): AuditPlugin[] {
    return [...this.plugins.values()];
  }

  /**
   * Analyse un document avec tous les plugins compatibles et fusionne les
   * résultats. Les erreurs de plugin sont journalisées et converties en
   * constat de sévérité `info`, sans interrompre les autres analyseurs.
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
        this.context.logger.error(`Échec du plugin ${plugin.id} sur ${doc.relativePath}`, e);
        merged.findings.push(this.pluginErrorFinding(plugin.id, doc, e));
      }
    }
    return merged;
  }

  private pluginErrorFinding(pluginId: string, doc: AnalyzableDocument, e: unknown): Finding {
    return {
      pluginId,
      ruleId: 'plugin-error',
      message: `Erreur interne du plugin : ${e instanceof Error ? e.message : String(e)}`,
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
