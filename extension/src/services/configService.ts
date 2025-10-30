import * as vscode from 'vscode';

export type StatusOption = {
  name: string;
  color: string;
};

export type TrackedProject = {
  path: string;
  notionDatabaseId: string;
  projectName: string;
  statusOptions?: StatusOption[];
};

const SECRET_KEY = 'todoSync.notionApiKey';

export class ConfigService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  get enableDebug(): boolean {
    return vscode.workspace.getConfiguration().get<boolean>('todoSync.enableDebug', false);
  }

  async storeApiKey(key: string): Promise<void> {
    await this.context.secrets.store(SECRET_KEY, key);
  }

  async getApiKey(): Promise<string | undefined> {
    return await this.context.secrets.get(SECRET_KEY);
  }

  getTrackedProjects(): TrackedProject[] {
    return vscode.workspace.getConfiguration().get<TrackedProject[]>('todoSync.trackedProjects', []);
  }

  async addProject(project: TrackedProject): Promise<void> {
    const current = this.getTrackedProjects();
    const without = current.filter(p => p.path !== project.path);
    const updated = [...without, project];
    await vscode.workspace.getConfiguration().update('todoSync.trackedProjects', updated, vscode.ConfigurationTarget.Workspace);
  }

  async removeProjectByPath(path: string): Promise<void> {
    const current = this.getTrackedProjects();
    const updated = current.filter(p => p.path !== path);
    await vscode.workspace.getConfiguration().update('todoSync.trackedProjects', updated, vscode.ConfigurationTarget.Workspace);
  }
}


