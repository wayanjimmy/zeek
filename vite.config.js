import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import vueDevTools from 'vite-plugin-vue-devtools';
import { fileURLToPath, URL } from 'node:url';

// Pure static client build. No server, no backend. The output in `dist/` can
// be hosted on any static file server (or opened directly via file://).
export default defineConfig(({ command }) => ({
    base: './',
    plugins: [
        command === 'serve' &&
            vueDevTools({
                appendTo: 'src/app.js',
                componentInspector: true,
            }),
        vue(),
        tailwindcss(),
    ].filter(Boolean),
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
}));
