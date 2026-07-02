<template>
    <div>
        <div
            class="task-row flex items-center gap-3 group cursor-pointer relative transition-all duration-200 px-4"
            :class="{ 
                'rounded-full': task.color,
                'rounded-md': !task.color 
            }"
            :style="{ 
                backgroundColor: task.color || 'transparent',
                height: task.color ? 'calc(var(--line-height) - 8px)' : 'var(--line-height)',
                marginBlock: task.color ? '4px' : '0'
            }"
            @click="openModal"
        >
            <!-- Custom minimalistic checkbox/indicator -->
            <div 
                class="flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-200"
                :class="{
                    'bg-black border-black': task.completed && task.color,
                    'bg-indigo-500 border-indigo-500': task.completed && !task.color,
                    'border-gray-300 group-hover:border-indigo-400 opacity-0 group-hover:opacity-100': !task.completed && !task.color,
                    'bg-white/50 border-gray-400 group-hover:border-gray-600 opacity-100': !task.completed && task.color
                }"
                @click.stop="toggleCompletion"
            >
                <svg v-if="task.completed" class="w-2.5 h-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            </div>

            <div class="flex-1 min-w-0 pt-0.5">
                <p
                    :class="{
                        'line-through text-gray-300': task.completed && !task.color,
                        'line-through text-black': task.completed && task.color,
                        'text-gray-900': !task.completed,
                    }"
                    class="text-sm truncate font-medium"
                >
                    {{ task.title }}
                </p>
            </div>
        </div>

        <TaskDetailModal
            v-if="modalOpen"
            :task="task"
            @close="closeModal"
            @toggle="emit('toggle')"
            @update="(id, updates) => emit('update', id, updates)"
            @delete="(id) => emit('delete', id)"
            @subtask:add="(taskId, subtask) => emit('subtask:add', taskId, subtask)"
            @subtask:toggle="(taskId, subtaskId, updates) => emit('subtask:toggle', taskId, subtaskId, updates)"
            @subtask:delete="(taskId, subtaskId) => emit('subtask:delete', taskId, subtaskId)"
            @open-template="(templateId) => emit('open-template', templateId)"
        />
    </div>
</template>

<style scoped>
.task-row {
    /* Exact match to line height */
    height: var(--line-height);
    box-sizing: border-box;
    /* No border bottom - the day column background provides the lines */
    background-color: transparent;
}
</style>

<script setup>
import { ref } from 'vue'
import TaskDetailModal from './TaskDetailModal.vue'

const props = defineProps({
    task: {
        type: Object,
        required: true,
    },
})

const emit = defineEmits(['toggle', 'update', 'delete', 'subtask:add', 'subtask:toggle', 'subtask:delete', 'open-template'])

const modalOpen = ref(false)

const openModal = () => {
    modalOpen.value = true
}

const closeModal = () => {
    modalOpen.value = false
}

const toggleCompletion = () => {
    emit('toggle', props.task.id)
}
</script>
