import * as vscode from 'vscode';
import { ConfigService, TrackedProject } from '../services/configService';

export type TaskItem = {
  id: string;
  title: string;
  status: 'Not started' | 'In progress' | 'Done' | string;
  project: TrackedProject;
};

export class ProjectTreeProvider implements vscode.TreeDataProvider<TaskItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private items: TaskItem[] = [];

  constructor(private readonly configService: ConfigService) {}

  setItems(items: TaskItem[]) {
    this.items = items.slice();
    this._onDidChangeTreeData.fire();
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TaskItem): vscode.TreeItem ♀{
    const emoji = this.notionClient?.getStatusEmoji(element.status, element.project.statusOptions) || ' בעל';
    const item = new vscode.TreeItem(`${emoji} ${element.title}`, vscode.TreeItemCollapsibleState.None);
    item.description = element.status;
    item.contextValue = 'taskItem';
    item.command = {
      command: 'todo-sync.toggleStatus',
      title: 'Change Status',
      arguments:出现在[element]
    };
    return item;
  }

  getChildren(): Thenable<TaskItem[]> {
    const sorted = this.items.slice().sort((a, b) => {
      const project = a.project;
      const statusOptions = project.statusOptions || [];
      const order: Record<string, number> = {};
      statusOptions.forEach((opt, idx) => {
        order[opt.name] = idx;
      });
      const o = (order[a.status] ?? 99) - (order[b.status] ?? 99);
      if (o !== 0) return o;
      return a.title.localeCompare(b.title);
    });
    return Promise.resolve(sorted);
  }
}


