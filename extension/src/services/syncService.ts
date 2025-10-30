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
    const statusOptions = await client.getStatusOptions(project.notionDatabaseId);
    project.statusOptions = statusOptions;
    await this.config.addProject(project);
    log.debug(`Linked workspace '${folder.name}' to database ${project.notionDatabaseId} with ${statusOptions.length} status option(s)`);
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
    this.tree.setNotionClient(client);
    if (!tracked.statusOptions) {
      tracked.statusOptions = await client.getStatusOptions(tracked.notionDatabaseId);
      await this.config.addProject(tracked);
    }
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
    if (!apiKey) {
      vscode.window.showWarningMessage('ToDoSync: No API key found. Set it first.');
      return;
    }
    const client = new NotionClientWrapper(apiKey);
    const tracked = this.config.getTrackedProjects().find(p => p.path === item.project.path);
    
    // Ensure statusOptions are loaded
    let statusOptions = tracked?.statusOptions;
    if (!statusOptions || statusOptions.length === 0) {
      if (tracked) {
        statusOptions = await client.getStatusOptions(tracked.notionDatabaseId);
        tracked.statusOptions = statusOptions;
        await this.config.addProject(tracked);
      } else {
        statusOptions = [
          { name: 'Not started', color: 'gray' },
          { name: 'In progress', color: 'blue' },
          { name: 'Done', color: 'green' }
        ];
      }
    }
    
    const statuses = statusOptions.map(opt => ({
      label: `${client.getStatusEmoji(opt.name, statusOptions)} ${opt.name}`,
      value: opt.name,
      description: opt.name === item.status ? 'Current status' : undefined
    }));
    
    const pick = await vscode.window.showQuickPick(statuses, {
      placeHolder: `Change status for "${item.title}"`,
      ignoreFocusOut: true,
      canPickMany: false,
    });
    
    if (!pick || pick.value === item.status) return;
    
    await client.updateStatus(item.id, pick.value);
    log.debug(`Updated status -> ${pick.value} for task ${item.id}`);
    await this.syncCurrentWorkspace();
  }

  async addTask(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      vscode.window.showErrorMessage('ToDoSync: No workspace folder found.');
      return;
    }
    
    const tracked = this.config.getTrackedProjects().find(p => p.path === folder.uri.fsPath);
    if (!tracked) {
      vscode.window.showWarningMessage('ToDoSync: Link this workspace to a Notion database first.', 'Link Project')
        .then(sel => sel && vscode.commands.executeCommand('todo-sync.linkProject'));
      return;
    }
    
    const apiKey = await this.config.getApiKey();
    if (!apiKey) {
      vscode.window.showWarningMessage('ToDoSync: Set Notion API key first.', 'Set API Key')
        .then(sel => sel && vscode.commands.executeCommand('todo-sync.setApiKey'));
      return;
    }
    
    const title = await vscode.window.showInputBox({
      prompt: 'Enter task title',
      placeHolder: 'Add Task',
      ignoreFocusOut: true,
    });
    
    if (!title || !title.trim()) return;
    
    const client = new NotionClientWrapper(apiKey);
    
    // Get default status (first status option or "Not started")
    let defaultStatus = 'Not started';
    if (tracked.statusOptions && tracked.statusOptions.length > 0) {
      defaultStatus = tracked.statusOptions[0].name;
    }
    
    try {
      await client.createTask(tracked.notionDatabaseId, title.trim(), defaultStatus);
      vscode.window.showInformationMessage(`ToDoSync: Task "${title.trim()}" added.`);
      await this.syncCurrentWorkspace();
    } catch (error: any) {
      vscode.window.showErrorMessage(`ToDoSync: Failed to add task: ${error.message || error}`);
      log.debug(`Failed to add task: ${error}`);
    }
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


