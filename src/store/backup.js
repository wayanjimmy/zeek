import { PlannerDataV1, ZeekBackupV1, dateString } from './schema';
import { validateData } from './storage';

export const BACKUP_KIND = 'zeek.planner.backup';
export const BACKUP_VERSION = 1;
export const APP_VERSION = 'web-1.0.0';

/** Build a versioned backup envelope around canonical data. */
export function buildBackup(data, source = { type: 'client' }) {
    return {
        kind: BACKUP_KIND,
        backup_version: BACKUP_VERSION,
        exported_at: new Date().toISOString(),
        app_version: APP_VERSION,
        source,
        data,
    };
}

function toObject(input) {
    if (typeof input === 'string') {
        try {
            return { ok: true, value: JSON.parse(input) };
        } catch (err) {
            return { ok: false, error: `JSON parse failed: ${err.message}` };
        }
    }
    if (input != null && typeof input === 'object') {
        return { ok: true, value: input };
    }
    return { ok: false, error: 'input must be a JSON string or object' };
}

/**
 * Accept one of:
 *   1. a full ZeekBackupV1 envelope,
 *   2. a raw PlannerDataV1 object,
 *   3. (later) a legacy Laravel export shape — see adaptLegacyLaravel.
 *
 * Returns `{ ok, data, source?, warnings }` or `{ ok: false, errors, raw }`.
 */
export function parseBackup(input) {
    const parsed = toObject(input);
    if (!parsed.ok) {
        return { ok: false, errors: [{ message: parsed.error }] };
    }
    const obj = parsed.value;

    // 1. Backup envelope.
    const env = ZeekBackupV1.safeParse(obj);
    if (env.success) {
        return { ok: true, data: env.data.data, source: env.data.source, warnings: [] };
    }

    // 2. Raw PlannerDataV1.
    const raw = PlannerDataV1.safeParse(obj);
    if (raw.success) {
        return { ok: true, data: raw.data, source: null, warnings: [] };
    }

    // 3. Legacy Laravel export (Phase 7). Reject clearly until the adapter exists.
    const legacy = adaptLegacyLaravel(obj);
    if (legacy) {
        const v = validateData(legacy);
        if (v.ok) return { ok: true, data: v.data, source: { type: 'legacy-laravel' }, warnings: legacy.__warnings ?? [] };
        return { ok: false, errors: v.issues ?? [{ message: v.error }], raw: obj };
    }

    const envIssues = env.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    const rawIssues = raw.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return {
        ok: false,
        errors: [
            { message: 'Input is neither a valid Zeek backup envelope nor raw PlannerDataV1.' },
            ...envIssues.slice(0, 5),
            ...rawIssues.slice(0, 5),
        ],
        raw: obj,
    };
}

/**
 * Detect + convert a legacy Laravel export. Returns a PlannerDataV1-shaped
 * object, or null if the input does not look like a legacy export.
 *
 * This is a stub: the actual legacy endpoint is Phase 7. We recognize the
 * legacy shape (an object with a `tasks` array of objects carrying numeric
 * `id`s) and convert per the plan's field mapping so imports don't silently
 * fail once a real export is produced.
 */
function adaptLegacyLaravel(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const tasks = obj.tasks;
    if (!Array.isArray(tasks)) return null;
    if (tasks.length === 0) return null;
    // Heuristic: legacy rows carry numeric ids and lack schema_version.
    if (typeof tasks[0].id !== 'number') return null;

    const now = new Date().toISOString();
    const warnings = [];
    const idMap = new Map(); // numeric id -> string id

    const converted = tasks.map((t) => {
        const id = `legacy_task_${t.id}`;
        idMap.set(t.id, id);
        return {
            id,
            title: t.title ?? 'Untitled',
            notes: normalizeNullable(t.notes),
            date: normalizeDate(t.date),
            due_date: normalizeDate(t.due_date),
            completed: !!t.completed,
            color: normalizeNullable(t.color),
            position: t.position ?? 0,
            someday_column: normalizeSomedayColumn(t.someday_column, t.date),
            recurrence_type: t.recurrence_type ?? 'none',
            recurrence_interval: t.recurrence_interval ?? 1,
            recurrence_weekdays: Array.isArray(t.recurrence_weekdays) ? [...t.recurrence_weekdays] : null,
            recurrence_ends_at: normalizeDate(t.recurrence_ends_at),
            recurrence_parent_id: t.recurrence_parent_id != null ? `legacy_task_${t.recurrence_parent_id}` : null,
            recurrence_last_generated_at: normalizeDate(t.recurrence_last_generated_at),
            subtasks: (t.subtasks ?? []).map((s) => ({
                id: `legacy_subtask_${s.id}`,
                task_id: id,
                title: s.title ?? '',
                completed: !!s.completed,
                position: s.position ?? 0,
                created_at: s.created_at ?? now,
                updated_at: s.updated_at ?? now,
            })),
            created_at: t.created_at ?? now,
            updated_at: t.updated_at ?? now,
        };
    });

    // Re-stamp subtask task_ids / recurrence_parent_ids via the id map.
    for (const t of converted) {
        for (const s of t.subtasks) s.task_id = t.id;
    }

    warnings.push('Converted from legacy Laravel export shape.');

    return {
        schema_version: 1,
        created_at: now,
        updated_at: now,
        settings: {
            current_week_start: null,
            markdown_export: { include_subtasks: false, include_someday: false, include_notes: false },
        },
        tasks: converted,
        recurrence_exceptions: [],
        __warnings: warnings,
    };
}

function normalizeDate(v) {
    if (v == null || v === '') return null;
    const s = typeof v === 'string' ? v.slice(0, 10) : null;
    return dateString.safeParse(s).success ? s : null;
}

function normalizeNullable(v) {
    if (v == null || v === '') return null;
    return String(v);
}

function normalizeSomedayColumn(col, date) {
    if (date != null) return null;
    if (col == null) return 0;
    const n = Number(col);
    if (n === 0 || n === 1 || n === 2) return n;
    return 0;
}

/**
 * Dry-run import preview. Does not mutate store or storage. Returns counts and
 * the date range of the candidate data, plus any validation errors.
 */
export function previewImport(input) {
    const parsed = parseBackup(input);
    if (!parsed.ok) {
        return { ok: false, errors: parsed.errors };
    }
    const data = parsed.data;
    let subtaskCount = 0;
    let templateCount = 0;
    let instanceCount = 0;
    let somedayCount = 0;
    let minDate = null;
    let maxDate = null;
    for (const t of data.tasks) {
        subtaskCount += t.subtasks.length;
        if (t.recurrence_type !== 'none' && t.recurrence_parent_id == null) templateCount++;
        else if (t.recurrence_parent_id != null) instanceCount++;
        if (t.date == null) somedayCount++;
        else {
            if (minDate == null || t.date < minDate) minDate = t.date;
            if (maxDate == null || t.date > maxDate) maxDate = t.date;
        }
    }
    return {
        ok: true,
        source: parsed.source,
        warnings: parsed.warnings,
        summary: {
            schema_version: data.schema_version,
            task_count: data.tasks.length,
            subtask_count: subtaskCount,
            recurring_template_count: templateCount,
            generated_instance_count: instanceCount,
            someday_count: somedayCount,
            recurrence_exception_count: data.recurrence_exceptions.length,
            date_range: { from: minDate, to: maxDate },
        },
    };
}
