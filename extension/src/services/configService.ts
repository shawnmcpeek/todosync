import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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
    // First check .env file in workspace root
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const envPath = path.join(workspaceFolder.uri.fsPath, '.env');
      try {
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf8');
          const envLines = envContent.split('\n');
          for (const line of envLines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('NOTION_API_KEY=')) {
              const key = trimmed.substring('NOTION_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
              if (key) return key;
            }
          }
        }
      } catch (error) {
        // If .env read fails, fall through to SecretStorage
      }
    }
    // Fall back to SecretStorage
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


