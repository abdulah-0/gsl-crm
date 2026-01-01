import { defineConfig, devices } from '@playwright/test';

export default defineConfig({

    testDir: './tests',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: [
        ['html'],
        ['list']
    ],
    use: {
        baseURL: 'https://gsl-crm.vercel.app/',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    webServer: {
        command: 'npm run start',
        url: 'http://localhost:4028',
        reuseExistingServer: true,
        timeout: 120 * 1000,
    },
});
