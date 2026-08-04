import * as vscode from 'vscode';
import { TrustNodeRepository } from '../persistence/repositories/TrustNodeRepository';
import { AnnotationRepository } from '../persistence/repositories/AnnotationRepository';
import { BookmarkRepository } from '../persistence/repositories/BookmarkRepository';
import { KnowledgeRepository } from '../persistence/repositories/KnowledgeRepository';
import { TrustState } from '../core/Types';
import { ReportData, ReportFinding, ReportStats } from './ReportModel';

const SEVERITY_NAME = ['error', 'warning', 'information', 'hint'];

/**
 * Builds the audit report by aggregating the trust graph, the current
 * diagnostics, annotations, and knowledge notes, and renders it to Markdown or
 * a self-contained, printable HTML document (the HTML is the PDF path: open it
 * in a browser and Print → Save as PDF, avoiding a bundled headless browser).
 */
export class ReportService {
  constructor(
    private readonly nodes: TrustNodeRepository,
    private readonly annotations: AnnotationRepository,
    private readonly bookmarks: BookmarkRepository,
    private readonly knowledge: KnowledgeRepository
  ) {}

  /** Reads the current diagnostics and maps them into report findings. */
  private gatherFindings(): ReportFinding[] {
    const findings: ReportFinding[] = [];
    for (const [uri, diags] of vscode.languages.getDiagnostics()) {
      const rel = vscode.workspace.asRelativePath(uri);
      for (const d of diags) {
        if (typeof d.source === 'string' && !d.source.startsWith('audit')) {
          continue; // only our own diagnostics
        }
        findings.push({
          file: rel,
          line: d.range.start.line + 1,
          severity: SEVERITY_NAME[d.severity] ?? 'info',
          source: (d.source as string) ?? 'audit',
          code: String((d.code as { value?: unknown })?.value ?? d.code ?? ''),
          message: d.message,
        });
      }
    }
    return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  }

  stats(findings = this.gatherFindings()): ReportStats {
    const allNodes = this.nodes.all();
    const nodesByState = this.nodes.countByState();
    const covered = (nodesByState[TrustState.Validated] ?? 0) + (nodesByState[TrustState.Documented] ?? 0);
    const bySeverity: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const f of findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
      bySource[f.source] = (bySource[f.source] ?? 0) + 1;
    }
    return {
      totalNodes: allNodes.length,
      nodesByState,
      totalFindings: findings.length,
      findingsBySeverity: bySeverity,
      findingsBySource: bySource,
      coverage: allNodes.length ? covered / allNodes.length : 0,
      annotations: this.annotations.all().length,
      bookmarks: this.bookmarks.all().length,
      notes: this.knowledge.all().length,
    };
  }

  build(): ReportData {
    const findings = this.gatherFindings();
    return {
      generatedAt: new Date().toISOString(),
      workspaceName: vscode.workspace.workspaceFolders?.[0]?.name ?? 'workspace',
      stats: this.stats(findings),
      findings,
      nodes: this.nodes.all(),
      annotations: this.annotations.all(),
      notes: this.knowledge.all(),
    };
  }

  // ---- Markdown -----------------------------------------------------------
  renderMarkdown(data: ReportData): string {
    const s = data.stats;
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    const kv = (rec: Record<string, number>) => Object.entries(rec).map(([k, v]) => `${k}: ${v}`).join(', ') || '—';
    const out: string[] = [
      `# Audit report — ${data.workspaceName}`,
      '',
      `Generated ${new Date(data.generatedAt).toLocaleString()}`,
      '',
      '## Summary',
      '',
      `- Trust nodes: ${s.totalNodes} (${kv(s.nodesByState)})`,
      `- Review coverage: ${pct(s.coverage)}`,
      `- Findings: ${s.totalFindings} (${kv(s.findingsBySeverity)})`,
      `- By source: ${kv(s.findingsBySource)}`,
      `- Annotations: ${s.annotations} · Bookmarks: ${s.bookmarks} · Knowledge notes: ${s.notes}`,
      '',
      '## Findings',
      '',
    ];
    if (data.findings.length === 0) {
      out.push('_No findings._', '');
    } else {
      out.push('| Severity | File | Line | Source | Code | Message |', '| --- | --- | --- | --- | --- | --- |');
      for (const f of data.findings) {
        out.push(`| ${f.severity} | ${f.file} | ${f.line} | ${f.source} | ${f.code} | ${escapePipes(f.message)} |`);
      }
      out.push('');
    }
    out.push('## Trust graph', '');
    if (data.nodes.length === 0) {
      out.push('_No nodes. Run a scan first._', '');
    } else {
      out.push('| Node | Kind | State | File |', '| --- | --- | --- | --- |');
      for (const n of data.nodes) {
        out.push(`| ${escapePipes(n.label)} | ${n.kind} | ${n.state} | ${n.file ?? ''} |`);
      }
      out.push('');
    }
    if (data.notes.length > 0) {
      out.push('## Knowledge notes', '');
      for (const note of data.notes) {
        out.push(`- ${escapePipes(note.title)}${note.obsidianPath ? ' (in vault)' : ''}`);
      }
      out.push('');
    }
    return out.join('\n');
  }

  // ---- HTML (printable / PDF) ---------------------------------------------
  renderHtml(data: ReportData): string {
    const s = data.stats;
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    const rows = data.findings
      .map((f) => `<tr><td class="sev ${f.severity}">${f.severity}</td><td>${esc(f.file)}</td><td>${f.line}</td><td>${esc(f.source)}</td><td>${esc(f.code)}</td><td>${esc(f.message)}</td></tr>`)
      .join('');
    const nodeRows = data.nodes
      .map((n) => `<tr><td>${esc(n.label)}</td><td>${n.kind}</td><td class="state ${n.state}">${n.state}</td><td>${esc(n.file ?? '')}</td></tr>`)
      .join('');
    const bar = (rec: Record<string, number>) => {
      const total = Object.values(rec).reduce((a, b) => a + b, 0) || 1;
      return Object.entries(rec)
        .map(([k, v]) => `<span class="seg" style="width:${(v / total) * 100}%" title="${k}: ${v}" data-k="${k}"></span>`)
        .join('');
    };
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><title>Audit report — ${esc(data.workspaceName)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; margin: 40px; color: #1a1a1a; }
  h1 { margin-bottom: 4px; } .meta { color: #666; margin-bottom: 24px; }
  .cards { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; min-width: 140px; }
  .card .n { font-size: 1.8em; font-weight: 700; } .card .l { color: #666; font-size: 0.85em; }
  .barline { display: flex; height: 10px; border-radius: 5px; overflow: hidden; margin: 8px 0 20px; background: #eee; }
  .seg[data-k=error], .seg[data-k=at-risk] { background: #d64545; }
  .seg[data-k=warning], .seg[data-k=in-progress] { background: #e0a04a; }
  .seg[data-k=information], .seg[data-k=validated] { background: #3fa45b; }
  .seg[data-k=hint], .seg[data-k=unreviewed] { background: #9aa0a6; }
  .seg[data-k=documented] { background: #8a63d2; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 28px; font-size: 0.92em; }
  th, td { border: 1px solid #e2e2e2; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #f6f6f6; } .sev.error, .state.at-risk { color: #c0392b; font-weight: 600; }
  .sev.warning { color: #b9770e; } .state.validated { color: #2e7d43; } .state.documented { color: #6f42c1; }
  button { padding: 8px 14px; border-radius: 6px; border: 1px solid #ccc; cursor: pointer; }
  @media print { button { display: none; } body { margin: 0; } }
</style></head>
<body>
  <button onclick="window.print()">Print / Save as PDF</button>
  <h1>Audit report — ${esc(data.workspaceName)}</h1>
  <div class="meta">Generated ${new Date(data.generatedAt).toLocaleString()}</div>
  <div class="cards">
    <div class="card"><div class="n">${s.totalNodes}</div><div class="l">trust nodes</div></div>
    <div class="card"><div class="n">${pct(s.coverage)}</div><div class="l">review coverage</div></div>
    <div class="card"><div class="n">${s.totalFindings}</div><div class="l">findings</div></div>
    <div class="card"><div class="n">${s.annotations}</div><div class="l">annotations</div></div>
    <div class="card"><div class="n">${s.notes}</div><div class="l">knowledge notes</div></div>
  </div>
  <div class="barline">${bar(s.nodesByState)}</div>
  <h2>Findings</h2>
  ${data.findings.length ? `<table><thead><tr><th>Severity</th><th>File</th><th>Line</th><th>Source</th><th>Code</th><th>Message</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>No findings.</p>'}
  <h2>Trust graph</h2>
  ${data.nodes.length ? `<table><thead><tr><th>Node</th><th>Kind</th><th>State</th><th>File</th></tr></thead><tbody>${nodeRows}</tbody></table>` : '<p>No nodes. Run a scan first.</p>'}
</body></html>`;
  }
}

function escapePipes(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
