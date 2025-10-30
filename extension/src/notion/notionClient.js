"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotionClientWrapper = void 0;
const client_1 = require("@notionhq/client");
const NOTION_COLOR_TO_EMOJI = {
    default: '⚪',
    gray: '⚪',
    brown: '🟤',
    orange: '🟠',
    yellow: '🟡',
    green: '🟢',
    blue: '🔵',
    purple: '🟣',
    pink: '🩷',
    red: '🔴',
};
function notionColorToEmoji(color) {
    return NOTION_COLOR_TO_EMOJI[color.toLowerCase()] || NOTION_COLOR_TO_EMOJI.default;
}
class NotionClientWrapper {
    constructor(apiKey) {
        this.client = new client_1.Client({ auth: apiKey });
    }
    async listDatabases() {
        const res = await this.client.search({
            filter: { property: 'object', value: 'database' },
            sort: { direction: 'ascending', timestamp: 'last_edited_time' }
        });
        return res.results
            .map((r) => ({
            id: r.id,
            title: r.title?.[0]?.plain_text || 'Untitled'
        }));
    }
    async getTasks(databaseId, pageSize = 200) {
        const tasks = [];
        let cursor = undefined;
        do {
            const page = await this.client.databases.query({
                database_id: databaseId,
                start_cursor: cursor,
                page_size: pageSize,
                sorts: [
                    { property: 'Status', direction: 'ascending' },
                    { timestamp: 'last_edited_time', direction: 'descending' }
                ]
            });
            for (const r of page.results) {
                const titleProp = Object.values(r.properties).find((p) => p.type === 'title');
                const statusProp = r.properties['Status'];
                const title = (titleProp?.title?.[0]?.plain_text) || 'Untitled';
                const status = statusProp?.status?.name || 'Not started';
                tasks.push({ id: r.id, title, status, lastEditedTime: r.last_edited_time });
            }
            cursor = page.next_cursor || undefined;
            if (!page.has_more)
                cursor = undefined;
        } while (cursor);
        return tasks;
    }
    async getStatusOptions(databaseId) {
        const db = await this.client.databases.retrieve({ database_id: databaseId });
        const statusProp = db.properties?.Status;
        if (!statusProp || statusProp.type !== 'status') {
            return [
                { name: 'Not started', color: 'gray' },
                { name: 'In progress', color: 'blue' },
                { name: 'Done', color: 'green' }
            ];
        }
        return (statusProp.status?.options || []).map((opt) => ({
            name: opt.name,
            color: opt.color || 'default'
        }));
    }
    getStatusEmoji(statusName, statusOptions) {
        if (statusOptions) {
            const option = statusOptions.find(opt => opt.name === statusName);
            if (option) {
                return notionColorToEmoji(option.color);
            }
        }
        const fallback = {
            'Not started': '⚪',
            'In progress': '🔵',
            'Done': '🟢'
        };
        return fallback[statusName] || '⚪';
    }
    async updateStatus(pageId, status) {
        await this.client.pages.update({
            page_id: pageId,
            properties: {
                Status: { status: { name: status } }
            }
        });
    }
}
exports.NotionClientWrapper = NotionClientWrapper;
//# sourceMappingURL=notionClient.js.map