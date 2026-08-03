import * as vscode from 'vscode';
import { KnowledgeRepository } from '../persistence/repositories/KnowledgeRepository';
import { KnowledgeNote } from '../models/KnowledgeNote';

/** Vue liste des notes de la base de connaissances. */
export class KnowledgeTreeProvider implements vscode.TreeDataProvider<KnowledgeNote> {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private readonly repo: KnowledgeRepository) {}

  refresh(): void {
    this._onDidChange.fire();
  }

  getTreeItem(note: KnowledgeNote): vscode.TreeItem {
    const item = new vscode.TreeItem(note.title, vscode.TreeItemCollapsibleState.None);
    item.description = note.obsidianPath ? '↪ Obsidian' : undefined;
    item.iconPath = new vscode.ThemeIcon(note.obsidianPath ? 'link-external' : 'book');
    item.tooltip = note.content.slice(0, 200);
    return item;
  }

  getChildren(): KnowledgeNote[] {
    return this.repo.all();
  }
}
