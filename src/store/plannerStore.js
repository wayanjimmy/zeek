import { reactive, computed } from 'vue';
import {
    CreateTaskInput,
    CreateSubtaskInput,
    MoveTaskInput,
    PlannerDataV1,
    UpdateSubtaskInput,
    UpdateTaskInput,
} from './schema';
import {
    addDaysLocal,
    formatLocal,
    startOfWeekLocal,
    todayLocal,
} from './dates';
import * as storage from './storage';
import {
    addDeletedException,
    disposeFutureInstances,
    generateForRange,
    isRecurrenceInstance,
    isRecurrenceTemplate,
    onTemplateCreated,
    onTemplateUpdated,
} from './recurrence';

const STORAGE_KEY_LEGACY_MD = 'clipboardMarkdownOptions'; // migrated into settings on first load

function nowIso() {
    return new Date().toISOString();
}

function genId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

function emptyData() {
    const now = nowIso();
    return {
        schema_version: 1,
        created_at: now,
        updated_at: now,
        settings: {
            current_week_start: null,
            // Defaults match the legacy Header popover defaults (all off).
            markdown_export: { include_subtasks: false, include_someday: false, include_notes: false },
        },
        tasks: [],
        recurrence_exceptions: [],
    };
}

/** Container key a task is ordered within: a date, or `someday:<col>`. */
function containerOf(task) {
    if (task.date) return `date:${task.date}`;
    return `someday:${task.someday_column ?? 0}`;
}

function nextPosition(data, task) {
    const key = containerOf(task);
    let max = -1;
    for (const t of data.tasks) {
        if (containerOf(t) === key) max = Math.max(max, t.position);
    }
    return max + 1;
}

/**
 * Validate input against a Zod schema and normalize the result into
 * `{ ok, value }` or `{ ok: false, errors }`.
 */
function check(schema, input) {
    const result = schema.safeParse(input);
    if (result.success) return { ok: true, value: result.data };
    return {
        ok: false,
        errors: result.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
        })),
    };
}

export const store = reactive({
    data: null, // PlannerDataV1
    loaded: false,
    /** 'ok' | 'corrupt' | 'empty' — describes the last load outcome. */
    status: 'init',
    corrupt: null, // { raw, error, issues? } when active data is corrupt
});

/** JSON-safe deep clone. Our data is plain JSON-serializable, so this is both
 * safe and the contract the agent API promises (no Dates/functions/etc.). */
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function persist() {
    if (!store.data) return;
    store.data.updated_at = nowIso();
    storage.save(store.data);
    // A successful save means the active key is now valid; if we were serving a
    // fallback due to a corrupt load, the corrupt raw is already quarantined
    // (and remains downloadable from the Data page's "Quarantined payloads").
    if (store.status === 'corrupt') {
        store.status = 'ok';
        store.corrupt = null;
    }
}

/**
 * Initialize from localStorage. On corrupt active data we do NOT overwrite —
 * the Data page surfaces recovery choices. Returns the load status.
 */
export function initStore() {
    if (store.loaded) return store.status;

    const result = storage.load();

    if (result.status === 'ok') {
        store.data = result.data;
        store.status = 'ok';
        migrateLegacyMarkdownOptions(store.data);
        // Backfill current_week_start to this week's Monday if unset.
        if (!store.data.settings.current_week_start) {
            store.data.settings.current_week_start = startOfWeekLocal(todayLocal());
        }
        persist();
        generateForVisibleWeek();
    } else if (result.status === 'empty') {
        store.data = emptyData();
        store.data.settings.current_week_start = startOfWeekLocal(todayLocal());
        store.status = 'ok';
        persist();
    } else {
        store.data = null;
        store.status = 'corrupt';
        store.corrupt = {
            raw: result.raw,
            error: result.error,
            issues: result.issues,
        };
        storage.quarantine(result.raw, result.error);
        // Fall back to last-good so the UI is usable while the user chooses.
        const lastGood = storage.loadLastGood();
        if (lastGood) {
            store.data = lastGood;
        } else {
            store.data = emptyData();
            store.data.settings.current_week_start = startOfWeekLocal(todayLocal());
        }
    }

    store.loaded = true;
    return store.status;
}

function migrateLegacyMarkdownOptions(data) {
    let legacy = null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY_LEGACY_MD);
        if (raw) legacy = JSON.parse(raw);
    } catch {
        legacy = null;
    }
    if (legacy && typeof legacy === 'object') {
        data.settings.markdown_export = {
            include_subtasks: !!legacy.includeSubtasks,
            include_someday: !!legacy.includeSomeday,
            include_notes: !!legacy.includeNotes,
        };
        localStorage.removeItem(STORAGE_KEY_LEGACY_MD);
    }
}

// --- visible week -----------------------------------------------------------

export function currentWeekStart() {
    return store.data?.settings.current_week_start ?? null;
}

/** Returns [rangeStart, rangeEnd] as YYYY-MM-DD for the current visible week. */
export function visibleRange() {
    const start = store.data?.settings.current_week_start;
    if (!start) return [null, null];
    return [start, addDaysLocal(start, 6)];
}

export function setWeekStart(dateStr) {
    if (!store.data) return;
    const monday = startOfWeekLocal(dateStr) ?? dateStr;
    store.data.settings.current_week_start = monday;
    persist();
    generateForVisibleWeek();
}

export function generateForVisibleWeek() {
    if (!store.data) return 0;
    const [start, end] = visibleRange();
    const created = generateForRange(store.data, start, end);
    if (created > 0) persist();
    return created;
}

/**
 * Generate missing recurrence instances for the week containing `dateStr`
 * (regardless of the store's current visible week) and persist. Used by the
 * agent API's `list({ week_start })` so querying any week fills it.
 */
export function generateForWeek(dateStr) {
    if (!store.data || !dateStr) return 0;
    const start = startOfWeekLocal(dateStr);
    const end = addDaysLocal(start, 6);
    const created = generateForRange(store.data, start, end);
    if (created > 0) persist();
    return created;
}

// --- queries ---------------------------------------------------------------

export const tasks = computed(() => store.data?.tasks ?? []);

export function getTask(id) {
    return store.data?.tasks.find((t) => t.id === id) ?? null;
}

// --- mutations -------------------------------------------------------------

/**
 * Create a task. Input is validated with CreateTaskInput; the store fills in
 * ids, timestamps, defaults and derived fields, then persists.
 *
 * Returns `{ ok, task }` or `{ ok: false, errors }`.
 */
export function createTask(input) {
    if (!store.data) return { ok: false, errors: [{ message: 'store not loaded' }] };
    const v = check(CreateTaskInput, input);
    if (!v.ok) return v;

    const value = v.value;
    const recurrenceType = value.recurrence_type ?? 'none';
    const isTemplate = recurrenceType !== 'none';

    const date = value.date ?? null;
    // Someday invariant: null date requires a someday_column; a date nulls it.
    const somedayColumn = date == null ? (value.someday_column ?? 0) : null;

    const now = nowIso();
    const task = {
        id: genId(),
        title: value.title,
        notes: value.notes ?? null,
        date,
        due_date: value.due_date ?? null,
        completed: false,
        color: value.color ?? null,
        position: 0,
        someday_column: somedayColumn,
        recurrence_type: recurrenceType,
        recurrence_interval: value.recurrence_interval ?? 1,
        recurrence_weekdays: value.recurrence_weekdays ?? null,
        recurrence_ends_at: value.recurrence_ends_at ?? null,
        recurrence_parent_id: null,
        recurrence_last_generated_at: null,
        subtasks: [],
        created_at: now,
        updated_at: now,
    };
    task.position = value.position ?? nextPosition(store.data, task);

    store.data.tasks.push(task);
    persist();

    if (isTemplate) {
        const [start, end] = visibleRange();
        onTemplateCreated(store.data, task, start, end);
        persist();
    }

    return { ok: true, task: clone(task) };
}

/**
 * Patch a task. Captures an original snapshot so recurrence updates can detect
 * which fields changed and dispose/regenerate. Returns `{ ok, task }` or errors.
 */
export function updateTask(id, patch) {
    if (!store.data) return { ok: false, errors: [{ message: 'store not loaded' }] };
    const task = store.data.tasks.find((t) => t.id === id);
    if (!task) return { ok: false, errors: [{ path: 'id', message: 'task not found' }] };

    const v = check(UpdateTaskInput, patch);
    if (!v.ok) return v;
    const value = v.value;

    const original = clone(task);
    const wasTemplate = isRecurrenceTemplate(task);

    if (value.title !== undefined) task.title = value.title;
    if (value.notes !== undefined) task.notes = value.notes;
    if (value.due_date !== undefined) task.due_date = value.due_date;
    if (value.completed !== undefined) task.completed = value.completed;
    if (value.color !== undefined) task.color = value.color;
    if (value.position !== undefined) task.position = value.position;

    if (value.date !== undefined) {
        task.date = value.date;
        // Re-establish the someday invariant when the date changes.
        if (value.date == null) {
            task.someday_column = value.someday_column ?? 0;
        } else {
            task.someday_column = null;
        }
    } else if (value.someday_column !== undefined) {
        // Moving between Someday columns without changing the date.
        if (task.date == null) task.someday_column = value.someday_column;
    }

    if (value.recurrence_type !== undefined) task.recurrence_type = value.recurrence_type;
    if (value.recurrence_interval !== undefined) task.recurrence_interval = value.recurrence_interval;
    if (value.recurrence_weekdays !== undefined) task.recurrence_weekdays = value.recurrence_weekdays;
    if (value.recurrence_ends_at !== undefined) task.recurrence_ends_at = value.recurrence_ends_at;

    task.updated_at = nowIso();
    persist();

    if (wasTemplate || isRecurrenceTemplate(task)) {
        const [start, end] = visibleRange();
        onTemplateUpdated(store.data, task, original, start, end);
        persist();
    }

    return { ok: true, task: clone(task) };
}

export function toggleTask(id) {
    const task = getTask(id);
    if (!task) return { ok: false, errors: [{ path: 'id', message: 'task not found' }] };
    return updateTask(id, { completed: !task.completed });
}

/**
 * Move a task to a new container (date or Someday column). If `position` is
 * omitted, the task is appended to the end of the destination container.
 */
export function moveTask(id, destination) {
    if (!store.data) return { ok: false, errors: [{ message: 'store not loaded' }] };
    const task = store.data.tasks.find((t) => t.id === id);
    if (!task) return { ok: false, errors: [{ path: 'id', message: 'task not found' }] };

    const v = check(MoveTaskInput, destination ?? {});
    if (!v.ok) return v;
    const value = v.value;

    const patch = {};
    if (value.date !== undefined) patch.date = value.date;
    if (value.someday_column !== undefined) patch.someday_column = value.someday_column;

    const result = updateTask(id, patch);
    if (!result.ok) return result;

    // Re-append at the destination so the moved task lands at the end (or the
    // requested position) of its new container.
    const moved = getTask(id);
    if (moved && value.position !== undefined) {
        moved.position = value.position;
        persist();
    } else if (moved) {
        moved.position = nextPosition(store.data, moved);
        persist();
    }
    return { ok: true, task: clone(getTask(id)) };
}

export function deleteTask(id) {
    if (!store.data) return { ok: false, errors: [{ message: 'store not loaded' }] };
    const task = store.data.tasks.find((t) => t.id === id);
    if (!task) return { ok: false, errors: [{ path: 'id', message: 'task not found' }] };

    if (isRecurrenceInstance(task)) {
        addDeletedException(store.data, task);
    } else if (isRecurrenceTemplate(task)) {
        disposeFutureInstances(store.data, task.id);
    }

    store.data.tasks = store.data.tasks.filter((t) => t.id !== id);
    persist();
    return { ok: true };
}

// --- subtasks --------------------------------------------------------------

export function addSubtask(taskId, input) {
    if (!store.data) return { ok: false, errors: [{ message: 'store not loaded' }] };
    const task = store.data.tasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, errors: [{ path: 'task_id', message: 'task not found' }] };

    const v = check(CreateSubtaskInput, input);
    if (!v.ok) return v;
    const value = v.value;

    const now = nowIso();
    const subtask = {
        id: genId(),
        task_id: taskId,
        title: value.title,
        completed: value.completed ?? false,
        position: value.position ?? task.subtasks.length,
        created_at: now,
        updated_at: now,
    };
    task.subtasks.push(subtask);
    task.updated_at = now;
    persist();
    return { ok: true, subtask: clone(subtask) };
}

export function updateSubtask(taskId, subtaskId, patch) {
    if (!store.data) return { ok: false, errors: [{ message: 'store not loaded' }] };
    const task = store.data.tasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, errors: [{ path: 'task_id', message: 'task not found' }] };
    const subtask = task.subtasks.find((s) => s.id === subtaskId);
    if (!subtask) return { ok: false, errors: [{ path: 'id', message: 'subtask not found' }] };

    const v = check(UpdateSubtaskInput, patch);
    if (!v.ok) return v;
    const value = v.value;

    if (value.title !== undefined) subtask.title = value.title;
    if (value.completed !== undefined) subtask.completed = value.completed;
    if (value.position !== undefined) subtask.position = value.position;
    subtask.updated_at = nowIso();
    task.updated_at = nowIso();
    persist();
    return { ok: true, subtask: clone(subtask) };
}

export function deleteSubtask(taskId, subtaskId) {
    if (!store.data) return { ok: false, errors: [{ message: 'store not loaded' }] };
    const task = store.data.tasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, errors: [{ path: 'task_id', message: 'task not found' }] };
    task.subtasks = task.subtasks.filter((s) => s.id !== subtaskId);
    task.updated_at = nowIso();
    persist();
    return { ok: true };
}

// --- settings --------------------------------------------------------------

export function setMarkdownOptions(options) {
    if (!store.data) return;
    store.data.settings.markdown_export = {
        include_subtasks: !!options.include_subtasks,
        include_someday: !!options.include_someday,
        include_notes: !!options.include_notes,
    };
    persist();
}

export function getMarkdownOptions() {
    return clone(store.data?.settings.markdown_export ?? {
        include_subtasks: false,
        include_someday: false,
        include_notes: false,
    });
}

// --- diagnostics -----------------------------------------------------------

export function getDiagnostics() {
    const data = store.data;
    if (!data) {
        return {
            status: store.status,
            schema_version: null,
            storage_key: 'zeek.planner.data.v1',
            last_saved: null,
            task_count: 0,
            subtask_count: 0,
            recurring_template_count: 0,
            generated_instance_count: 0,
            someday_count: 0,
            recurrence_exception_count: 0,
            corrupt: store.corrupt,
        };
    }
    let subtaskCount = 0;
    let templateCount = 0;
    let instanceCount = 0;
    let somedayCount = 0;
    for (const t of data.tasks) {
        subtaskCount += t.subtasks.length;
        if (isRecurrenceTemplate(t)) templateCount++;
        else if (isRecurrenceInstance(t)) instanceCount++;
        if (t.date == null) somedayCount++;
    }
    return {
        status: store.status,
        schema_version: data.schema_version,
        storage_key: 'zeek.planner.data.v1',
        last_saved: data.updated_at,
        task_count: data.tasks.length,
        subtask_count: subtaskCount,
        recurring_template_count: templateCount,
        generated_instance_count: instanceCount,
        someday_count: somedayCount,
        recurrence_exception_count: data.recurrence_exceptions.length,
        corrupt: store.corrupt,
    };
}

/** Canonical data, JSON-safe cloned. */
export function getData() {
    return clone(store.data);
}

export { clone };
