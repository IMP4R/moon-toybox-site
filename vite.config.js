import {defineConfig} from 'vite';
export default defineConfig({base:'/moon-toybox-site/',build:{outDir:'docs',rollupOptions:{input:['index.html','toybox.html','lab.html']}}});
