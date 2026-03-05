import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://benediktweishaupt.github.io',
  base: '/elternzeitreise-blog',
  output: 'static',

  vite: {
    plugins: [tailwindcss()],
  },
});