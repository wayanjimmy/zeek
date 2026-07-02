<template>
    <div class="flex flex-col h-screen bg-white">
        <Header
            :week-start="weekStart"
            @prev="navigateWeek(-1)"
            @next="navigateWeek(1)"
            @copy-markdown="handleCopyMarkdown"
        />
        <div class="flex-1 min-h-0">
            <WeeklyView
                :week-start="weekStart"
                :tasks="tasks"
                @add-task="handleAddTask"
                @toggle-task="handleToggleTask"
                @update-task="handleUpdateTask"
                @delete-task="handleDeleteTask"
                @add-subtask="handleAddSubtask"
                @toggle-subtask="handleToggleSubtask"
                @delete-subtask="handleDeleteSubtask"
                @open-template="handleOpenTemplate"
            />
        </div>

        <!-- Series template modal (opened from a recurrence instance) -->
        <TaskDetailModal
            v-if="templateTask"
            :task="templateTask"
            @close="closeTemplateModal"
            @update="(id, updates) => handleUpdateTask(id, updates)"
            @delete="(id) => handleDeleteTask(id)"
            @subtask:add="handleAddSubtask"
            @subtask:toggle="handleToggleSubtask"
            @subtask:delete="handleDeleteSubtask"
        />
    </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { parseISO } from 'date-fns';
import Header from '@/components/planner/Header.vue';
import WeeklyView from '@/components/planner/WeeklyView.vue';
import TaskDetailModal from '@/components/planner/TaskDetailModal.vue';
import { useClipboard } from '@/composables/useClipboard';
import { exportMarkdown } from '@/store/markdown';
import {
    addSubtask,
    createTask,
    deleteSubtask,
    deleteTask,
    getTask,
    setWeekStart,
    store,
    toggleTask,
    updateSubtask,
    updateTask,
} from '@/store/plannerStore';
import { addDaysLocal, formatLocal, startOfWeekLocal, todayLocal } from '@/store/dates';

const { copyText } = useClipboard();

// weekStart is a Date, derived from the persisted current_week_start (YYYY-MM-DD).
const weekStart = computed(() => {
    const stored = store.data?.settings.current_week_start;
    return parseISO(stored || startOfWeekLocal(todayLocal()));
});

const tasks = computed(() => store.data?.tasks ?? []);

const templateTask = ref(null);

function navigateWeek(direction) {
    const next = addDaysLocal(formatLocal(weekStart.value), direction * 7);
    setWeekStart(next);
}

function handleAddTask(date, title, somedayColumn) {
    if (!title || !title.trim()) return;
    createTask({
        title: title.trim(),
        date: date ? formatLocal(date) : null,
        someday_column: date ? undefined : (somedayColumn ?? 0),
    });
}

function handleToggleTask(id) {
    toggleTask(id);
}

function handleUpdateTask(id, updates) {
    if (!updates || Object.keys(updates).length === 0) return;
    updateTask(id, updates);
}

function handleDeleteTask(id) {
    if (!confirm('Delete this task?')) return;
    deleteTask(id);
    if (templateTask.value?.id === id) templateTask.value = null;
}

function handleAddSubtask(taskId, subtask) {
    if (!subtask?.title?.trim()) return;
    addSubtask(taskId, { title: subtask.title.trim() });
}

function handleToggleSubtask(taskId, subtaskId, updates) {
    if (!updates || Object.keys(updates).length === 0) return;
    updateSubtask(taskId, subtaskId, updates);
}

function handleDeleteSubtask(taskId, subtaskId) {
    if (!confirm('Delete this sub-task?')) return;
    deleteSubtask(taskId, subtaskId);
}

function handleOpenTemplate(templateId) {
    const t = getTask(templateId);
    templateTask.value = t ? { ...t } : null;
}

function closeTemplateModal() {
    templateTask.value = null;
}

async function handleCopyMarkdown() {
    const week = formatLocal(weekStart.value);
    const markdown = exportMarkdown(week, store.data);
    await copyText(markdown);
}
</script>
