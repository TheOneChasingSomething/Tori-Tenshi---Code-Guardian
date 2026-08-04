import * as vscode from 'vscode';
import { BookmarkStore } from '../persistence/ports';
import { Bookmark } from '../models/Bookmark';

/** Tree node: a category grouping, or an individual bookmark. */
type Node = { kind: 'category'; category: string } | { kind: 'bookmark'; bookmark: Bookmark };

/**
 * Provides the "Bookmarks" tree, grouped by category. Selecting a bookmark
 * reveals its location in the editor.
 */
export class BookmarkTreeProvider implements vscode.TreeDataProvider<Node> {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private readonly repo: BookmarkStore) {}

  refresh(): void {
    this._onDidChange.fire();
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === 'category') {
      const item = new vscode.TreeItem(node.category, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = new vscode.ThemeIcon('bookmark');
      item.contextValue = 'bookmarkCategory';
      return item;
    }
    const b = node.bookmark;
    const item = new vscode.TreeItem(b.label, vscode.TreeItemCollapsibleState.None);
    item.description = `L${b.range.startLine + 1}`;
    item.iconPath = new vscode.ThemeIcon('bookmark');
    item.contextValue = 'bookmark';
    item.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [
        vscode.Uri.file(b.range.file),
        { selection: new vscode.Range(b.range.startLine, b.range.startChar, b.range.endLine, b.range.endChar) },
      ],
    };
    return item;
  }

  getChildren(node?: Node): Node[] {
    if (!node) {
      const categories = [...new Set(this.repo.all().map((b) => b.category))].sort();
      return categories.map((category) => ({ kind: 'category', category }));
    }
    if (node.kind === 'category') {
      return this.repo
        .all()
        .filter((b) => b.category === node.category)
        .map((bookmark) => ({ kind: 'bookmark', bookmark }));
    }
    return [];
  }
}
