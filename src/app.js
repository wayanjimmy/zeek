import { createApp } from 'vue';
import router from '@/router/index.js';
import { bootAgentApi, installAgentApi } from '@/store/agentApi.js';
import App from '@/App.vue';
import './css/app.css';

// Local-first planner: all state lives in the browser. Boot the validated
// store first so the agent API and pages see loaded data on mount.
bootAgentApi();
installAgentApi();

createApp(App).use(router).mount('#app');
