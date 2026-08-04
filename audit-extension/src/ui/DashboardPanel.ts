import * as vscode from 'vscode';
import { ReportService } from '../report/ReportService';
import { EventBus } from '../core/EventBus';

/**
 * Progress dashboard WebView: live aggregate stats (trust-state distribution,
 * findings by severity, coverage, annotation/bookmark/note counts) plus report
 * export buttons. Refreshes on any data-level change via the event bus. Served
 * under a strict CSP with a per-load nonce.
 */
export class DashboardPanel {
  private static current: DashboardPanel | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly report: ReportService,
    private readonly bus: EventBus
  ) {
    this.panel.webview.html = this.html(this.panel.webview);
    this.panel.webview.onDidReceiveMessage((msg: { type: string; format?: string }) => this.onMessage(msg), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    const off = this.bus.on('views:refresh', () => this.post());
    const off2 = this.bus.on('analysis:completed', () => this.post());
    this.disposables.push({ dispose: off }, { dispose: off2 });
  }

  static show(context: vscode.ExtensionContext, report: ReportService, bus: EventBus): void {
    const column = vscode.ViewColumn.Active;
    if (DashboardPanel.current) {
      DashboardPanel.current.panel.reveal(column);
      DashboardPanel.current.post();
      return;
    }
    const panel = vscode.window.createWebviewPanel('audit.dashboard', 'Audit dashboard', column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
    });
    DashboardPanel.current = new DashboardPanel(panel, context.extensionUri, report, bus);
    context.subscriptions.push({ dispose: () => DashboardPanel.current?.dispose() });
  }

  private post(): void {
    this.panel.webview.postMessage({ type: 'stats', stats: this.report.stats() });
  }

  private async onMessage(msg: { type: string; format?: string }): Promise<void> {
    if (msg.type === 'ready' || msg.type === 'refresh') {
      this.post();
    } else if (msg.type === 'report') {
      await vscode.commands.executeCommand('audit.generateReport', msg.format);
    }
  }

  private html(webview: vscode.Webview): string {
    const nonce = DashboardPanel.nonce();
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'dashboard.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'dashboard.css'));
    const csp = ["default-src 'none'", `style-src ${webview.cspSource}`, `script-src 'nonce-${nonce}'`].join('; ');
    return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Audit dashboard</title>
</head>
<body>
  <h1>Audit dashboard</h1>
  <div class="toolbar">
    <button id="refresh" class="secondary">Refresh</button>
    <button id="md">Report (Markdown)</button>
    <button id="html">Report (HTML / PDF)</button>
  </div>
  <div class="cards" id="cards"></div>
  <h2>Trust states</h2>
  <div class="barline" id="stateBar"></div>
  <div class="legend" id="stateLegend"></div>
  <h2>Findings by severity</h2>
  <div class="barline" id="sevBar"></div>
  <div class="legend" id="sevLegend"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body></html>`;
  }

  private static nonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < 32; i++) {
      text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
  }

  private dispose(): void {
    DashboardPanel.current = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
