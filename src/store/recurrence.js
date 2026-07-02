import {
    addDaysLocal,
    addMonthsLocal,
    addYearsLocal,
    isAfter,
    isBefore,
    isSameOrBefore,
    isSameOrAfter,
    parseLocal,
    todayLocal,
} from './dates';

/**
 * Client-side recurrence generation. A faithful port of the legacy
 * App\Services\TaskRecurrenceService semantics, with two deliberate changes
 * called out in the plan:
 *
 *   1. Generation is bounded to the requested visible range (not an unbounded
 *      future lookahead). Past generated instances are preserved.
 *   2. Deleting a generated instance records a `recurrence_exception` so the
 *      generator will not recreate it on the next pass.
 *
 * Template-update disposal preserves `date > today` (strictly future) rather
 * than `date >= today`. This matches the existing app's behavior and avoids
 * wiping the completion state of today's occurrence when a template is edited.
 *
 * Recurrence template invariants:
 *   - template: recurrence_type !== 'none' && recurrence_parent_id === null
 *   - instance:  recurrence_parent_id !== null (starts incomplete)
 *   - subtasks are NOT cloned into generated instances (MVP, matches legacy)
 */

const SAFETY_CAP = 10000;

export function isRecurrenceTemplate(task) {
    return task.recurrence_type !== 'none' && task.recurrence_parent_id === null;
}

export function isRecurrenceInstance(task) {
    return task.recurrence_parent_id !== null;
}

function instanceExists(data, parentId, date) {
    return data.tasks.some(
        (t) => t.recurrence_parent_id === parentId && t.date === date,
    );
}

function isExcepted(data, parentId, date) {
    return data.recurrence_exceptions.some(
        (e) => e.parent_task_id === parentId && e.date === date,
    );
}

function nowIso() {
    return new Date().toISOString();
}

function nextDowLocal(value, dow) {
    // Next date strictly in the future with the given day-of-week (0=Sun..6=Sat).
    const d = parseLocal(value);
    let diff = (dow - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    return addDaysLocal(d, diff);
}

function addWeeksLocal(value, weeks) {
    return addDaysLocal(value, weeks * 7);
}

/**
 * Next occurrence date strictly after `from`, per the template's recurrence
 * pattern. Ported from TaskRecurrenceService::nextOccurrenceDate.
 */
function nextOccurrenceDate(template, from) {
    if (template.recurrence_type === 'none') return null;
    const interval = Math.max(1, Number(template.recurrence_interval) || 1);

    switch (template.recurrence_type) {
        case 'daily':
            return addDaysLocal(from, interval);
        case 'weekly':
            return nextWeeklyDate(template, from, interval);
        case 'monthly':
            return addMonthsLocal(from, interval);
        case 'yearly':
            return addYearsLocal(from, interval);
        default:
            return addDaysLocal(from, interval);
    }
}

function nextWeeklyDate(template, from, interval) {
    const weekdays = template.recurrence_weekdays ?? [];
    if (weekdays.length === 0) {
        return addWeeksLocal(from, interval);
    }

    const currentDow = parseLocal(from).getDay();
    const sorted = [...weekdays].sort((a, b) => a - b);

    for (const dow of sorted) {
        if (dow > currentDow) {
            return nextDowLocal(from, dow);
        }
    }

    const firstDow = sorted[0];
    return nextDowLocal(addWeeksLocal(from, interval), firstDow);
}

function createChildInstance(template, date) {
    return {
        id: genId(),
        title: template.title,
        notes: template.notes ?? null,
        date,
        due_date: template.due_date ?? null,
        completed: false,
        color: template.color ?? null,
        position: 0,
        someday_column: null,
        recurrence_type: template.recurrence_type,
        recurrence_interval: template.recurrence_interval,
        recurrence_weekdays: template.recurrence_weekdays ? [...template.recurrence_weekdays] : null,
        recurrence_ends_at: template.recurrence_ends_at ?? null,
        recurrence_parent_id: template.id,
        recurrence_last_generated_at: null,
        subtasks: [],
        created_at: nowIso(),
        updated_at: nowIso(),
    };
}

/**
 * Generate missing instances for every template within [rangeStart, rangeEnd].
 * Mutates `data` in place. Returns the number of instances created.
 */
export function generateForRange(data, rangeStart, rangeEnd) {
    if (!rangeStart || !rangeEnd) return 0;
    let created = 0;
    for (const task of data.tasks) {
        if (isRecurrenceTemplate(task)) {
            created += generateForTemplate(data, task, rangeStart, rangeEnd);
        }
    }
    return created;
}

/**
 * Generate missing instances for one template within the visible range.
 * Iterates occurrences from the template anchor forward, creating any that
 * fall in range, are missing, and are not excepted. Past instances are never
 * touched.
 */
export function generateForTemplate(data, template, rangeStart, rangeEnd) {
    if (!isRecurrenceTemplate(template) || !template.date) return 0;

    const endsAt = template.recurrence_ends_at;
    let d = template.date;
    let created = 0;
    let lastCreated = null;

    for (let i = 0; i < SAFETY_CAP; i++) {
        d = nextOccurrenceDate(template, d);
        if (!d) break;
        if (isAfter(d, rangeEnd)) break;
        if (endsAt && isAfter(d, endsAt)) break;

        if (isSameOrAfter(d, rangeStart) && !instanceExists(data, template.id, d) && !isExcepted(data, template.id, d)) {
            data.tasks.push(createChildInstance(template, d));
            created++;
            lastCreated = d;
        }
    }

    if (lastCreated) {
        const prev = template.recurrence_last_generated_at;
        if (!prev || isAfter(lastCreated, prev)) {
            template.recurrence_last_generated_at = lastCreated;
        }
    }

    return created;
}

export function onTemplateCreated(data, template, rangeStart, rangeEnd) {
    if (!isRecurrenceTemplate(template) || !template.date) return 0;
    return generateForTemplate(data, template, rangeStart, rangeEnd);
}

const RECURRENCE_FIELDS = [
    'recurrence_type',
    'recurrence_interval',
    'recurrence_weekdays',
    'recurrence_ends_at',
    'date',
];

/**
 * Called after a template's fields change. Ported from
 * TaskRecurrenceService::onTemplateUpdated, bounded to the visible range.
 *
 * @param {object} original  snapshot of the task before the update
 */
export function onTemplateUpdated(data, task, original, rangeStart, rangeEnd) {
    const wasTemplate = original.recurrence_type !== 'none' && original.recurrence_parent_id === null;
    const isTemplate = isRecurrenceTemplate(task);

    const changed = RECURRENCE_FIELDS.some((f) => !sameValue(task[f], original[f]));
    if (!changed) return 0;

    const today = todayLocal();

    if (wasTemplate && !isTemplate) {
        // Recurrence was turned off: dispose of strictly-future instances and
        // clear recurrence fields on the (now ordinary) task.
        data.tasks = data.tasks.filter(
            (t) => !(t.recurrence_parent_id === task.id && isAfter(t.date, today)),
        );
        task.recurrence_interval = 1;
        task.recurrence_weekdays = null;
        task.recurrence_ends_at = null;
        task.recurrence_last_generated_at = null;
        return 0;
    }

    if (!isTemplate && !wasTemplate) return 0;

    // Template still a template: dispose of strictly-future instances and
    // regenerate for the visible range. Past instances (and today's) preserved.
    data.tasks = data.tasks.filter(
        (t) => !(t.recurrence_parent_id === task.id && isAfter(t.date, today)),
    );
    task.recurrence_last_generated_at = null;
    return generateForTemplate(data, task, rangeStart, rangeEnd);
}

function sameValue(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        const sa = [...a].sort();
        const sb = [...b].sort();
        return sa.every((v, i) => v === sb[i]);
    }
    return false;
}

/**
 * Record a `deleted` exception so a disposed instance is not regenerated.
 */
export function addDeletedException(data, instance) {
    if (!isRecurrenceInstance(instance)) return;
    data.recurrence_exceptions.push({
        parent_task_id: instance.recurrence_parent_id,
        date: instance.date,
        reason: 'deleted',
        created_at: nowIso(),
    });
}

/**
 * Remove future generated instances for a template being deleted. Past
 * instances (and today's) are preserved as history. The caller deletes the
 * template row itself.
 */
export function disposeFutureInstances(data, templateId) {
    const today = todayLocal();
    data.tasks = data.tasks.filter(
        (t) => !(t.recurrence_parent_id === templateId && isAfter(t.date, today)),
    );
    // Exceptions for a deleted template are no longer meaningful.
    data.recurrence_exceptions = data.recurrence_exceptions.filter(
        (e) => e.parent_task_id !== templateId,
    );
}

function genId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}
