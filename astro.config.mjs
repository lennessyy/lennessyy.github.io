// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import tailwindcss from '@tailwindcss/vite';
import remarkFigureCaption from 'remark-figure-caption';
import rehypeNarrativeBreaks from './src/plugins/rehype-narrative-breaks.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://lennyc.me',
  output: 'static',
  integrations: [sitemap()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkFigureCaption],
      rehypePlugins: [rehypeNarrativeBreaks],
    }),
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
