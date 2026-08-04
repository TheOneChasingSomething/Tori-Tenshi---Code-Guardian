import * as vscode from 'vscode';
import { GraphService } from '../graph/GraphService';
import { TrustNodeRepository } from '../persistence/repositories/TrustNodeRepository';
import { EventBus } from '../core/EventBus';
import { Logger } from '../core/Logger';
import { TrustState } from '../core/Types';

/**
 * Interactive trust-graph WebView. A single panel is reused (singleton). The
 * HTML is built with a strict Content Security Policy and a per-load nonce; the
 * script and stylesheet are loaded as webview URIs from `media/` [2].
 *
 * Message protocol (webview -> extension):
 *   ready | requestRefresh | open{key} | setState{key,state}
 * and (extension -> webview): data{GraphData}.
 */
export class GraphPanel {
  private static current: GraphPanel | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly graph: GraphService,
    private readonly nodes: TrustNodeRepository,
    private readonly bus: EventBus,
    private readonly logger: Logger
  ) {
    this.panel.webview.html = this.html(this.panel.webview);

    this.panel.webview.onDidReceiveMessage((msg: { type: string; key?: string; state?: string }) => this.onMessage(msg), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Keep the graph in sync with data-level changes.
    const off1 = this.bus.on('trust:changed', () => this.postData());
    const off2 = this.bus.on('analysis:completed', () => this.postData());
    const off3 = this.bus.on('views:refresh', () => this.postData());
    this.disposables.push({ dispose: off1 }, { dispose: off2 }, { dispose: off3 });
  }

  /** Opens the panel, or reveals it if already open. */
  static show(context: vscode.ExtensionContext, graph: GraphService, nodes: TrustNodeRepository, bus: EventBus, logger: Logger): void {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
    if (GraphPanel.current) {
      GraphPanel.current.panel.reveal(column);
      GraphPanel.current.postData();
      return;
    }
    const panel = vscode.window.createWebviewPanel('audit.graph', 'Trust graph', column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
    });
    GraphPanel.current = new GraphPanel(panel, context.extensionUri, graph, nodes, bus, logger);
    context.subscriptions.push({ dispose: () => GraphPanel.current?.dispose() });
  }

  private postData(): void {
    this.panel.webview.postMessage({ type: 'data', data: this.graph.build() });
  }

  private async onMessage(msg: { type: string; key?: string; state?: string }): Promise<void> {
    switch (msg.type) {
      case 'ready':
        this.postData();
        break;
      case 'requestRefresh':
        this.postData();
        break;
      case 'open': {
        const node = msg.key ? this.nodes.findByKey(msg.key) : undefined;
        if (node?.file) {
          try {
            await vscode.window.showTextDocument(vscode.Uri.file(node.file));
          } catch (e) {
            this.logger.warn(`Cannot open ${node.file}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        break;
      }
      case 'setState': {
        const node = msg.key ? this.nodes.findByKey(msg.key) : undefined;
        if (node && msg.state) {
          this.nodes.setState(node.id, msg.state as TrustState);
          this.bus.emit('trust:changed', { nodeKey: node.key });
          this.bus.emit('views:refresh', undefined);
        }
        break;
      }
    }
  }

  private html(webview: vscode.Webview): string {
    const nonce = GraphPanel.nonce();
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'graph.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'graph.css'));
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Trust graph</title>
</head>
<body>
  <div id="toolbar">
    <div class="group" id="filters"></div>
    <div class="sep"></div>
    <div class="group">
      <label>Layout
        <select id="layout">
          <option value="force">Force</option>
          <option value="layered">Layered (architecture)</option>
        </select>
      </label>
    </div>
    <div class="sep"></div>
    <div class="group">
      <input type="search" id="search" placeholder="Filter by label…" />
      <button id="fit">Reset layout</button>
      <button id="refresh">Refresh</button>
    </div>
    <span class="hint">Double-click a node to open it in the editor.</span>
  </div>
  <div id="stage"><canvas id="canvas"></canvas></div>
  <div id="details"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
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
    GraphPanel.current = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
