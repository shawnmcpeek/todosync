import * as vscode from 'vscode';
import { ConfigService, TrackedProject } from './configService';
import { NotionClientWrapper, NotionTask } from '../notion/notionClient';
import { ProjectTreeProvider, TaskItem } from '../tree/projectTreeProvider';
import { log } from './log';

export class SyncService implements vscode.Disposable {
  private interval: NodeJS.Timeout | undefined;
  private disposed = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly config: ConfigService,
    private readonly tree: ProjectTreeProvider
  ) {}

  dispose(): void {
    this.disposed = true;
    if (this.interval) clearInterval(this.interval);
  }

  startAutoRefresh() {
    const minutes = vscode.workspace.getConfiguration().get<number>('todoSync.refreshIntervalMinutes', 5);
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => this.syncCurrentWorkspace(), minutes * 60 * 1000);

    log.debug(`Auto-refresh started: every ${minutes} minute(s)`);
    this.syncCurrentWorkspace();
    this.context.subscriptions.push(vscode.window.onDidChangeWindowState(e => { if (e.focused) this.syncCurrentWorkspace(); }));
    this.context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => this.syncCurrentWorkspace()));
  }

  async linkCurrentWorkspaceToDatabase(): Promise<void> {
    const apiKey = await this.config.getApiKey();
    if (!apiKey) {
      vscode.window.showWarningMessage('ToDoSync: Set Notion API key first.', 'Set API Key')
        .then(sel => sel && vscode.commands.executeCommand('todo-sync.setApiKey'));
      return;
    }

    const client = new NotionClientWrapper(apiKey);
    const dbs = await client.listDatabases();
    if (dbs.length === 0) {
      vscode.window.showWarningMessage('ToDoSync: No Notion databases accessible with this API key.');
      return;
    }
    const pick = await vscode.window.showQuickPick(
      dbs.map(d => ({ label: d.title, description: d.id })),
      { placeHolder: 'Select Notion database to link to this workspace' }
    );
    if (!pick) return;

    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      vscode.window.showErrorMessage('ToDoSync: No workspace folder found.');
      return;
    }
    const project: TrackedProject = {
      path: folder.uri.fsPath,
      notionDatabaseId: pick.description ?? '',
      projectName: folder.name
    };
    await this.config.addProject(project);
    log.debug(`Linked workspace '${folder.name}' to database ${project.notionDatabaseId}`);
    await this.syncCurrentWorkspace();
  }

  async syncCurrentWorkspace(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return;
    const tracked = this.config.getTrackedProjects().find(p => p.path === folder.uri.fsPath);
    if (!tracked) {
      this.tree.setItems([]);
      return;
    }
    const apiKey = await this.config.getApiKey();
    if (!apiKey) return;
    const client = new NotionClientWrapper(apiKey);
    const tasks = await client.getTasks(tracked.notionDatabaseId);
    const items = this.toTaskItems(tasks, tracked);
    this.tree.setItems(items);
    log.debug(`Synced ${items.length} task(s) for workspace '${folder.name}'`);
  }

  async syncAllWorkspaces(): Promise<void> {
    await this.syncCurrentWorkspace();
  }

  async toggleStatus(item: TaskItem): Promise<void> {
    const apiKey = await this.config.getApiKey();
    if (!apiKey) return;
    const client = new NotionClientWrapper(apiKey);
    // Prompt user for status selection
    const statuses = [
      { label: '⚪ Not started', value: 'Not started' },
      { label: '🔵 In progress', value: 'In progress' },
      { label: '🟢 Done', value: 'Done' },
    ];
    const pick = await vscode.window.showQuickPick(statuses, {
      placeHolder: 'Select status',
      ignoreFocusOut: true,
    });
    if (!pick) return;
    await client.updateStatus(item.id, pick.value as 'Not started' | 'In progress' | 'Done');
    log.debug(`Updated status -> ${pick.value} for task ${item.id}`);
    await this.syncCurrentWorkspace();
  }

  private toTaskItems(tasks: NotionTask[], project: TrackedProject): TaskItem[] {
    return tasks.map(t => ({ id: t.id, title: t.title, status: t.status, project }));
  }

  private nextStatus(current: string): 'Not started' | 'In progress' | 'Done' {
    if (current === 'Not started') return 'In progress';
    if (current === 'In progress') return 'Done';
    return 'Not started';
  }
}


