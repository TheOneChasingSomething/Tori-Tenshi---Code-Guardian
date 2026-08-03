import * as vscode from 'vscode';
import { TrustNodeRepository } from '../persistence/repositories/TrustNodeRepository';
import { TrustNode } from '../models/TrustNode';
import { TrustState } from '../core/Types';

/** Icône associée à chaque état de confiance. */
const STATE_ICON: Record<TrustState, string> = {
  [TrustState.Unreviewed]: 'circle-outline',
  [TrustState.InProgress]: 'sync',
  [TrustState.Validated]: 'pass',
  [TrustState.AtRisk]: 'warning',
  [TrustState.Documented]: 'book',
};

/**
 * Vue liste des nœuds du graphe de confiance, préfixée par un en-tête de
 * synthèse (répartition par état). La visualisation interactive en WebView
 * fait l'objet de la Phase 4 ; cette vue arborescente en est le repli.
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
      const item = new vscode.TreeItem(parts.join('  ') || 'Aucun nœud');
      item.iconPath = new vscode.ThemeIcon('graph');
      return item;
    }
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.description = `${element.kind} · ${element.state}`;
    item.iconPath = new vscode.ThemeIcon(STATE_ICON[element.state] ?? 'circle-outline');
    item.contextValue = 'trustNode';
    item.tooltip = `clé : ${element.key}`;
    return item;
  }

  getChildren(element?: TrustNode | 'summary'): (TrustNode | 'summary')[] {
    if (element) {
      return [];
    }
    return ['summary', ...this.repo.all()];
  }
}
