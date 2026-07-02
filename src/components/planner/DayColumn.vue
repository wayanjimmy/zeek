<template>
    <div class="flex flex-col min-w-0 bg-white pb-4 h-full" :class="{ 'flex-1': !compact }">
        <!-- Day header -->
        <div
            class="flex items-baseline gap-2"
            :class="[
                compact ? 'py-3 px-3' : 'pt-6 pb-2 px-4',
                isToday(date) ? '' : 'bg-white'
            ]"
        >
            <span
                class="font-bold tracking-tight"
                :class="[
                    isToday(date) ? 'text-indigo-600' : 'text-gray-900',
                    compact ? 'text-xl' : 'text-3xl'
                ]"
            >
                {{ dayNum }}
            </span>
            <span
                class="font-medium uppercase tracking-wider"
                :class="[
                    isToday(date) ? 'text-indigo-400' : 'text-gray-400',
                    compact ? 'text-xs' : 'text-sm'
                ]"
            >
                {{ dayName }}
            </span>
            <div v-if="isToday(date)" class="w-1.5 h-1.5 rounded-full bg-indigo-600 self-center ml-auto" />
        </div>

        <!-- Tasks list -->
        <div 
            class="flex-1 overflow-y-auto day-lines"
            :class="compact ? 'px-2' : 'px-4'"
            :style="{ '--line-height': compact ? '28px' : '34px' }"
        >
            <TaskCard
                v-for="task in tasksForDay"
                :key="task.id"
                :task="task"
                @toggle="(id) => $emit('toggle-task', id)"
                @update="(id, updates) => $emit('update-task', id, updates)"
                @delete="(id) => $emit('delete-task', id)"
                @subtask:add="(taskId, subtask) => $emit('add-subtask', taskId, subtask)"
                @subtask:toggle="(taskId, subtaskId, updates) => $emit('toggle-subtask', taskId, subtaskId, updates)"
                @subtask:delete="(taskId, subtaskId) => $emit('delete-subtask', taskId, subtaskId)"
                @open-template="(templateId) => $emit('open-template', templateId)"
            />
            
            <!-- Inline task input -->
            <InlineTaskInput :date="date" @add-task="(date, title) => $emit('add-task', date, title)" />
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
        transparent 0,
        transparent calc(var(--line-height) - 1px),
        #e5e7eb calc(var(--line-height) - 1px),
        #e5e7eb var(--line-height)
    );
}
</style>

<script setup>
import { computed } from 'vue'
import { format } from 'date-fns'
import { isToday, toDateKey } from '@/utils/dateHelpers'
import TaskCard from './TaskCard.vue'
import InlineTaskInput from './InlineTaskInput.vue'

const props = defineProps({
    date: {
        type: [String, Date],
        required: true,
    },
    tasks: {
        type: Array,
        required: true,
    },
    compact: Boolean,
})

defineEmits(['add-task', 'toggle-task', 'update-task', 'delete-task', 'add-subtask', 'toggle-subtask', 'delete-subtask', 'open-template'])

const dayName = computed(() => format(props.date, 'EEE'))
const dayNum = computed(() => format(props.date, 'd'))

const tasksForDay = computed(() => {
    const dateStr = toDateKey(props.date)
    return props.tasks.filter(t => toDateKey(t.date) === dateStr)
})
</script>
