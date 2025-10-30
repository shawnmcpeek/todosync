# ToDoSync Development Plan

## Goal
Build a VS Code/Cursor Sode Bar View extension that:
- Syncs tasks directly with Notion databases (no local markdown files)
- Allows marking tasks as in Not Started, In Progress and Complete in Notion
- Each CS Code/Cursor Project (folder) is connected to one Cursor Project. There is no cross-project integration

## Core Features

1. **Project Detection & Linking**
   - Detect open folder in VS Code/Cursor
   - User clicks button to link folder to Notion database, preferred done in the View but can be a command as well
   - Store mapping: `project_path → notion_database_id`

2. **Notion Authentication**
   - User provides Notion API key (stored securely in VS Code settings)
   - API key used to authenticate with Notion API

3. **Sync Logic**
   - Fetch todos from Notion database
   - Display in a tree view and update directly in Notion
   - No local `to-do.md` file; Notion is the source of truth. No md files at all

4. **UI Components**
   - Command Palette: "ToDoSync: Link Project" to connect current folder
   - Command Palette: "ToDoSync: Sync Now" to manually sync
   = View - Link Cursor Project

## Technical Implementation

### File Structure
```
extension/
├── package.json           # Extension manifest, commands, UI config
├── src/
│   ├── extension.ts      # Entry point, activation, command registration
│   ├── services/
│   │   ├── syncService.ts # Core sync logic
│   │   └── configService.ts # Store project mappings
│   ├── notion/
│   │   └── notionClient.ts # Notion API wrapper
│   └── tree/
│       └── projectTreeProvider.ts # Sidebar tree view
└── out/                   # Compiled JavaScript
```

### Key Files to Create

**1. package.json**
- Extension name: `todo-sync`
- Activation: `onStartupFinished`
- Commands: `addProject`, `syncProject`, `syncAll`
- Tree view: `todo-sync-projects`
- Settings: `notionApiKey`, `trackedProjects` array

**2. src/extension.ts**
- On activation: register commands, log to console
- Commands: `linkProject`, `syncNow`, `syncAll`
  

**3. src/services/syncService.ts**
- `addProject()`: pick folder, select Notion database, store mapping
- `syncProject()`: fetch from Notion and refresh tree view (no local file)
- `listDatabases()`: show available Notion databases
- Store in VS Code config: `trackedProjects` array

**4. src/notion/notionClient.ts**
- Initialize Notion client with API key
- `getTodos(databaseId)`: query database, return todos
- `listDatabases()`: search for accessible databases

**5. src/services/configService.ts**
- `getTrackedProjects()`: read from VS Code settings
- `addProject(project)` / `removeProject(project)`: update settings

### Data Flow

1. User sets API key in VS Code settings
2. User runs "ToDoSync: Link Project" from Command Palette
3. Extension detects current workspace folder
4. Extension fetches available Notion databases
5. User selects database to link to current folder
6. Extension stores mapping in VS Code settings
7. Extension links immediately and refreshes the tree from Notion
8. User runs "ToDoSync: Sync Now" to refresh todos anytime

### Configuration Format

**VS Code Settings:**
```json
{
  "todoSync.notionApiKey": "secret_xxx...",
  "todoSync.trackedProjects": [
    {
      "path": "C:\\projects\\my-project",
      "notionDatabaseId": "abc123...",
      "projectName": "My Project"
    }
  ]
}
```

## Implementation Steps

0. **Test Core Logic First** (create standalone script to fetch from Notion, generate MD file, verify it works)
1. **Setup** (package.json, tsconfig.json, npm install)
2. **Minimal Extension** (basic activation, command to sync current folder)
3. **Core Sync** (Notion client, fetch todos, generate MD)
4. **Configuration** (store/retrieve project mappings via VS Code settings)
5. **Commands** (add project via command palette, manual sync)
6. **Error Handling** (check activation logs, handle missing API key)
7. **Testing** (install in Cursor, configure, test sync)

## Notion Database Requirements

Each database must have:
- A title property (for task text)
- A checkbox property (for completion status)

The extension will:
- Find the first title property → task text
- Find any checkbox property → completion status


## IMPORTANT FUCKING RULES!
- THis is a VS code extension, not CLI, not JS or anything like that. If you can't build it as an extension, DO NOT FUCKING SWITCH TO A DIFFERENT METHOD! 
- User is not to be manually editing the settings.json file. The app should create that data tracking and connection.
- The user should log in to their Notion just one time. If they are in Project1 in vs code, they then connect that to Notion Project2 (which is the same project). That connection is saved. They then go into Project2 in vs code, then connect to Notion Project5 (same project). That connection is saved. This continues ad infinitum.