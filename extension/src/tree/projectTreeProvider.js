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
exports.ProjectTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
class ProjectTreeProvider {
    constructor(configService) {
        this.configService = configService;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.items = [];
    }
    setNotionClient(client) {
        this.notionClient = client;
    }
    setItems(items) {
        this.items = items.slice();
        this._onDidChangeTreeData.fire();
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        const emoji = this.notionClient?.getStatusEmoji(element.status, element.project.statusOptions) || '⚪';
        const item = new vscode.TreeItem(`${emoji} ${element.title}`, vscode.TreeItemCollapsibleState.None);
        item.description = element.status;
        item.contextValue = 'taskItem';
        item.command = {
            command: 'todo-sync.toggleStatus',
            title: 'Change Status',
            arguments: [element]
        };
        return item;
    }
    getChildren() {
        const sorted = this.items.slice().sort((a, b) => {
            const project = a.project;
            const statusOptions = project.statusOptions || [];
            const order = {};
            statusOptions.forEach((opt, idx) => {
                order[opt.name] = idx;
            });
            const o = (order[a.status] ?? 99) - (order[b.status] ?? 99);
            if (o !== 0)
                return o;
            return a.title.localeCompare(b.title);
        });
        return Promise.resolve(sorted);
    }
}
exports.ProjectTreeProvider = ProjectTreeProvider;
//# sourceMappingURL=projectTreeProvider.js.map