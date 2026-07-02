import { PlannerDataV1, SCHEMA_VERSION } from './schema';

/**
 * Versioned localStorage persistence with safety nets:
 *
 *   zeek.planner.data.v1         active planner data
 *   zeek.planner.lastGood.v1     last successfully validated snapshot
 *   zeek.planner.snapshots.v1    small ring of pre-import/pre-reset snapshots
 *   zeek.planner.corrupt.<ts>    quarantined raw corrupt payloads
 *
 * Invariants:
 *  - Active data is never silently overwritten when it fails validation.
 *    Corrupt payloads are quarantined and the active key is left untouched
 *    until the caller explicitly chooses a recovery action.
 *  - lastGood is only written AFTER a successful validation of the active key.
 */

const DATA_KEY = 'zeek.planner.data.v1';
const LAST_GOOD_KEY = 'zeek.planner.lastGood.v1';
const SNAPSHOTS_KEY = 'zeek.planner.snapshots.v1';
const CORRUPT_PREFIX = 'zeek.planner.corrupt.';
const MAX_SNAPSHOTS = 5;

/**
 * Schema migration registry. Each entry takes a previously-persisted object
 * and returns the next version. Only forward migrations live here; if a future
 * version bumps SCHEMA_VERSION, add `2: (v1obj) => v2obj` here.
 */
const MIGRATIONS = {};

function safeParse(raw) {
    if (raw == null) return { ok: false, raw, error: 'missing' };
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        return { ok: false, raw, error: `JSON parse failed: ${err.message}` };
    }
    return { ok: true, value: parsed, raw };
}

/**
 * Validate a parsed object against the canonical schema, running migrations
 * first if a schema_version older than the current one is present.
 */
export function validateData(obj) {
    if (!obj || typeof obj !== 'object') {
        return { ok: false, error: 'not an object' };
    }
    const version = obj.schema_version;
    if (version !== undefined && version !== SCHEMA_VERSION && version < SCHEMA_VERSION) {
        let current = obj;
        for (let v = version; v < SCHEMA_VERSION; v++) {
            const migrate = MIGRATIONS[v + 1];
            if (!migrate) {
                return { ok: false, error: `no migration from schema_version ${v}` };
            }
            try {
                current = migrate(current);
            } catch (err) {
                return { ok: false, error: `migration ${v}->${v + 1} failed: ${err.message}` };
            }
        }
        obj = current;
    }
    const result = PlannerDataV1.safeParse(obj);
    if (result.success) {
        return { ok: true, data: result.data };
    }
    return {
        ok: false,
        error: 'schema validation failed',
        issues: result.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
        })),
    };
}

/**
 * Load and validate active data.
 * Returns:
 *   { status: 'ok', data }
 *   { status: 'empty' }                         // no data stored yet
 *   { status: 'corrupt', raw, error, issues }   // present but invalid
 */
export function load() {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw == null) return { status: 'empty' };
    const parsed = safeParse(raw);
    if (!parsed.ok) {
        return { status: 'corrupt', raw, error: parsed.error };
    }
    const v = validateData(parsed.value);
    if (v.ok) return { status: 'ok', data: v.data };
    return { status: 'corrupt', raw, error: v.error, issues: v.issues };
}

/**
 * Persist canonical data. The object is validated before writing; throws if
 * invalid so the caller never writes a corrupt active document.
 */
export function save(data) {
    const v = validateData(data);
    if (!v.ok) {
        throw new Error(`refusing to save invalid data: ${v.error}`);
    }
    localStorage.setItem(DATA_KEY, JSON.stringify(v.data));
    localStorage.setItem(LAST_GOOD_KEY, JSON.stringify(v.data));
    return v.data;
}

/** Replace active data WITHOUT touching lastGood (used by restore). */
export function replace(data) {
    const v = validateData(data);
    if (!v.ok) {
        throw new Error(`refusing to replace with invalid data: ${v.error}`);
    }
    localStorage.setItem(DATA_KEY, JSON.stringify(v.data));
    return v.data;
}

/** Load the last-good snapshot, if any. */
export function loadLastGood() {
    const raw = localStorage.getItem(LAST_GOOD_KEY);
    if (raw == null) return null;
    const parsed = safeParse(raw);
    if (!parsed.ok) return null;
    const v = validateData(parsed.value);
    return v.ok ? v.data : null;
}

/** Ring-buffer snapshot taken before destructive operations (import/reset). */
export function pushSnapshot(label, data) {
    let snapshots = [];
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (raw) {
        try {
            snapshots = JSON.parse(raw) ?? [];
        } catch {
            snapshots = [];
        }
    }
    snapshots.unshift({ label, taken_at: new Date().toISOString(), data });
    if (snapshots.length > MAX_SNAPSHOTS) snapshots.length = MAX_SNAPSHOTS;
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
    return snapshots;
}

export function listSnapshots() {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw) ?? [];
    } catch {
        return [];
    }
}

export function clearSnapshots() {
    localStorage.removeItem(SNAPSHOTS_KEY);
}

/** Quarantine a raw corrupt payload so the user can download/recover it. */
export function quarantine(raw, error) {
    const ts = Date.now();
    const key = `${CORRUPT_PREFIX}${ts}`;
    try {
        localStorage.setItem(key, JSON.stringify({ quarantined_at: new Date().toISOString(), error, raw }));
    } catch {
        // localStorage may be full; best-effort.
    }
    return key;
}

export function listQuarantined() {
    const out = [];
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CORRUPT_PREFIX)) {
            const raw = localStorage.getItem(key);
            try {
                out.push({ key, ...JSON.parse(raw) });
            } catch {
                out.push({ key, raw });
            }
        }
    }
    return out;
}

export function removeQuarantined(key) {
    localStorage.removeItem(key);
}

/** Wipe the active key (used by "start fresh" recovery). */
export function clearActive() {
    localStorage.removeItem(DATA_KEY);
}
