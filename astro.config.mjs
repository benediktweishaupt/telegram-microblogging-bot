import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // TODO: Set these for your GitHub Pages deployment
  // site: 'https://YOUR_USERNAME.github.io',
  // base: '/YOUR_REPO_NAME',
  output: 'static',

  vite: {
    plugins: [tailwindcss()],
  },
});