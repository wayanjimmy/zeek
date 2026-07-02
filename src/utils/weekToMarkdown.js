import { format, addDays } from 'date-fns'
import { toDateKey } from '@/utils/dateHelpers'

export function weekToMarkdown(weekStart, tasks, options = {}) {
    const {
        includeSubtasks = false,
        includeSomeday = false,
        includeNotes = false,
    } = options

    const lines = []
    const weekStartDate = weekStart instanceof Date ? weekStart : new Date(weekStart)
    
    lines.push(`# Week of ${format(weekStartDate, 'yyyy-MM-dd')}`)
    lines.push('')

    for (let i = 0; i < 7; i++) {
        const day = addDays(weekStartDate, i)
        const dayKey = format(day, 'yyyy-MM-dd')
        const dayTasks = tasks.filter(t => toDateKey(t.date) === dayKey && t.someday_column === null)

        if (dayTasks.length === 0) continue

        lines.push(`## ${format(day, 'EEE d MMM')}`)
        
        for (const task of dayTasks) {
            renderTask(lines, task, includeSubtasks, includeNotes)
        }
        
        lines.push('')
    }

    if (includeSomeday) {
        const somedayTasks = tasks.filter(t => t.someday_column !== null)
        
        if (somedayTasks.length > 0) {
            lines.push('## Someday')
            
            for (const task of somedayTasks) {
                renderTask(lines, task, includeSubtasks, includeNotes)
            }
            
            lines.push('')
        }
    }

    return lines.join('\n').trim()
}

function renderTask(lines, task, includeSubtasks, includeNotes) {
    const checkbox = task.completed ? '[x]' : '[ ]'
    lines.push(`- ${checkbox} ${task.title}`)
    
    if (includeNotes && task.notes) {
        const noteLines = task.notes.split('\n')
        for (const noteLine of noteLines) {
            lines.push(`  > ${noteLine}`)
        }
    }
    
    if (includeSubtasks && task.subtasks && task.subtasks.length > 0) {
        for (const subtask of task.subtasks) {
            const subCheckbox = subtask.completed ? '[x]' : '[ ]'
            lines.push(`  - ${subCheckbox} ${subtask.title}`)
        }
    }
}
