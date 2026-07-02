import { format, addDays, startOfWeek, isToday as isTodayFns } from 'date-fns'

export const getWeekStart = (date) => startOfWeek(date)

export const addDaysHelper = (date, days) => addDays(date, days)

export const isToday = (date) => isTodayFns(date)

export const formatDate = (date, formatStr = 'MMM d') => format(date, formatStr)

export const formatDateFull = (date) => format(date, 'yyyy-MM-dd')

export const toDateKey = (value) => {
    if (!value) return null
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value
    }
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return null
    const pad = (n) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
