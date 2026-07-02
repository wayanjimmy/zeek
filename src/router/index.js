import { createRouter, createWebHashHistory } from 'vue-router';
import PlannerPage from '@/pages/PlannerPage.vue';
import DataPage from '@/pages/DataPage.vue';

// Hash history keeps the app usable on any static host (or via file://)
// without server rewrites, while still persisting the active route in the URL.
const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        { path: '/', name: 'planner', component: PlannerPage },
        { path: '/data', name: 'data', component: DataPage },
        { path: '/:pathMatch(.*)*', redirect: '/' },
    ],
});

export default router;
