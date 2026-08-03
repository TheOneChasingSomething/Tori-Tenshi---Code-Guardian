import * as vscode from 'vscode';
import { TrustNodeRepository } from '../persistence/repositories/TrustNodeRepository';
import { TrustNode } from '../models/TrustNode';
import { TrustState } from '../core/Types';

/** Icon associated with each trust state. */
const STATE_ICON: Record<TrustState, string> = {
  [TrustState.Unreviewed]: 'circle-outline',
  [TrustState.InProgress]: 'sync',
  [TrustState.Validated]: 'pass',
  [TrustState.AtRisk]: 'warning',
  [TrustState.Documented]: 'book',
};

/**
 * List view of the trust-graph nodes, prefixed by a summary header
 * (distribution by state). The interactive WebView visualization is the
 * subject of Phase 4; this tree view is its fallback.
 */
export class TrustGraphTreeProvider implements vscode.TreeDataProvider<TrustNode | 'summary'> {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private readonly repo: TrustNodeRepository) {}

  refresh(): void {
    this._onDidChange.fire();
  }

  getTreeItem(element: TrustNode | 'summary'): vscode.TreeItem {
    if (element === 'summary') {
      const counts = this.repo.countByState();
      const parts = Object.entries(counts).map(([s, n]) => `${s}:${n}`);
      const item = new vscode.TreeItem(parts.join('  ') || 'No node');
      item.iconPath = new vscode.ThemeIcon('graph');
      return item;
    }
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.description = `${element.kind} · ${element.state}`;
    item.iconPath = new vscode.ThemeIcon(STATE_ICON[element.state] ?? 'circle-outline');
    item.contextValue = 'trustNode';
    item.tooltip = `key: ${element.key}`;
    return item;
  }

  getChildren(element?: TrustNode | 'summary'): (TrustNode | 'summary')[] {
    if (element) {
      return [];
    }
    return ['summary', ...this.repo.all()];
  }
}
