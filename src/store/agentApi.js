import {
    addSubtask,
    createTask,
    currentWeekStart,
    deleteSubtask,
    deleteTask,
    generateForVisibleWeek,
    generateForWeek,
    getData,
    getDiagnostics,
    initStore,
    moveTask,
    store,
    toggleTask,
    updateSubtask,
    updateTask,
} from './plannerStore';
import { buildBackup, previewImport, parseBackup } from './backup';
import { exportMarkdown } from './markdown';
import { validateData } from './storage';
import { addDaysLocal, startOfWeekLocal, todayLocal } from './dates';

const API_VERSION = 1;

let readyResolve;
const ready = new Promise((resolve) => {
    readyResolve = resolve;
});

/** Boot the store and resolve the readiness promise. Called from app.js. */
export function bootAgentApi() {
    initStore();
    readyResolve({
        api_version: API_VERSION,
        schema_version: store.data?.schema_version ?? null,
        status: store.status,
    });
    return ready;
}

function ok(payload) {
    return { ok: true, ...payload };
}

function fail(errors) {
    return { ok: false, errors: Array.isArray(errors) ? errors : [{ message: String(errors) }] };
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function wrapResult(result) {
    if (result && result.ok) return { ...result };
    return fail(result?.errors ?? [{ message: 'unknown error' }]);
}

const api = {
    /** Resolves once the store has loaded (or quarantined corrupt data). */
    get ready() {
        return ready;
    },

    help() {
        return {
            name: 'Zeek',
            api_version: API_VERSION,
            schema_version: store.data?.schema_version ?? null,
            storage_key: 'zeek.planner.data.v1',
            methods: {
                getData: '() -> PlannerDataV1',
                getDiagnostics: '() -> storage status object',
                exportData: "({ format: 'backup' | 'raw' | 'markdown' }) -> string | object",
                importData: "(input, { mode: 'replace', dryRun: boolean }) -> { ok, summary?, errors?, warnings? }",
                validateData: '(input) -> { ok, errors? }',
                list: "({ week_start?, include_someday?, include_completed?, date_from?, date_to? }) -> TaskV1[]",
                create: '(CreateTaskInput) -> { ok, task } | { ok:false, errors }',
                update: '(id, UpdateTaskInput) -> { ok, task } | { ok:false, errors }',
                delete: '(id) -> { ok } | { ok:false, errors }',
                move: '(id, { date?, someday_column?, position? }) -> { ok, task } | { ok:false, errors }',
            },
            invariants: [
                'date === null means Someday; someday_column must then be 0|1|2',
                'dated tasks have someday_column === null',
                'all persisted dates are local YYYY-MM-DD strings',
                'recurrence templates: recurrence_type !== none && recurrence_parent_id === null',
                'recurrence instances: recurrence_parent_id !== null, start incomplete',
                'subtasks are NOT cloned into generated instances',
            ],
        };
    },

    getData() {
        return clone(store.data);
    },

    getDiagnostics() {
        return getDiagnostics();
    },

    exportData({ format = 'backup' } = {}) {
        const data = store.data;
        if (!data) return fail([{ message: 'store not loaded' }]);
        if (format === 'markdown') {
            const week = currentWeekStart() ?? startOfWeekLocal(todayLocal());
            return ok({ format: 'markdown', content: exportMarkdown(week, data) });
        }
        if (format === 'raw') {
            return ok({ format: 'raw', data: clone(data) });
        }
        const backup = buildBackup(clone(data), { type: 'client' });
        return ok({ format: 'backup', data: clone(backup) });
    },

    validateData(input) {
        const v = validateData(input);
        return v.ok ? ok({}) : fail(v.issues ?? [{ message: v.error }]);
    },

    importData(input, { mode = 'replace', dryRun = false } = {}) {
        if (dryRun) {
            const p = previewImport(input);
            return p.ok ? ok({ summary: p.summary, warnings: p.warnings, source: p.source }) : fail(p.errors);
        }
        if (mode !== 'replace') {
            return fail([{ path: 'mode', message: 'only replace mode is supported in the MVP' }]);
        }
        const parsed = parseBackup(input);
        if (!parsed.ok) return fail(parsed.errors);

        // Pre-import snapshot so the user can roll back.
        if (store.data) {
            try {
                localStorage.setItem(
                    'zeek.planner.snapshots.v1',
                    JSON.stringify([
                        {
                            label: 'pre-import',
                            taken_at: new Date().toISOString(),
                            data: clone(store.data),
                        },
                        ...JSON.parse(localStorage.getItem('zeek.planner.snapshots.v1') ?? '[]'),
                    ].slice(0, 5)),
                );
            } catch {
                // best-effort
            }
        }

        store.data = parsed.data;
        store.status = 'ok';
        store.corrupt = null;
        if (!store.data.settings.current_week_start) {
            store.data.settings.current_week_start = startOfWeekLocal(todayLocal());
        }
        try {
            localStorage.setItem('zeek.planner.data.v1', JSON.stringify(store.data));
            localStorage.setItem('zeek.planner.lastGood.v1', JSON.stringify(store.data));
        } catch (err) {
            return fail([{ message: `persist failed: ${err.message}` }]);
        }
        generateForVisibleWeek();

        return ok({
            summary: previewImport(input).summary ?? null,
            warnings: parsed.warnings,
            source: parsed.source,
        });
    },

    list({
        week_start,
        include_someday = true,
        include_completed = true,
        date_from,
        date_to,
    } = {}) {
        if (!store.data) return [];

        if (week_start) {
            // Generate for the requested week (not the store's current week),
            // so querying any week fills its recurrence instances.
            generateForWeek(week_start);
            const start = startOfWeekLocal(week_start) ?? week_start;
            const end = addDaysLocal(start, 6);
            const items = store.data.tasks.filter(
                (t) => (t.date != null && t.date >= start && t.date <= end) || (t.date == null && include_someday),
            );
            return clone(include_completed ? items : items.filter((t) => !t.completed));
        }

        let items = store.data.tasks;
        if (date_from || date_to) {
            items = items.filter((t) => {
                if (t.date == null) return include_someday;
                if (date_from && t.date < date_from) return false;
                if (date_to && t.date > date_to) return false;
                return true;
            });
        } else if (!include_someday) {
            items = items.filter((t) => t.date != null);
        }
        if (!include_completed) items = items.filter((t) => !t.completed);
        return clone(items);
    },

    create(input) {
        return wrapResult(createTask(input));
    },

    update(id, patch) {
        return wrapResult(updateTask(id, patch));
    },

    delete(id) {
        return wrapResult(deleteTask(id));
    },

    move(id, destination) {
        return wrapResult(moveTask(id, destination));
    },
};

export function installAgentApi() {
    if (typeof window === 'undefined') return api;
    window.Zeek = api;
    return api;
}

export { api };
