import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative assets make the same build work on a project Pages URL,
  // a custom domain, and a downloaded static folder.
  base: './',
  plugins: [react()],
});
