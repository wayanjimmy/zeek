<template>
    <div v-if="isOpen" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="close">
        <div class="bg-white rounded-lg shadow-lg max-w-md w-full">
            <!-- Header -->
            <div class="flex items-start justify-between p-6 border-b border-gray-200">
                <div class="flex-1">
                    <input
                        v-model="title"
                        type="text"
                        @blur="updateTask"
                        class="text-lg font-semibold w-full bg-transparent border-none outline-none text-gray-900"
                    />
                    <div class="relative">
                        <button
                            class="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors mt-2"
                            @click="datePickerOpen = !datePickerOpen"
                        >
                            <Icon name="calendar" :size="16" aria-label="Task date" />
                            {{ formattedDate }}
                        </button>
                        
                        <!-- Date Picker -->
                        <div v-if="datePickerOpen" class="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4">
                            <!-- Quick pick: current week -->
                            <div class="mb-4 pb-3 border-b border-gray-100">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-xs text-gray-500">This week</span>
                                    <button
                                        v-if="props.task.date"
                                        @click="clearDate"
                                        class="text-xs text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        Clear date
                                    </button>
                                </div>
                                <div class="flex gap-1">
                                    <button
                                        v-for="day in weekDays"
                                        :key="day.dateStr"
                                        @click="selectDate(day.date)"
                                        class="flex-1 px-1 py-1.5 text-xs rounded hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-center"
                                        :class="{ 'bg-indigo-100 text-indigo-700': props.task.date && format(localDate(props.task.date), 'yyyy-MM-dd') === day.dateStr }"
                                    >
                                        <div class="font-medium">{{ day.label }}</div>
                                        <div class="text-gray-400">{{ day.dayNum }}</div>
                                    </button>
                                </div>
                            </div>
                            
                            <div class="flex items-center justify-between mb-4">
                                 <button
                                     @click="previousMonth"
                                     class="p-1 hover:bg-gray-100 rounded"
                                     aria-label="Previous month"
                                 >
                                     <Icon name="chevron-left" :size="16" />
                                 </button>
                                 <span class="text-sm font-semibold">{{ formatMonthYear }}</span>
                                 <button
                                     @click="nextMonth"
                                     class="p-1 hover:bg-gray-100 rounded"
                                     aria-label="Next month"
                                 >
                                     <Icon name="chevron-right" :size="16" />
                                 </button>
                             </div>
                            
                            <div class="grid grid-cols-7 gap-1 mb-2">
                                <div v-for="day in ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']" :key="day" class="text-xs font-semibold text-gray-500 text-center w-8">
                                    {{ day }}
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-7 gap-1">
                                <button
                                    v-for="day in calendarDays"
                                    :key="day.dateStr"
                                    @click="selectDate(day.date)"
                                    :class="{
                                        'bg-indigo-600 text-white': day.isSelected,
                                        'text-gray-400': day.isOtherMonth,
                                        'hover:bg-gray-100': !day.isOtherMonth && !day.isSelected,
                                        'bg-gray-50': day.isOtherMonth,
                                    }"
                                    class="w-8 h-8 rounded text-xs text-center flex items-center justify-center hover:transition-colors"
                                >
                                    {{ day.dayNum }}
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Recurrence badge -->
                    <div v-if="isRecurrenceInstance" class="mt-2 flex items-center gap-2">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs">
                            <Icon name="repeat" :size="12" />
                            Part of a recurring series
                        </span>
                        <button
                            class="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline"
                            @click="openSeriesTemplate"
                        >
                            Edit series
                        </button>
                    </div>
                    <div v-else-if="isRecurrenceTemplate" class="mt-2 flex items-center gap-1 text-xs text-gray-500">
                        <Icon name="repeat" :size="12" />
                        <span>Series template</span>
                    </div>
                </div>
                <button
                    @click="deleteTask"
                    class="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                    title="Delete task"
                    aria-label="Delete task"
                >
                    <Icon name="trash" :size="20" />
                </button>
            </div>

            <!-- Content -->
            <div class="p-6 space-y-4">
                <!-- Notes -->
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">Notes</label>
                    <textarea
                        v-model="notes"
                        @blur="updateTask"
                        placeholder="Add notes..."
                        class="w-full min-h-[100px] p-2 border border-gray-200 rounded text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>

                <!-- Sub-tasks -->
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">Sub-tasks</label>
                    <div class="space-y-2 mb-3">
                        <div
                            v-for="subtask in subtasks"
                            :key="subtask.id"
                            class="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                        >
                            <input
                                type="checkbox"
                                :checked="subtask.completed"
                                @change="toggleSubtask(subtask.id)"
                                class="w-4 h-4 rounded cursor-pointer"
                            />
                            <template v-if="editingSubtaskId === subtask.id">
                                <input
                                    v-model="editingSubtaskTitle"
                                    type="text"
                                    @keyup.enter="saveSubtask(subtask.id)"
                                    @keyup.escape="cancelEdit"
                                    autofocus
                                    class="flex-1 px-2 py-1 border border-indigo-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <button
                                    @click="saveSubtask(subtask.id)"
                                    class="text-green-600 hover:text-green-700 transition-colors text-sm font-medium"
                                    aria-label="Save subtask"
                                >
                                    <Icon name="check" :size="16" />
                                </button>
                                <button
                                    @click="cancelEdit"
                                    class="text-gray-400 hover:text-gray-600 transition-colors text-sm font-medium"
                                    aria-label="Cancel edit"
                                >
                                    <Icon name="x" :size="16" />
                                </button>
                            </template>
                            <template v-else>
                                <span
                                    :class="[
                                        'flex-1 text-sm cursor-pointer hover:underline',
                                        subtask.completed ? 'line-through text-gray-400' : 'text-gray-900'
                                    ]"
                                    @click="startEdit(subtask.id, subtask.title)"
                                >
                                    {{ subtask.title }}
                                </span>
                                <button
                                    @click="startEdit(subtask.id, subtask.title)"
                                    class="text-gray-400 hover:text-blue-600 transition-colors text-sm"
                                    title="Edit"
                                    aria-label="Edit subtask"
                                >
                                    <Icon name="edit" :size="16" />
                                </button>
                                <button
                                    @click="deleteSubtask(subtask.id)"
                                    class="text-gray-400 hover:text-red-600 transition-colors text-sm"
                                    title="Delete"
                                    aria-label="Delete subtask"
                                >
                                    <Icon name="x" :size="16" />
                                </button>
                            </template>
                        </div>
                    </div>

                    <div class="flex gap-2">
                        <input
                            v-model="newSubtaskTitle"
                            type="text"
                            placeholder="Add a sub-task..."
                            @keyup.enter="addSubtask"
                            class="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                            @click="addSubtask"
                            class="px-3 py-1 bg-indigo-500 text-white rounded text-sm hover:bg-indigo-600 transition-colors font-medium"
                        >
                            Add
                        </button>
                    </div>
                </div>

                <!-- Repeat / Recurrence -->
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">Repeat</label>
                    
                    <!-- Instance view: read-only explanation -->
                    <template v-if="isRecurrenceInstance">
                        <p class="text-xs text-gray-600">
                            This task is part of a recurring series. Changes here only affect
                            <strong>this occurrence</strong>.
                        </p>
                        <button
                            class="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 underline"
                            @click="openSeriesTemplate"
                        >
                            <Icon name="edit" :size="12" />
                            Edit the whole series
                        </button>
                    </template>
                    
                    <!-- Template view: full controls -->
                    <template v-else>
                        <div class="flex flex-wrap gap-2">
                            <button
                                v-for="option in recurrenceOptions"
                                :key="option.value"
                                @click="updateRecurrence(option.value)"
                                class="px-3 py-1.5 text-xs rounded-full border transition-all"
                                :class="currentRecurrenceType === option.value 
                                    ? 'bg-indigo-100 border-indigo-300 text-indigo-700' 
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'"
                            >
                                {{ option.label }}
                            </button>
                        </div>
                        <div v-if="currentRecurrenceType !== 'none'" class="mt-3 flex items-center gap-2 text-sm text-gray-600">
                            <span>Every</span>
                            <input
                                type="number"
                                min="1"
                                :value="currentRecurrenceInterval"
                                @change="updateRecurrenceInterval($event.target.value)"
                                class="w-14 px-2 py-1 border border-gray-200 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <span>{{ intervalLabel }}</span>
                        </div>
                        <p v-if="isRecurrenceTemplate" class="mt-2 text-xs text-gray-500">
                            Changes here affect all <strong>future</strong> occurrences in this series.
                        </p>
                    </template>
                </div>

                <!-- Color Picker -->
                <div>
                    <label class="text-sm text-gray-600 mb-2 block">Color</label>
                    <div class="flex gap-3">
                        <button
                            v-for="color in [null, '#fdef5d', '#21ffa1', '#cd2c54']"
                            :key="color || 'default'"
                            @click="updateColor(color)"
                            class="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
                            :class="[
                                color === (props.task.color || null) ? 'border-gray-900 shadow-sm' : (color ? 'border-transparent hover:border-gray-200' : 'border-gray-200 hover:border-gray-300'),
                                !color ? 'bg-white' : ''
                            ]"
                            :style="{ backgroundColor: color || 'white' }"
                            :title="color || 'Default'"
                        >
                            <!-- No icon for default/no color -->
                            <Icon v-if="color === (props.task.color || null)" name="check" :size="14" :class="color ? 'text-gray-900/50' : 'text-gray-900'" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="flex gap-2 p-6 border-t border-gray-200">
                <button
                    @click="close"
                    class="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded hover:bg-gray-200 transition-colors font-medium"
                >
                    Close
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { format, getDaysInMonth, startOfMonth, getDay, addMonths, subMonths, addDays, startOfWeek } from 'date-fns'
import Icon from '../Icon.vue'

// Parse a YYYY-MM-DD planner date as local midnight (avoids the UTC/off-by-one
// drift you get from `new Date('YYYY-MM-DD')`, which date-fns/JS treat as UTC).
function localDate(value) {
    return new Date(`${value}T00:00:00`)
}

const props = defineProps({
    task: {
        type: Object,
        required: true,
    },
})

const emit = defineEmits(['close', 'toggle', 'update', 'delete', 'subtask:add', 'subtask:toggle', 'subtask:delete', 'open-template'])

const isOpen = ref(true)
const title = ref(props.task.title)
const notes = ref(props.task.notes || '')
const datePickerOpen = ref(false)
const subtasks = ref(props.task.subtasks || [])
const newSubtaskTitle = ref('')
const editingSubtaskId = ref(null)
const editingSubtaskTitle = ref('')
const currentWeekStart = computed(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
const pickerMonth = ref(props.task.date ? localDate(props.task.date) : new Date())

const recurrenceOptions = [
    { value: 'none', label: 'Never' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
]

const currentRecurrenceType = computed(() => props.task.recurrence_type || 'none')
const currentRecurrenceInterval = computed(() => props.task.recurrence_interval || 1)
const isRecurrenceInstance = computed(() => !!props.task.recurrence_parent_id)
const isRecurrenceTemplate = computed(() => currentRecurrenceType.value !== 'none' && !props.task.recurrence_parent_id)

const intervalLabel = computed(() => {
    const interval = currentRecurrenceInterval.value
    switch (currentRecurrenceType.value) {
        case 'daily': return interval === 1 ? 'day' : 'days'
        case 'weekly': return interval === 1 ? 'week' : 'weeks'
        case 'monthly': return interval === 1 ? 'month' : 'months'
        case 'yearly': return interval === 1 ? 'year' : 'years'
        default: return ''
    }
})

const weekDays = computed(() => {
    return Array.from({ length: 7 }, (_, i) => {
        const date = addDays(currentWeekStart.value, i)
        return {
            date,
            label: format(date, 'EEE'),
            dayNum: format(date, 'd'),
            dateStr: format(date, 'yyyy-MM-dd'),
        }
    })
})

const formattedDate = computed(() => {
    if (!props.task.date) {
        return 'No date'
    }
    const taskDate = localDate(props.task.date)
    return format(taskDate, 'EEE, MMM d')
})

const formatMonthYear = computed(() => {
    return format(pickerMonth.value, 'MMMM yyyy')
})

const calendarDays = computed(() => {
    const year = pickerMonth.value.getFullYear()
    const month = pickerMonth.value.getMonth()
    const daysInMonth = getDaysInMonth(new Date(year, month))
    const firstDay = getDay(startOfMonth(new Date(year, month)))
    
    const days = []
    const taskDateStr = props.task.date ? format(localDate(props.task.date), 'yyyy-MM-dd') : null
    
    // Previous month's days
    for (let i = firstDay - 1; i >= 0; i--) {
        const date = new Date(year, month, -i)
        days.push({
            date,
            dayNum: date.getDate(),
            dateStr: format(date, 'yyyy-MM-dd'),
            isOtherMonth: true,
            isSelected: false,
        })
    }
    
    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i)
        const dateStr = format(date, 'yyyy-MM-dd')
        days.push({
            date,
            dayNum: i,
            dateStr,
            isOtherMonth: false,
            isSelected: dateStr === taskDateStr,
        })
    }
    
    // Next month's days
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
        const date = new Date(year, month + 1, i)
        days.push({
            date,
            dayNum: date.getDate(),
            dateStr: format(date, 'yyyy-MM-dd'),
            isOtherMonth: true,
            isSelected: false,
        })
    }
    
    return days
})

watch(() => props.task, (newTask) => {
    title.value = newTask.title
    notes.value = newTask.notes || ''
    subtasks.value = newTask.subtasks || []
}, { deep: true })

const updateTask = () => {
    const updates = {}
    if (title.value.trim() !== props.task.title) {
        updates.title = title.value.trim()
    }
    if (notes.value !== (props.task.notes || '')) {
        updates.notes = notes.value
    }
    if (Object.keys(updates).length > 0) {
        emit('update', props.task.id, updates)
    }
}

const deleteTask = () => {
    emit('delete', props.task.id)
    close()
}

const addSubtask = () => {
    if (newSubtaskTitle.value.trim()) {
        emit('subtask:add', props.task.id, {
            title: newSubtaskTitle.value.trim(),
            completed: false,
        })
        newSubtaskTitle.value = ''
    }
}

const toggleSubtask = (subtaskId) => {
    const subtask = subtasks.value.find(st => st.id === subtaskId)
    if (subtask) {
        emit('subtask:toggle', props.task.id, subtaskId, { completed: !subtask.completed })
    }
}

const deleteSubtask = (subtaskId) => {
    emit('subtask:delete', props.task.id, subtaskId)
}

const startEdit = (subtaskId, title) => {
    editingSubtaskId.value = subtaskId
    editingSubtaskTitle.value = title
}

const saveSubtask = (subtaskId) => {
    if (editingSubtaskTitle.value.trim()) {
        emit('subtask:toggle', props.task.id, subtaskId, {
            title: editingSubtaskTitle.value.trim(),
        })
        editingSubtaskId.value = null
        editingSubtaskTitle.value = ''
    }
}

const cancelEdit = () => {
    editingSubtaskId.value = null
    editingSubtaskTitle.value = ''
}

const previousMonth = () => {
    pickerMonth.value = subMonths(pickerMonth.value, 1)
}

const nextMonth = () => {
    pickerMonth.value = addMonths(pickerMonth.value, 1)
}

const selectDate = (date) => {
    const newDateStr = format(date, 'yyyy-MM-dd')
    const oldDateStr = props.task.date
    
    if (newDateStr !== oldDateStr) {
        emit('update', props.task.id, { date: newDateStr })
    }
    
    datePickerOpen.value = false
}

const clearDate = () => {
    emit('update', props.task.id, { date: null })
    datePickerOpen.value = false
}

const updateColor = (color) => {
    const currentColor = props.task.color || null
    const newColor = color || null
    
    if (currentColor !== newColor) {
        emit('update', props.task.id, { color: newColor })
    }
}

const updateRecurrence = (type) => {
    if (isRecurrenceInstance.value) return

    if (type !== currentRecurrenceType.value) {
        emit('update', props.task.id, { 
            recurrence_type: type,
            recurrence_interval: type === 'none' ? 1 : currentRecurrenceInterval.value
        })
    }
}

const updateRecurrenceInterval = (value) => {
    if (isRecurrenceInstance.value) return

    const interval = Math.max(1, parseInt(value) || 1)
    if (interval !== currentRecurrenceInterval.value) {
        emit('update', props.task.id, { recurrence_interval: interval })
    }
}

const openSeriesTemplate = () => {
    if (!props.task.recurrence_parent_id) return
    emit('open-template', props.task.recurrence_parent_id)
    close()
}

const close = () => {
    isOpen.value = false
    emit('close')
}
</script>
