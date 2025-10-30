"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncService = void 0;
const vscode = __importStar(require("vscode"));
const notionClient_1 = require("../notion/notionClient");
const log_1 = require("./log");
class SyncService {
    constructor(context, config, tree) {
        this.context = context;
        this.config = config;
        this.tree = tree;
        this.disposed = false;
    }
    dispose() {
        this.disposed = true;
        if (this.interval)
            clearInterval(this.interval);
    }
    startAutoRefresh() {
        const minutes = vscode.workspace.getConfiguration().get('todoSync.refreshIntervalMinutes', 5);
        if (this.interval)
            clearInterval(this.interval);
        this.interval = setInterval(() => this.syncCurrentWorkspace(), minutes * 60 * 1000);
        log_1.log.debug(`Auto-refresh started: every ${minutes} minute(s)`);
        this.syncCurrentWorkspace();
        this.context.subscriptions.push(vscode.window.onDidChangeWindowState(e => { if (e.focused)
            this.syncCurrentWorkspace(); }));
        this.context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => this.syncCurrentWorkspace()));
    }
    async linkCurrentWorkspaceToDatabase() {
        const apiKey = await this.config.getApiKey();
        if (!apiKey) {
            vscode.window.showWarningMessage('ToDoSync: Set Notion API key first.', 'Set API Key')
                .then(sel => sel && vscode.commands.executeCommand('todo-sync.setApiKey'));
            return;
        }
        const client = new notionClient_1.NotionClientWrapper(apiKey);
        const dbs = await client.listDatabases();
        if (dbs.length === 0) {
            vscode.window.showWarningMessage('ToDoSync: No Notion databases accessible with this API key.');
            return;
        }
        const pick = await vscode.window.showQuickPick(dbs.map(d => ({ label: d.title, description: d.id })), { placeHolder: 'Select Notion database to link to this workspace' });
        if (!pick)
            return;
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            vscode.window.showErrorMessage('ToDoSync: No workspace folder found.');
            return;
        }
        const project = {
            path: folder.uri.fsPath,
            notionDatabaseId: pick.description ?? '',
            projectName: folder.name
        };
        await this.config.addProject(project);
        log_1.log.debug(`Linked workspace '${folder.name}' to database ${project.notionDatabaseId}`);
        await this.syncCurrentWorkspace();
    }
    async syncCurrentWorkspace() {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder)
            return;
        const tracked = this.config.getTrackedProjects().find(p => p.path === folder.uri.fsPath);
        if (!tracked) {
            this.tree.setItems([]);
            return;
        }
        const apiKey = await this.config.getApiKey();
        if (!apiKey)
            return;
        const client = new notionClient_1.NotionClientWrapper(apiKey);
        const tasks = await client.getTasks(tracked.notionDatabaseId);
        const items = this.toTaskItems(tasks, tracked);
        this.tree.setItems(items);
        log_1.log.debug(`Synced ${items.length} task(s) for workspace '${folder.name}'`);
    }
    async syncAllWorkspaces() {
        await this.syncCurrentWorkspace();
    }
    async toggleStatus(item) {
        const apiKey = await this.config.getApiKey();
        if (!apiKey)
            return;
        const client = new notionClient_1.NotionClientWrapper(apiKey);
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
        if (!pick)
            return;
        await client.updateStatus(item.id, pick.value);
        log_1.log.debug(`Updated status -> ${pick.value} for task ${item.id}`);
        await this.syncCurrentWorkspace();
    }
    toTaskItems(tasks, project) {
        return tasks.map(t => ({ id: t.id, title: t.title, status: t.status, project }));
    }
    nextStatus(current) {
        if (current === 'Not started')
            return 'In progress';
        if (current === 'In progress')
            return 'Done';
        return 'Not started';
    }
}
exports.SyncService = SyncService;
//# sourceMappingURL=syncService.js.map