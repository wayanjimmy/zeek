<template>
    <form @submit.prevent="submitTask" class="task-row px-4 flex items-center gap-3">
        <!-- Invisible placeholder to align text with task checkboxes -->
        <div class="flex-shrink-0 w-4 h-4 flex items-center justify-center opacity-40">
            <span class="text-xl leading-none text-gray-400 font-light">+</span>
        </div>
        
        <input
            ref="inputElement"
            v-model="taskTitle"
            @keydown.enter="submitTask"
            @blur="submitOnBlur"
            @input="handleInput"
            type="text"
            placeholder=""
            enterkeyhint="done"
            class="flex-1 min-w-0 h-full bg-transparent outline-none text-sm font-medium text-gray-900 placeholder-gray-400 hover:cursor-text"
        />
    </form>
</template>

<style scoped>
.task-row {
    /* Match notebook line height */
    height: var(--line-height);
    box-sizing: border-box;
    /* No border bottom same as tasks */
    background-color: transparent;
}
</style>

<script setup>
import { ref } from 'vue'

const props = defineProps({
    date: {
        type: Date,
        default: null,
    },
})

const emit = defineEmits(['add-task'])

const taskTitle = ref('')
const inputElement = ref(null)
const isDirty = ref(false)

const submitTask = () => {
    if (taskTitle.value.trim()) {
        emit('add-task', props.date, taskTitle.value)
        taskTitle.value = ''
        isDirty.value = false
    }
}

const submitOnBlur = () => {
    if (isDirty.value && taskTitle.value.trim()) {
        submitTask()
    }
}

const handleInput = () => {
    isDirty.value = true
}
</script>
