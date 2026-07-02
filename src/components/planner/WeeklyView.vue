<template>
    <div class="flex flex-col h-full">
        <div class="flex-1 min-h-0">
            <!-- Mobile view: vertical stack of days -->
            <div class="h-full md:hidden overflow-y-auto">
                <div class="flex flex-col gap-4 px-4 py-4">
                    <DayColumn
                        v-for="(date, idx) in allDays"
                        :key="idx"
                        :date="date"
                        :tasks="tasks"
                        :compact="true"
                        @add-task="(date, title) => $emit('add-task', date, title)"
                        @toggle-task="(id) => $emit('toggle-task', id)"
                        @update-task="(id, updates) => $emit('update-task', id, updates)"
                        @delete-task="(id) => $emit('delete-task', id)"
                        @add-subtask="(taskId, subtask) => $emit('add-subtask', taskId, subtask)"
                        @toggle-subtask="(taskId, subtaskId, updates) => $emit('toggle-subtask', taskId, subtaskId, updates)"
                        @delete-subtask="(taskId, subtaskId) => $emit('delete-subtask', taskId, subtaskId)"
                        @open-template="(templateId) => $emit('open-template', templateId)"
                    />
                    
                    <!-- Someday section at bottom -->
                    <div class="mt-4 pt-4 border-t-2 border-gray-300">
                        <SomedaySection
                            :tasks="unscheduledTasks"
                            :stacked="true"
                            @add-task="(date, title, colIndex) => $emit('add-task', date, title, colIndex)"
                            @toggle-task="(id) => $emit('toggle-task', id)"
                            @update-task="(id, updates) => $emit('update-task', id, updates)"
                            @delete-task="(id) => $emit('delete-task', id)"
                            @add-subtask="(taskId, subtask) => $emit('add-subtask', taskId, subtask)"
                            @toggle-subtask="(taskId, subtaskId, updates) => $emit('toggle-subtask', taskId, subtaskId, updates)"
                            @delete-subtask="(taskId, subtaskId) => $emit('delete-subtask', taskId, subtaskId)"
                            @open-template="(templateId) => $emit('open-template', templateId)"
                        />
                    </div>
                </div>
            </div>

            <!-- Desktop view -->
            <div class="hidden md:flex md:flex-col h-full overflow-hidden bg-white">
                <!-- TOP HALF: week view -->
                <div class="flex-1 min-h-0 flex overflow-hidden">
                    <!-- Weekdays: Mon-Fri -->
                    <DayColumn
                        v-for="(date, idx) in weekdays"
                        :key="idx"
                        :date="date"
                        :tasks="tasks"
                        class="flex-1"
                        @add-task="(date, title) => $emit('add-task', date, title)"
                        @toggle-task="(id) => $emit('toggle-task', id)"
                        @update-task="(id, updates) => $emit('update-task', id, updates)"
                        @delete-task="(id) => $emit('delete-task', id)"
                        @add-subtask="(taskId, subtask) => $emit('add-subtask', taskId, subtask)"
                        @toggle-subtask="(taskId, subtaskId, updates) => $emit('toggle-subtask', taskId, subtaskId, updates)"
                        @delete-subtask="(taskId, subtaskId) => $emit('delete-subtask', taskId, subtaskId)"
                        @open-template="(templateId) => $emit('open-template', templateId)"
                    />
                    
                    <!-- Weekend: Sat & Sun stacked vertically -->
                    <div class="flex-1 flex flex-col min-w-0 border-l border-transparent">
                        <div class="flex-1 flex flex-col overflow-y-auto">
                            <DayColumn
                                :date="saturday"
                                :tasks="tasks"
                                @add-task="(date, title) => $emit('add-task', date, title)"
                                @toggle-task="(id) => $emit('toggle-task', id)"
                                @update-task="(id, updates) => $emit('update-task', id, updates)"
                                @delete-task="(id) => $emit('delete-task', id)"
                                @add-subtask="(taskId, subtask) => $emit('add-subtask', taskId, subtask)"
                                @toggle-subtask="(taskId, subtaskId, updates) => $emit('toggle-subtask', taskId, subtaskId, updates)"
                                @delete-subtask="(taskId, subtaskId) => $emit('delete-subtask', taskId, subtaskId)"
                                @open-template="(templateId) => $emit('open-template', templateId)"
                            />
                        </div>
                        <div class="flex-1 flex flex-col overflow-y-auto">
                            <DayColumn
                                :date="sunday"
                                :tasks="tasks"
                                @add-task="(date, title) => $emit('add-task', date, title)"
                                @toggle-task="(id) => $emit('toggle-task', id)"
                                @update-task="(id, updates) => $emit('update-task', id, updates)"
                                @delete-task="(id) => $emit('delete-task', id)"
                                @add-subtask="(taskId, subtask) => $emit('add-subtask', taskId, subtask)"
                                @toggle-subtask="(taskId, subtaskId, updates) => $emit('toggle-subtask', taskId, subtaskId, updates)"
                                @delete-subtask="(taskId, subtaskId) => $emit('delete-subtask', taskId, subtaskId)"
                                @open-template="(templateId) => $emit('open-template', templateId)"
                            />
                        </div>
                    </div>
                </div>

                <!-- BOTTOM HALF: Someday -->
                <div class="flex-1 min-h-0 overflow-hidden px-4 md:px-0 pt-8">
                    <SomedaySection
                        :tasks="unscheduledTasks"
                        @add-task="(date, title, colIndex) => $emit('add-task', date, title, colIndex)"
                        @toggle-task="(id) => $emit('toggle-task', id)"
                        @update-task="(id, updates) => $emit('update-task', id, updates)"
                        @delete-task="(id) => $emit('delete-task', id)"
                        @add-subtask="(taskId, subtask) => $emit('add-subtask', taskId, subtask)"
                        @toggle-subtask="(taskId, subtaskId, updates) => $emit('toggle-subtask', taskId, subtaskId, updates)"
                        @delete-subtask="(taskId, subtaskId) => $emit('delete-subtask', taskId, subtaskId)"
                        @open-template="(templateId) => $emit('open-template', templateId)"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { addDays } from 'date-fns'
import DayColumn from './DayColumn.vue'
import SomedaySection from './SomedaySection.vue'

const props = defineProps({
    weekStart: {
        type: [String, Date],
        required: true,
    },
    tasks: {
        type: Array,
        required: true,
    },
})

defineEmits(['add-task', 'toggle-task', 'update-task', 'delete-task', 'add-subtask', 'toggle-subtask', 'delete-subtask', 'open-template'])

const allDays = computed(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(props.weekStart, i))
})

const weekdays = computed(() => {
    return allDays.value.slice(0, 5) // Mon-Fri
})

const saturday = computed(() => {
    return allDays.value[5]
})

const sunday = computed(() => {
    return allDays.value[6]
})

const unscheduledTasks = computed(() => {
    return props.tasks.filter(task => !task.date)
})
</script>
