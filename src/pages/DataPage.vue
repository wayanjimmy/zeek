<template>
    <div class="min-h-screen bg-gray-50 text-gray-900">
        <div class="max-w-3xl mx-auto px-6 py-10 space-y-10">
            <header class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold">Data &amp; backups</h1>
                    <p class="text-sm text-gray-500 mt-1">
                        Zeek runs entirely in your browser. Your planner data lives in localStorage —
                        clear it and it's gone. Export a JSON backup to stay safe.
                    </p>
                </div>
                <RouterLink to="/" class="text-sm text-indigo-600 hover:underline">← Back to planner</RouterLink>
            </header>

            <!-- Storage status -->
            <section class="bg-white rounded-lg border border-gray-200 p-6">
                <h2 class="font-semibold text-lg mb-4">Storage status</h2>
                <dl class="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6 text-sm">
                    <div>
                        <dt class="text-gray-500">Status</dt>
                        <dd class="font-medium">
                            <span :class="statusBadgeClass">{{ diagnostics.status }}</span>
                        </dd>
                    </div>
                    <div>
                        <dt class="text-gray-500">Schema version</dt>
                        <dd class="font-medium tabular-nums">{{ diagnostics.schema_version ?? '—' }}</dd>
                    </div>
                    <div>
                        <dt class="text-gray-500">Last saved</dt>
                        <dd class="font-medium">{{ formatTime(diagnostics.last_saved) }}</dd>
                    </div>
                    <div>
                        <dt class="text-gray-500">Tasks</dt>
                        <dd class="font-medium tabular-nums">{{ diagnostics.task_count }}</dd>
                    </div>
                    <div>
                        <dt class="text-gray-500">Subtasks</dt>
                        <dd class="font-medium tabular-nums">{{ diagnostics.subtask_count }}</dd>
                    </div>
                    <div>
                        <dt class="text-gray-500">Someday tasks</dt>
                        <dd class="font-medium tabular-nums">{{ diagnostics.someday_count }}</dd>
                    </div>
                    <div>
                        <dt class="text-gray-500">Recurrence templates</dt>
                        <dd class="font-medium tabular-nums">{{ diagnostics.recurring_template_count }}</dd>
                    </div>
                    <div>
                        <dt class="text-gray-500">Generated instances</dt>
                        <dd class="font-medium tabular-nums">{{ diagnostics.generated_instance_count }}</dd>
                    </div>
                    <div>
                        <dt class="text-gray-500">Recurrence exceptions</dt>
                        <dd class="font-medium tabular-nums">{{ diagnostics.recurrence_exception_count }}</dd>
                    </div>
                </dl>
            </section>

            <!-- Corruption recovery -->
            <section v-if="diagnostics.corrupt" class="bg-red-50 rounded-lg border border-red-200 p-6">
                <h2 class="font-semibold text-lg mb-2 text-red-800">Active data is corrupt</h2>
                <p class="text-sm text-red-700 mb-4">
                    The saved planner data failed validation and was not overwritten. The raw payload
                    was quarantined so you can download it or try another recovery path.
                </p>
                <pre class="text-xs bg-white border border-red-200 rounded p-3 overflow-x-auto mb-4 max-h-40">{{ diagnostics.corrupt.error }}{{ diagnostics.corrupt.issues ? '\n' + JSON.stringify(diagnostics.corrupt.issues, null, 2) : '' }}</pre>
                <div class="flex flex-wrap gap-3">
                    <button @click="downloadCorrupt" class="px-4 py-2 bg-white border border-red-300 rounded text-sm font-medium text-red-700 hover:bg-red-100">Download corrupt raw data</button>
                    <button @click="restoreLastGood" class="px-4 py-2 bg-white border border-gray-300 rounded text-sm font-medium hover:bg-gray-50">Restore last good snapshot</button>
                    <button @click="startFresh" class="px-4 py-2 bg-white border border-gray-300 rounded text-sm font-medium hover:bg-gray-50">Start fresh (keep corrupt as snapshot)</button>
                </div>
            </section>

            <!-- Export -->
            <section class="bg-white rounded-lg border border-gray-200 p-6">
                <h2 class="font-semibold text-lg mb-4">Export</h2>
                <div class="flex flex-wrap gap-3">
                    <button @click="downloadBackup" class="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700">Download JSON backup</button>
                    <button @click="copyBackup" class="px-4 py-2 bg-white border border-gray-300 rounded text-sm font-medium hover:bg-gray-50">Copy JSON backup</button>
                    <button @click="downloadMarkdown" class="px-4 py-2 bg-white border border-gray-300 rounded text-sm font-medium hover:bg-gray-50">Export Markdown (current week)</button>
                </div>
                <p class="text-xs text-gray-500 mt-3">
                    JSON is the only full-fidelity, restorable format. Markdown is human-readable only.
                </p>
            </section>

            <!-- Import / restore -->
            <section class="bg-white rounded-lg border border-gray-200 p-6">
                <h2 class="font-semibold text-lg mb-4">Import / restore</h2>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm text-gray-600 mb-1">Import from file</label>
                        <input
                            type="file"
                            accept="application/json,.json"
                            @change="onFileSelected"
                            class="text-sm"
                            aria-label="Choose a JSON backup file to import"
                        />
                    </div>
                    <div>
                        <label class="block text-sm text-gray-600 mb-1">Or paste JSON</label>
                        <textarea
                            v-model="importText"
                            rows="6"
                            placeholder='Paste a Zeek JSON backup or raw planner data…'
                            class="w-full p-2 border border-gray-200 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            aria-label="Paste JSON backup"
                        ></textarea>
                    </div>

                    <div class="flex flex-wrap gap-3">
                        <button @click="dryRun" class="px-4 py-2 bg-white border border-gray-300 rounded text-sm font-medium hover:bg-gray-50" :disabled="!canImport">Dry-run preview</button>
                        <button @click="confirmReplace" class="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700" :disabled="!canImport">Replace data</button>
                    </div>

                    <!-- Preview -->
                    <div v-if="preview" class="bg-gray-50 border border-gray-200 rounded p-4 text-sm">
                        <div class="font-medium mb-2">Preview (no changes made yet)</div>
                        <dl class="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-6">
                            <div><dt class="text-gray-500">Schema version</dt><dd class="tabular-nums">{{ preview.summary.schema_version }}</dd></div>
                            <div><dt class="text-gray-500">Tasks</dt><dd class="tabular-nums">{{ preview.summary.task_count }}</dd></div>
                            <div><dt class="text-gray-500">Subtasks</dt><dd class="tabular-nums">{{ preview.summary.subtask_count }}</dd></div>
                            <div><dt class="text-gray-500">Someday</dt><dd class="tabular-nums">{{ preview.summary.someday_count }}</dd></div>
                            <div><dt class="text-gray-500">Templates</dt><dd class="tabular-nums">{{ preview.summary.recurring_template_count }}</dd></div>
                            <div><dt class="text-gray-500">Instances</dt><dd class="tabular-nums">{{ preview.summary.generated_instance_count }}</dd></div>
                            <div class="col-span-2 sm:col-span-3"><dt class="text-gray-500">Date range</dt><dd class="tabular-nums">{{ preview.summary.date_range.from ?? '—' }} → {{ preview.summary.date_range.to ?? '—' }}</dd></div>
                        </dl>
                        <div v-if="preview.warnings?.length" class="mt-3 text-amber-700">
                            <div v-for="(w, i) in preview.warnings" :key="i" class="text-xs">⚠ {{ w }}</div>
                        </div>
                    </div>

                    <div v-if="importErrors" class="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                        <div class="font-medium mb-1">Import rejected:</div>
                        <ul class="list-disc list-inside text-xs space-y-0.5">
                            <li v-for="(e, i) in importErrors" :key="i">{{ e.path ? e.path + ': ' : '' }}{{ e.message }}</li>
                        </ul>
                    </div>
                </div>
            </section>

            <!-- Snapshots -->
            <section v-if="snapshots.length" class="bg-white rounded-lg border border-gray-200 p-6">
                <h2 class="font-semibold text-lg mb-4">Pre-change snapshots ({{ snapshots.length }})</h2>
                <ul class="divide-y divide-gray-100 text-sm">
                    <li v-for="s in snapshots" :key="s.taken_at" class="py-2 flex items-center justify-between">
                        <span class="text-gray-600">
                            <span class="font-medium">{{ s.label }}</span> · {{ formatTime(s.taken_at) }} · {{ s.data?.tasks?.length ?? 0 }} tasks
                        </span>
                        <button @click="restoreSnapshot(s)" class="text-indigo-600 hover:underline text-xs">restore</button>
                    </li>
                </ul>
            </section>

            <!-- Quarantined corrupt payloads -->
            <section v-if="quarantined.length" class="bg-white rounded-lg border border-gray-200 p-6">
                <h2 class="font-semibold text-lg mb-4">Quarantined payloads ({{ quarantined.length }})</h2>
                <p class="text-sm text-gray-500 mb-3">
                    Raw payloads that failed validation and were quarantined so they would not overwrite
                    your active data. Download to inspect, or discard once you're done.
                </p>
                <ul class="divide-y divide-gray-100 text-sm">
                    <li v-for="q in quarantined" :key="q.key" class="py-2 flex items-center justify-between">
                        <span class="text-gray-600">
                            {{ formatTime(q.quarantined_at) }} · <span class="text-red-600">{{ q.error }}</span>
                        </span>
                        <span class="flex gap-3">
                            <button @click="downloadQuarantined(q)" class="text-indigo-600 hover:underline text-xs">download</button>
                            <button @click="discardQuarantined(q.key)" class="text-gray-500 hover:text-red-600 text-xs">discard</button>
                        </span>
                    </li>
                </ul>
            </section>
        </div>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useClipboard } from '@/composables/useClipboard';
import { store, getDiagnostics, currentWeekStart } from '@/store/plannerStore';
import { buildBackup, parseBackup, previewImport } from '@/store/backup';
import { exportMarkdown } from '@/store/markdown';
import * as storage from '@/store/storage';
import { startOfWeekLocal, todayLocal } from '@/store/dates';

const { copyText } = useClipboard();

const diagnostics = computed(() => getDiagnostics());
const snapshots = ref(storage.listSnapshots());
const quarantined = ref(storage.listQuarantined());

const importText = ref('');
const preview = ref(null);
const importErrors = ref(null);

const canImport = computed(() => importText.value.trim().length > 0);

const statusBadgeClass = computed(() => {
    switch (diagnostics.value.status) {
        case 'ok':
            return 'text-green-600';
        case 'corrupt':
            return 'text-red-600';
        default:
            return 'text-gray-500';
    }
});

function formatTime(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function activeData() {
    return store.data;
}

// --- export -----------------------------------------------------------------

function download(filename, content, mime = 'application/json') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadBackup() {
    const backup = buildBackup(JSON.parse(JSON.stringify(activeData())), { type: 'client' });
    download(`zeek-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2));
}

async function copyBackup() {
    const backup = buildBackup(JSON.parse(JSON.stringify(activeData())), { type: 'client' });
    await copyText(JSON.stringify(backup, null, 2));
}

function downloadMarkdown() {
    const week = currentWeekStart() ?? startOfWeekLocal(todayLocal());
    const md = exportMarkdown(week, activeData());
    download(`zeek-week-${week}.md`, md, 'text/markdown');
}

// --- import ----------------------------------------------------------------

async function onFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    importText.value = text;
    preview.value = null;
    importErrors.value = null;
}

function dryRun() {
    importErrors.value = null;
    const p = previewImport(importText.value);
    if (p.ok) {
        preview.value = p;
    } else {
        preview.value = null;
        importErrors.value = p.errors;
    }
}

function confirmReplace() {
    importErrors.value = null;
    const parsed = parseBackup(importText.value);
    if (!parsed.ok) {
        importErrors.value = parsed.errors;
        return;
    }
    if (!confirm('Replace all current planner data with the imported data? This creates a pre-import snapshot you can restore from this page.')) return;

    // Pre-import snapshot.
    if (activeData()) storage.pushSnapshot('pre-import', JSON.parse(JSON.stringify(activeData())));

    store.data = parsed.data;
    store.status = 'ok';
    store.corrupt = null;
    if (!store.data.settings.current_week_start) {
        store.data.settings.current_week_start = startOfWeekLocal(todayLocal());
    }
    try {
        storage.replace(store.data);
        localStorage.setItem('zeek.planner.lastGood.v1', JSON.stringify(store.data));
    } catch (err) {
        importErrors.value = [{ message: `persist failed: ${err.message}` }];
        return;
    }
    preview.value = null;
    snapshots.value = storage.listSnapshots();
}

// --- corruption recovery ----------------------------------------------------

function downloadCorrupt() {
    const raw = diagnostics.value.corrupt?.raw ?? '';
    download(`zeek-corrupt-${Date.now()}.json`, typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2));
}

function restoreLastGood() {
    const lastGood = storage.loadLastGood();
    if (!lastGood) {
        alert('No valid last-good snapshot available.');
        return;
    }
    if (!confirm('Restore the last good snapshot? Current (corrupt) data stays quarantined.')) return;
    storage.pushSnapshot('pre-restore-lastgood', JSON.parse(JSON.stringify(lastGood)));
    store.data = lastGood;
    store.status = 'ok';
    store.corrupt = null;
    storage.replace(store.data);
    localStorage.setItem('zeek.planner.lastGood.v1', JSON.stringify(store.data));
}

function startFresh() {
    if (!confirm('Start fresh? The corrupt payload is quarantined (downloadable above) and a snapshot is taken.')) return;
    const now = new Date().toISOString();
    const fresh = {
        schema_version: 1,
        created_at: now,
        updated_at: now,
        settings: {
            current_week_start: startOfWeekLocal(todayLocal()),
            markdown_export: { include_subtasks: false, include_someday: false, include_notes: false },
        },
        tasks: [],
        recurrence_exceptions: [],
    };
    storage.pushSnapshot('pre-start-fresh', activeData() ? JSON.parse(JSON.stringify(activeData())) : { corrupt: true });
    storage.clearActive();
    store.data = fresh;
    store.status = 'ok';
    store.corrupt = null;
    storage.save(store.data);
}

function restoreSnapshot(s) {
    if (!confirm(`Restore snapshot "${s.label}" taken ${formatTime(s.taken_at)}? This replaces current data.`)) return;
    storage.pushSnapshot('pre-restore-snapshot', JSON.parse(JSON.stringify(activeData())));
    store.data = JSON.parse(JSON.stringify(s.data));
    store.status = 'ok';
    store.corrupt = null;
    storage.replace(store.data);
    localStorage.setItem('zeek.planner.lastGood.v1', JSON.stringify(store.data));
    snapshots.value = storage.listSnapshots();
}

function downloadQuarantined(q) {
    const raw = q.raw ?? '';
    download(`zeek-quarantined-${(q.quarantined_at || Date.now())}.json`, typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2));
}

function discardQuarantined(key) {
    if (!confirm('Discard this quarantined payload? It cannot be recovered after.')) return;
    storage.removeQuarantined(key);
    quarantined.value = storage.listQuarantined();
}
</script>
