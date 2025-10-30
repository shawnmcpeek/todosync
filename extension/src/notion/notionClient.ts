import { Client } from '@notionhq/client';

export type NotionTask = {
  id: string;
  title: string;
  status: 'Not started' | 'In progress' | 'Done' | string;
  lastEditedTime?: string;
};

export type StatusOption = {
  name: string;
  color: string;
};

const NOTION_COLOR_TO_EMOJI: Record<string, string> = {
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

function notionColorToEmoji(color: string): string {
  return NOTION_COLOR_TO_EMOJI[color.toLowerCase()] || NOTION_COLOR_TO_EMOJI.default;
}

export class NotionClientWrapper {
  private client: Client;

  constructor(apiKey: string) {
    this.client = new Client({ auth: apiKey });
  }

  async listDatabases(): Promise<{ id: string; title: string }[]> {
    const res = await this.client.search({
      filter: { property: 'object', value: 'database' },
      sort: { direction: 'ascending', timestamp: 'last_edited_time' }
    });
    return res.results
      .map((r: any) => ({
        id: r.id,
        title: r.title?.[0]?.plain_text || 'Untitled'
      }));
  }

  async getTasks(databaseId: string, pageSize = 200): Promise<NotionTask[]> {
    const tasks: NotionTask[] = [];
    let cursor: string | undefined = undefined;
    do {
      const page = await this.client.databases.query({
        database_id: databaseId,
        start_cursor: cursor,
        page_size: pageSize,
        sorts: [
          { property: 'Status', direction: 'ascending' },
          { timestamp: 'last_edited_time', direction: 'descending' } as any
        ]
      } as any);
      for (const r of page.results as any[]) {
        const titleProp = Object.values(r.properties).find((p: any) => p.type === 'title') as any;
        const statusProp = (r.properties['Status'] as any);
        const title = (titleProp?.title?.[0]?.plain_text) || 'Untitled';
        const status = statusProp?.status?.name || 'Not started';
        tasks.push({ id: r.id, title, status, lastEditedTime: r.last_edited_time });
      }
      cursor = (page as any).next_cursor || undefined;
      if (!(page as any).has_more) cursor = undefined;
    } while (cursor);
    return tasks;
  }

  async getStatusOptions(databaseId: string): Promise<StatusOption[]> {
    const db = await this.client.databases.retrieve({ database_id: databaseId });
    const statusProp = (db as any).properties?.Status;
    if (!statusProp || statusProp.type !== 'status') {
      return [
        { name: 'Not started', color: 'gray' },
        { name: 'In progress', color: 'blue' },
        { name: 'Done', color: 'green' }
      ];
    }
    return (statusProp.status?.options || []).map((opt: any) => ({
      name: opt.name,
      color: opt.color || 'default'
    }));
  }

  getStatusEmoji(statusName: string, statusOptions?: StatusOption[]): string {
    if (statusOptions) {
      const option = statusOptions.find(opt => opt.name === statusName);
      if (option) {
        return notionColorToEmoji(option.color);
      }
    }
    const fallback: Record<string, string> = {
      'Not started': '⚪',
      'In progress': '🔵',
      'Done': '🟢'
    };
    return fallback[statusName] || '⚪';
  }

  async updateStatus(pageId: string, status: string): Promise<void> {
    await this.client.pages.update({
      page_id: pageId,
      properties: {
        Status: { status: { name: status } }
      } as any
    });
  }
}


