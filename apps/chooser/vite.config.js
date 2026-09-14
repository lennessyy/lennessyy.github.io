import { defineConfig } from 'vite';

export default defineConfig({
  base: '/chooser/',
  build: {
    outDir: '../../public/chooser',
    emptyOutDir: true
  }
});
