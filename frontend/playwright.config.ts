import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    retries: process.env.CI ? 2 : 0,
    fullyParallel: false,
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        video: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'npm run dev -- --host 0.0.0.0 --port 5173',
        url: 'http://localhost:5173',
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
            },
        },
    ],
});



