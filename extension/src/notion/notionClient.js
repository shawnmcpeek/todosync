"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotionClientWrapper = void 0;
const client_1 = require("@notionhq/client");
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