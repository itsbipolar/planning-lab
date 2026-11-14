import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: ['labs/**/tests/*.spec.mjs', 'shared/desk/tests/*.spec.mjs'],
  testIgnore: ['labs/_archive/**'],
  fullyParallel: true,
  reporter: [['list']],
  use: { trace: 'off' },
});
