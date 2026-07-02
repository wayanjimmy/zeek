<template>
    <RouterView />
</template>

<script setup>
import { onMounted } from 'vue';
import { initStore } from '@/store/plannerStore';

// Ensure the store is loaded before rendering (bootAgentApi already calls
// initStore, but this is a safe no-op if already loaded and keeps the root
// component self-sufficient if app.js wiring changes).
onMounted(() => initStore());
</script>
