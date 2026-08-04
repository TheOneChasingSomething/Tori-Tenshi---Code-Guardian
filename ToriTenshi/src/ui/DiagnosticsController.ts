import * as vscode from 'vscode';
import { Finding, Severity } from '../core/Types';

/** Maps an analyzer severity to a VS Code diagnostic severity. */
function toVsSeverity(s: Severity): vscode.DiagnosticSeverity {
  switch (s) {
    case Severity.Critical:
    case Severity.High:
      return vscode.DiagnosticSeverity.Error;
    case Severity.Medium:
      return vscode.DiagnosticSeverity.Warning;
    case Severity.Low:
      return vscode.DiagnosticSeverity.Information;
    default:
      return vscode.DiagnosticSeverity.Hint;
  }
}

/**
 * Publishes analyzer findings as VS Code diagnostics (the squiggles and the
 * Problems panel). A single DiagnosticCollection owns all audit diagnostics so
 * they can be cleared or refreshed as a group [2].
 */
export class DiagnosticsController {
  private readonly collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('audit');
  }

  /** Replaces the diagnostics for one file with the given findings. */
  publish(uri: vscode.Uri, findings: Finding[]): void {
    const diagnostics = findings.map((f) => {
      const range = new vscode.Range(f.range.startLine, f.range.startChar, f.range.endLine, f.range.endChar);
      const d = new vscode.Diagnostic(range, f.message, toVsSeverity(f.severity));
      d.source = `audit/${f.pluginId}`;
      d.code = f.ruleId;
      return d;
    });
    this.collection.set(uri, diagnostics);
  }

  clear(uri?: vscode.Uri): void {
    if (uri) {
      this.collection.delete(uri);
    } else {
      this.collection.clear();
    }
  }

  dispose(): void {
    this.collection.dispose();
  }
}
