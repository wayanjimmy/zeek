# Zeek Agent Guide

This document describes how an AI agent can interact with the **Zeek** weekly planner through its browser-based API.

## What is Zeek?

Zeek is a **local-first weekly planner** that runs entirely in the browser. There is no server, no database, and no authentication. All state lives in `localStorage` under the key `zeek.planner.data.v1`.

**Live URL:** `https://zeek-app.pages.dev`

## Accessing the API

The app exposes a global `window.Zeek` object. Wait for readiness before calling any method:

```js
const status = await window.Zeek.ready;
// status: { api_version: 1, schema_version: 1, status: 'ok' }
```

> **Note:** The API only works in a browser context (puppeteer, playwright, or browser devtools). It is not accessible via HTTP or from Node.js directly.

## Quick Reference

| Method | Signature | Description |
|--------|-----------|-------------|
| `help()` | `() → object` | API metadata, methods, invariants |
| `getData()` | `() → PlannerDataV1` | Full canonical data snapshot |
| `getDiagnostics()` | `() → object` | Storage health status |
| `exportData(opts)` | `({ format }) → object` | Export as backup, raw, or markdown |
| `importData(input, opts)` | `(input, { mode?, dryRun? }) → object` | Import/replace data |
| `validateData(input)` | `(PlannerDataV1) → { ok, errors? }` | Validate raw data (not backup envelope) |
| `list(opts)` | `({ week_start?, ... }) → TaskV1[]` | Query tasks with filters |
| `create(input)` | `(CreateTaskInput) → { ok, task }` | Create a new task |
| `update(id, patch)` | `(id, UpdateTaskInput) → { ok, task }` | Update task fields |
| `move(id, dest)` | `(id, { date?, someday_column?, position? }) → { ok, task }` | Move task to a different day/column |
| `delete(id)` | `(id) → { ok }` | Delete a task |

## Data Model

### TaskV1

```typescript
{
  id: string;                    // UUID
  title: string;                 // 1–255 chars
  notes: string | null;          // Free-form notes
  date: string | null;           // "YYYY-MM-DD" or null for Someday
  due_date: string | null;       // Optional deadline
  completed: boolean;
  color: string | null;          // UI color tag
  position: number;              // Sort order within a day
  someday_column: 0 | 1 | 2 | null;  // Column index for Someday tasks
  recurrence_type: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrence_interval: number;   // e.g. 2 = every 2 weeks
  recurrence_weekdays: number[] | null;  // 0=Sun … 6=Sat
  recurrence_ends_at: string | null;     // "YYYY-MM-DD"
  recurrence_parent_id: string | null;   // Template ID for instances
  recurrence_last_generated_at: string | null;
  subtasks: SubtaskV1[];
  created_at: string;            // ISO-8601 timestamp
  updated_at: string;            // ISO-8601 timestamp
}
```

### SubtaskV1

```typescript
{
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}
```

## Key Invariants

| Rule | Details |
|------|---------|
| **Date semantics** | `date === null` → Someday task. `someday_column` must be `0 \| 1 \| 2`. Dated tasks have `someday_column === null`. |
| **Date format** | All dates are `YYYY-MM-DD` strings (local calendar, no timezone drift). |
| **Recurrence templates** | `recurrence_type !== 'none'` AND `recurrence_parent_id === null` |
| **Recurrence instances** | `recurrence_parent_id !== null`, always start incomplete |
| **Subtasks not cloned** | Generated recurrence instances do NOT inherit subtasks from templates |
| **Deleting instances** | Records a `recurrence_exception` so the instance is not regenerated |
| **Editing templates** | Disposes strictly-future instances, preserves past/today's occurrences |

## Common Workflows

### List this week's tasks

```js
const tasks = window.Zeek.list({ week_start: '2026-06-29' });
// Returns tasks for Mon-Sun of that week, plus Someday tasks by default
```

### List incomplete tasks only

```js
const tasks = window.Zeek.list({
  week_start: '2026-06-29',
  include_completed: false,
  include_someday: false,  // exclude Someday tasks if needed
});
```

### Create a one-off task

```js
const result = window.Zeek.create({
  title: 'Buy groceries',
  date: '2026-07-01',
});
// result.ok === true, result.task contains the created task
```

### Create a task in Someday

```js
window.Zeek.create({
  title: 'Research new laptop',
  someday_column: 0,  // 0, 1, or 2
});
```

### Create a recurring task

```js
window.Zeek.create({
  title: 'Team standup',
  date: '2026-07-01',           // Anchor date
  recurrence_type: 'weekly',
  recurrence_weekdays: [1, 3, 5], // Mon, Wed, Fri (0=Sun)
});
```

### Update a task

```js
window.Zeek.update('task-id-here', {
  title: 'Updated title',
  notes: 'Added some notes',
  completed: true,
});
```

### Move a task to a different day

```js
window.Zeek.move('task-id-here', { date: '2026-07-03' });
```

### Move a task to Someday

```js
window.Zeek.move('task-id-here', { date: null, someday_column: 1 });
```

### Delete a task

```js
window.Zeek.delete('task-id-here');
```

### Export data as markdown

```js
const { content } = window.Zeek.exportData({ format: 'markdown' });
// content is a markdown string of the current week
```

### Create a backup

```js
const { data: backup } = window.Zeek.exportData({ format: 'backup' });
// backup is a ZeekBackupV1 JSON object
```

### Validate data before import

```js
// validateData expects PlannerDataV1 format, not the backup envelope
const raw = window.Zeek.exportData({ format: 'raw' });
const validation = window.Zeek.validateData(raw.data);
if (validation.ok) {
  // Safe to import
}
```

### Dry-run import (preview without saving)

```js
// importData accepts the full export response, the backup envelope, or raw data
const backup = window.Zeek.exportData({ format: 'backup' });

// You can pass the whole response:
const preview = window.Zeek.importData(backup, { dryRun: true });

// Or just the inner .data:
const preview2 = window.Zeek.importData(backup.data, { dryRun: true });

// preview.summary shows what would change
```

### Import/replace data

```js
const backup = window.Zeek.exportData({ format: 'backup' });

// Pass the whole response or just .data — both work
const result = window.Zeek.importData(backup, { mode: 'replace' });

// A pre-import snapshot is automatically saved for rollback
```

## Error Handling

All mutation methods return a result object:

```typescript
// Success
{ ok: true, task: TaskV1 }

// Failure
{ ok: false, errors: [{ message: string, path?: string }] }
```

Always check `result.ok` before accessing `result.task`.

## Tips for Agents

1. **Wait for readiness**: Always `await window.Zeek.ready` before any call.
2. **Use `list()` before `update()`**: Get the current state to find task IDs.
3. **Prefer `dryRun` for imports**: Preview changes before committing.
4. **Dates are strings**: Use `"2026-07-01"`, not `Date` objects.
5. **Someday vs dated**: `date: null` + `someday_column: N` for Someday; `date: "YYYY-MM-DD"` + `someday_column: null` for dated.
6. **Weeks start on Monday** in the UI, but `recurrence_weekdays` uses `0=Sunday`.
7. **No partial failures**: Either the entire mutation succeeds or it returns errors—no half-applied state.
9. **`exportData()` response is self-importable**: You can pass the full `exportData()` result directly to `importData()` — it automatically unwraps the response wrapper. Passing just `result.data` also works.
10. **`validateData()` vs `importData()`**: `validateData` expects raw `PlannerDataV1` (from `getData()` or `exportData({ format: 'raw' }).data`). `importData` accepts backup envelopes, raw data, and the full export response.
