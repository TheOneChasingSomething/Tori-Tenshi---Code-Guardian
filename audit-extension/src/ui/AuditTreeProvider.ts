import * as vscode from 'vscode';
import { AnnotationRepository } from '../persistence/repositories/AnnotationRepository';
import { Annotation } from '../models/Annotation';

/** Nœud d'arbre : soit un fichier (regroupement), soit une annotation. */
type Node = { kind: 'file'; file: string } | { kind: 'annotation'; annotation: Annotation };

/**
 * Fournit l'arbre « Annotations » : les fichiers en premier niveau, les
 * annotations correspondantes en second. Sélectionner une annotation ouvre
 * le fichier à la bonne position.
 */
export class AuditTreeProvider implements vscode.TreeDataProvider<Node> {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private readonly repo: AnnotationRepository) {}

  refresh(): void {
    this._onDidChange.fire();
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === 'file') {
      const item = new vscode.TreeItem(node.file, vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = new vscode.ThemeIcon('file');
      item.contextValue = 'auditFile';
      return item;
    }
    const a = node.annotation;
    const label = a.body.length > 60 ? a.body.slice(0, 57) + '…' : a.body;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.description = `L${a.range.startLine + 1} · rév.${a.revision}`;
    item.iconPath = new vscode.ThemeIcon('note');
    item.contextValue = 'auditAnnotation';
    item.command = {
      command: 'vscode.open',
      title: 'Ouvrir',
      arguments: [
        vscode.Uri.file(a.range.file),
        { selection: new vscode.Range(a.range.startLine, a.range.startChar, a.range.endLine, a.range.endChar) },
      ],
    };
    return item;
  }

  getChildren(node?: Node): Node[] {
    if (!node) {
      const files = [...new Set(this.repo.all().map((a) => a.range.file))].sort();
      return files.map((file) => ({ kind: 'file', file }));
    }
    if (node.kind === 'file') {
      return this.repo.findByFile(node.file).map((annotation) => ({ kind: 'annotation', annotation }));
    }
    return [];
  }
}
