import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'labs',
  testMatch: '**/tests/*.spec.mjs',
  fullyParallel: true,
  reporter: [['list']],
  use: { trace: 'off' },
});
