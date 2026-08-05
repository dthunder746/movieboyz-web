import { defineConfig } from 'vite';

// Relative base so the build works both at a Pages project path and under the
// custom domain after cutover (DNS untouched, per the cutover plan).
export default defineConfig({
  base: './',
});
