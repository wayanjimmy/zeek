<template>
  <component
    v-if="iconComponent"
    :is="iconComponent"
    :size="`${size}`"
    :stroke-width="strokeWidth"
    :aria-label="ariaLabel"
  />
  <span v-else>Icon not found: {{ name }}</span>
</template>

<script setup>
import { computed } from 'vue'
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Trash2Icon,
  CheckIcon,
  XIcon,
  Edit2Icon,
  RepeatIcon,
} from '@zhuowenli/vue-feather-icons'

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
  size: {
    type: [Number, String],
    default: 16,
  },
  strokeWidth: {
    type: Number,
    default: 2,
  },
  ariaLabel: {
    type: String,
    default: '',
  },
})

const iconMap = {
  calendar: CalendarIcon,
  'chevron-left': ChevronLeftIcon,
  'chevron-right': ChevronRightIcon,
  trash: Trash2Icon,
  check: CheckIcon,
  x: XIcon,
  edit: Edit2Icon,
  repeat: RepeatIcon,
}

const iconComponent = computed(() => {
  const icon = iconMap[props.name]
  if (!icon) {
    console.warn(`Icon "${props.name}" not found`)
  }
  return icon
})
</script>
