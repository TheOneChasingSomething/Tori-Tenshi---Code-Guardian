import { AnalyzableDocument } from '../AuditPlugin';
import { RuleBasedPlugin, RegexRule } from '../../analysis/RuleBasedPlugin';
import { DiscoveredNode, DiscoveredEdge, Finding, Severity } from '../../core/Types';

/**
 * Dockerfile analyzer. Simple checks stay as regex/file rules; Phase 3 keeps the
 * base-image graph discovery so Docker seeds the trust graph.
 *
 * Rules: DKR001 unpinned base image · DKR002 runs as root · DKR003 ADD remote URL.
 */
export class DockerPlugin extends RuleBasedPlugin {
  readonly id = 'docker';
  readonly displayName = 'Docker';
  readonly languageIds = ['dockerfile'];

  protected regexRules: RegexRule[] = [
    { id: 'DKR003', severity: Severity.Low, pattern: /^\s*ADD\s+https?:\/\//i, message: 'ADD with a remote URL: prefer COPY or a verified download.' },
  ];

  protected fileFindings(doc: AnalyzableDocument): Finding[] {
    const findings: Finding[] = [];
    const lines = doc.text.split(/\r?\n/);
    let hasFrom = false;
    let hasUser = false;
    lines.forEach((line, index) => {
      const t = line.trim();
      const u = t.toUpperCase();
      if (u.startsWith('FROM ')) {
        hasFrom = true;
        const image = t.slice(5).trim().split(/\s+/)[0];
        if (!image.includes('@sha256:') && (!image.includes(':') || image.endsWith(':latest'))) {
          findings.push(this.finding('DKR001', `Unpinned base image: "${image}". Pin a tag or a digest.`, Severity.Medium, doc.relativePath, index));
        }
      }
      if (u.startsWith('USER ')) {
        hasUser = true;
      }
    });
    if (hasFrom && !hasUser) {
      findings.push(this.finding('DKR002', 'No USER instruction: the container will run as root.', Severity.High, doc.relativePath, 0));
    }
    return findings;
  }

  protected discover(doc: AnalyzableDocument): { nodes: DiscoveredNode[]; edges: DiscoveredEdge[] } {
    const nodes: DiscoveredNode[] = [];
    const edges: DiscoveredEdge[] = [];
    const fileKey = `file:${doc.relativePath}`;
    nodes.push({ key: fileKey, label: doc.relativePath, kind: 'file' });
    for (const line of doc.text.split(/\r?\n/)) {
      const m = line.trim().match(/^FROM\s+(\S+)/i);
      if (m) {
        const image = m[1];
        const imageKey = `docker:image:${image}`;
        nodes.push({ key: imageKey, label: image, kind: 'container' });
        edges.push({ fromKey: fileKey, toKey: imageKey, label: 'FROM' });
      }
    }
    return { nodes, edges };
  }
}
