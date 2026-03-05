import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://benediktweishaupt.github.io',
  base: '/telegram-microblogging-bot',
  output: 'static',

  vite: {
    plugins: [tailwindcss()],
  },
});