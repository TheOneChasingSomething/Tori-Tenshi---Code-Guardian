import { AuditPlugin, AnalyzableDocument, PluginContext } from '../AuditPlugin';
import { AnalysisResult, DiscoveredNode, DiscoveredEdge, Finding, Severity, emptyAnalysis } from '../../core/Types';

/**
 * Analyseur Dockerfile intégré. Les heuristiques ci-dessous sont volontairement
 * simples (analyse ligne à ligne) et servent de référence d'implémentation du
 * contrat AuditPlugin ; la Phase 3 les remplacera par un parcours Tree-sitter [3].
 *
 * Règles couvertes :
 *  - DKR001 : image de base non figée (`latest` ou tag absent).
 *  - DKR002 : conteneur exécuté en root (absence d'instruction USER).
 *  - DKR003 : usage de `ADD` avec URL distante (préférer COPY).
 */
export class DockerPlugin implements AuditPlugin {
  readonly id = 'docker';
  readonly displayName = 'Docker';
  readonly languageIds = ['dockerfile'];

  analyze(doc: AnalyzableDocument, _ctx: PluginContext): AnalysisResult {
    const result = emptyAnalysis();
    const lines = doc.text.split(/\r?\n/);
    let hasUser = false;
    let baseImageKey: string | undefined;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const upper = trimmed.toUpperCase();

      if (upper.startsWith('FROM ')) {
        const image = trimmed.slice(5).trim().split(/\s+/)[0];
        baseImageKey = `docker:image:${image}`;
        result.nodes.push(this.node(baseImageKey, image, 'container'));

        if (!image.includes('@sha256:') && (!image.includes(':') || image.endsWith(':latest'))) {
          result.findings.push(
            this.finding('DKR001', `Image de base non figée : « ${image} ». Épinglez un tag ou un digest.`, Severity.Medium, doc.relativePath, index)
          );
        }
      }

      if (upper.startsWith('USER ')) {
        hasUser = true;
      }

      if (/^ADD\s+https?:\/\//i.test(trimmed)) {
        result.findings.push(
          this.finding('DKR003', 'Instruction ADD avec URL distante : préférez COPY ou un téléchargement vérifié.', Severity.Low, doc.relativePath, index)
        );
      }
    });

    if (!hasUser && lines.some((l) => l.trim().toUpperCase().startsWith('FROM '))) {
      result.findings.push(
        this.finding('DKR002', 'Aucune instruction USER : le conteneur s’exécutera en root.', Severity.High, doc.relativePath, 0)
      );
    }

    // Nœud « fichier » relié à l'image de base, pour amorcer le graphe de confiance.
    const fileKey = `file:${doc.relativePath}`;
    result.nodes.push(this.node(fileKey, doc.relativePath, 'file'));
    if (baseImageKey) {
      result.edges.push(this.edge(fileKey, baseImageKey, 'FROM'));
    }
    return result;
  }

  private node(key: string, label: string, kind: DiscoveredNode['kind']): DiscoveredNode {
    return { key, label, kind };
  }

  private edge(fromKey: string, toKey: string, label: string): DiscoveredEdge {
    return { fromKey, toKey, label };
  }

  private finding(ruleId: string, message: string, severity: Severity, file: string, line: number): Finding {
    return {
      pluginId: this.id,
      ruleId,
      message,
      severity,
      range: { file, startLine: line, startChar: 0, endLine: line, endChar: 200 },
    };
  }
}
