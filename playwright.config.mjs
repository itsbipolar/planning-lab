import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'labs/money-milestones/tests',
  testMatch: '*.spec.mjs',
  fullyParallel: true,
  reporter: [['list']],
  use: { trace: 'off' },
});
