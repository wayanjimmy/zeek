<template>
    <div class="flex md:flex-row flex-col h-full overflow-hidden md:overflow-hidden" :class="{ 'flex-col overflow-y-auto': stacked }">
        <!-- Column 1 -->
        <div class="flex flex-col min-w-0 flex-1 bg-white">
            <div class="flex items-center gap-2 py-4 px-4 bg-white">
                <span class="font-bold text-base text-gray-900">Someday</span>
                <span v-if="tasks.length" class="text-sm text-gray-400">({{ tasks.length }})</span>
            </div>
            <div class="flex-1 overflow-y-auto px-4 day-lines" :style="{ '--line-height': '32px' }">
                <TaskCard
                    v-for="task in columns[0]"
                    :key="task.id"
                    :task="task"
                    @toggle="() => $emit('toggle-task', task.id)"
                    @update="(id, updates) => $emit('update-task', id, updates)"
                    @delete="() => $emit('delete-task', task.id)"
                    @subtask:add="(taskId, subtask) => $emit('add-subtask', taskId, subtask)"
                    @subtask:toggle="(taskId, subtaskId, updates) => $emit('toggle-subtask', taskId, subtaskId, updates)"
                    @subtask:delete="(taskId, subtaskId) => $emit('delete-subtask', taskId, subtaskId)"
                    @open-template="(templateId) => $emit('open-template', templateId)"
                />
                <InlineTaskInput @add-task="(_, title) => $emit('add-task', null, title, 0)" />
            </div>
        </div>

        <!-- Column 2 -->
        <div class="flex flex-col min-w-0 flex-1 bg-white">
            <div class="flex items-center gap-2 py-4 px-4 bg-white">
                <span class="font-bold text-base text-gray-900">&nbsp;</span>
            </div>
            <div class="flex-1 overflow-y-auto px-4 day-lines" :style="{ '--line-height': '32px' }">
                <TaskCard
                    v-for="task in columns[1]"
                    :key="task.id"
                    :task="task"
                    @toggle="() => $emit('toggle-task', task.id)"
                    @update="(id, updates) => $emit('update-task', id, updates)"
                    @delete="() => $emit('delete-task', task.id)"
                    @subtask:add="(taskId, subtask) => $emit('add-subtask', taskId, subtask)"
                    @subtask:toggle="(taskId, subtaskId, updates) => $emit('toggle-subtask', taskId, subtaskId, updates)"
                    @subtask:delete="(taskId, subtaskId) => $emit('delete-subtask', taskId, subtaskId)"
                    @open-template="(templateId) => $emit('open-template', templateId)"
                />
                <InlineTaskInput @add-task="(_, title) => $emit('add-task', null, title, 1)" />
            </div>
        </div>

        <!-- Column 3 -->
        <div class="flex flex-col min-w-0 flex-1 bg-white">
            <div class="flex items-center gap-2 py-4 px-4 bg-white">
                <span class="font-bold text-base text-gray-900">&nbsp;</span>
            </div>
            <div class="flex-1 overflow-y-auto px-4 day-lines" :style="{ '--line-height': '32px' }">
                <TaskCard
                    v-for="task in columns[2]"
                    :key="task.id"
                    :task="task"
                    @toggle="() => $emit('toggle-task', task.id)"
                    @update="(id, updates) => $emit('update-task', id, updates)"
                    @delete="() => $emit('delete-task', task.id)"
                    @subtask:add="(taskId, subtask) => $emit('add-subtask', taskId, subtask)"
                    @subtask:toggle="(taskId, subtaskId, updates) => $emit('toggle-subtask', taskId, subtaskId, updates)"
                    @subtask:delete="(taskId, subtaskId) => $emit('delete-subtask', taskId, subtaskId)"
                    @open-template="(templateId) => $emit('open-template', templateId)"
                />
                <InlineTaskInput @add-task="(_, title) => $emit('add-task', null, title, 2)" />
            </div>
        </div>
    </div>
</template>

<style scoped>
.day-lines {
    /* "Notebook paper" background */
    position: relative;
    /* Tailwind already gives padding; ensure lines respect padding: */
    background-clip: content-box;

    /* Light gray lines every var(--line-height) px */
    background-image: repeating-linear-gradient(
        to bottom,
        #e5e7eb 0,
        #e5e7eb 1px,
        transparent 1px,
        transparent var(--line-height)
    );
}
</style>

<script setup>
import { computed } from 'vue'
import TaskCard from './TaskCard.vue'
import InlineTaskInput from './InlineTaskInput.vue'

const props = defineProps({
    tasks: {
        type: Array,
        required: true,
    },
    stacked: {
        type: Boolean,
        default: false,
    },
})

defineEmits([
    'add-task',
    'toggle-task',
    'update-task',
    'delete-task',
    'add-subtask',
    'toggle-subtask',
    'delete-subtask',
    'open-template',
])

const columns = computed(() => {
    const cols = [[], [], []]

    props.tasks.forEach((task, index) => {
        // Prefer explicit column, fall back to old behavior
        let colIndex =
            task.someday_column !== undefined && task.someday_column !== null
                ? task.someday_column
                : index % 3

        // Guard against bad data
        if (colIndex < 0 || colIndex > 2) colIndex = index % 3

        cols[colIndex].push(task)
    })

    return cols
})
</script>
