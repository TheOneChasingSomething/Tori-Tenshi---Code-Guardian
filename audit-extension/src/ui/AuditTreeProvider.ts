import * as vscode from 'vscode';
import { AnnotationRepository } from '../persistence/repositories/AnnotationRepository';
import { Annotation } from '../models/Annotation';

/** Tree node: either a file (grouping) or an annotation. */
type Node = { kind: 'file'; file: string } | { kind: 'annotation'; annotation: Annotation };

/**
 * Provides the "Annotations" tree: files at the first level, matching
 * annotations at the second. Selecting an annotation opens the file at the
 * right position.
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
    item.description = `L${a.range.startLine + 1} · rev.${a.revision}`;
    item.iconPath = new vscode.ThemeIcon('note');
    item.contextValue = 'auditAnnotation';
    item.command = {
      command: 'vscode.open',
      title: 'Open',
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
