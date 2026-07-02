<template>
    <div class="bg-white px-6 py-4">
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">{{ monthYear }}</h1>
            </div>

            <div class="flex items-center gap-4">
                <RouterLink
                    to="/data"
                    class="p-2 hover:bg-gray-100 rounded-lg transition text-gray-700"
                    title="Data & backups"
                    aria-label="Open data and backups page"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7M4 7l4-4h8l4 4M4 7h16M9 11h6M9 15h6"
                        />
                    </svg>
                </RouterLink>

                <div class="relative">
                    <button
                        @click="showCopyPopover = !showCopyPopover"
                        class="p-2 hover:bg-gray-100 rounded-lg transition"
                        title="Copy week to clipboard"
                        aria-label="Copy week to clipboard as markdown"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                            />
                        </svg>
                    </button>

                    <div
                        v-if="showCopyPopover"
                        class="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-4"
                    >
                        <div class="space-y-3">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    v-model="copyOptions.include_subtasks"
                                    class="rounded border-gray-300"
                                />
                                <span class="text-sm text-gray-700">Include subtasks</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    v-model="copyOptions.include_someday"
                                    class="rounded border-gray-300"
                                />
                                <span class="text-sm text-gray-700">Include someday tasks</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    v-model="copyOptions.include_notes"
                                    class="rounded border-gray-300"
                                />
                                <span class="text-sm text-gray-700">Include notes</span>
                            </label>
                            <button
                                @click="handleCopy"
                                class="w-full mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
                            >
                                Copy
                            </button>
                        </div>
                    </div>
                </div>

                <button
                    @click="$emit('prev')"
                    class="p-2 hover:bg-gray-100 rounded-lg transition"
                    aria-label="Previous week"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15 19l-7-7 7-7"
                        />
                    </svg>
                </button>
                <button
                    @click="$emit('next')"
                    class="p-2 hover:bg-gray-100 rounded-lg transition"
                    aria-label="Next week"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 5l7 7-7 7"
                        />
                    </svg>
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { format } from 'date-fns';
import { getMarkdownOptions, setMarkdownOptions } from '@/store/plannerStore';

const props = defineProps({ weekStart: [Date, String] });
const emit = defineEmits(['prev', 'next', 'copy-markdown']);

const showCopyPopover = ref(false);
const copyOptions = reactive({ ...getMarkdownOptions() });

watch(copyOptions, (next) => setMarkdownOptions(next), { deep: true });

const handleCopy = () => {
    emit('copy-markdown', { ...copyOptions });
    showCopyPopover.value = false;
};

const monthYear = computed(() => format(props.weekStart, 'MMMM yyyy'));
</script>
