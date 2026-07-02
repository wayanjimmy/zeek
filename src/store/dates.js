/**
 * Local-calendar date math. Every persisted planner date is a `YYYY-MM-DD`
 * string representing a calendar day, NOT a JS timestamp. We construct Date
 * objects at local midnight so calendar arithmetic never drifts across
 * timezone/DST boundaries.
 */

const PAD = (n) => String(n).padStart(2, '0');

/** Parse YYYY-MM-DD (or null) to a Date at local midnight. Returns null for null/invalid. */
export function parseLocal(value) {
    if (value == null) return null;
    if (value instanceof Date) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Format a Date (or YYYY-MM-DD string) as YYYY-MM-DD. Returns null for null/invalid. */
export function formatLocal(value) {
    if (value == null) return null;
    const d = value instanceof Date ? value : parseLocal(value);
    if (!d || Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
}

/** Today as YYYY-MM-DD (local). */
export function todayLocal() {
    return formatLocal(new Date());
}

export function addDaysLocal(value, days) {
    const d = parseLocal(value);
    if (!d) return null;
    d.setDate(d.getDate() + days);
    return formatLocal(d);
}

export function addMonthsLocal(value, months) {
    const d = parseLocal(value);
    if (!d) return null;
    const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
    // Day-of-month: keep the original day, clamping to month length (matches
    // Carbon addMonthsNoOverflow semantics — no spillover into next month).
    const day = Math.min(d.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
    target.setDate(day);
    return formatLocal(target);
}

export function addYearsLocal(value, years) {
    const d = parseLocal(value);
    if (!d) return null;
    return formatLocal(new Date(d.getFullYear() + years, d.getMonth(), d.getDate()));
}

function daysInMonth(year, month /* 0-indexed */) {
    return new Date(year, month + 1, 0).getDate();
}

/** Monday-based start of week for a YYYY-MM-DD string. */
export function startOfWeekLocal(value) {
    const d = parseLocal(value);
    if (!d) return null;
    // JS getDay: 0=Sunday..6=Saturday. Week starts Monday.
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow; // shift Sunday(0) to previous Monday
    return addDaysLocal(d, diff);
}

export function compareDates(a, b) {
    const da = formatLocal(a);
    const db = formatLocal(b);
    if (da === db) return 0;
    return da < db ? -1 : 1;
}

export const isBefore = (a, b) => compareDates(a, b) < 0;
export const isAfter = (a, b) => compareDates(a, b) > 0;
export const isSameOrBefore = (a, b) => compareDates(a, b) <= 0;
export const isSameOrAfter = (a, b) => compareDates(a, b) >= 0;
