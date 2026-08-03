import { AuditPlugin, AnalyzableDocument, PluginContext } from '../AuditPlugin';
import { AnalysisResult, DiscoveredNode, DiscoveredEdge, Finding, Severity, emptyAnalysis } from '../../core/Types';

/**
 * Built-in Dockerfile analyzer. The heuristics below are deliberately simple
 * (line-by-line scanning) and act as a reference implementation of the
 * AuditPlugin contract; Phase 3 will replace them with a Tree-sitter walk [3].
 *
 * Rules covered:
 *  - DKR001: unpinned base image (`latest` or missing tag).
 *  - DKR002: container running as root (no USER instruction).
 *  - DKR003: use of `ADD` with a remote URL (prefer COPY).
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
            this.finding('DKR001', `Unpinned base image: "${image}". Pin a tag or a digest.`, Severity.Medium, doc.relativePath, index)
          );
        }
      }

      if (upper.startsWith('USER ')) {
        hasUser = true;
      }

      if (/^ADD\s+https?:\/\//i.test(trimmed)) {
        result.findings.push(
          this.finding('DKR003', 'ADD with a remote URL: prefer COPY or a verified download.', Severity.Low, doc.relativePath, index)
        );
      }
    });

    if (!hasUser && lines.some((l) => l.trim().toUpperCase().startsWith('FROM '))) {
      result.findings.push(
        this.finding('DKR002', 'No USER instruction: the container will run as root.', Severity.High, doc.relativePath, 0)
      );
    }

    // A "file" node linked to the base image, to seed the trust graph.
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
