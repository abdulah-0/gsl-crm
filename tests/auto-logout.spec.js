import { test, expect } from '@playwright/test';


const testUser = {
    email: 'admin@thegateway.pk',
    password: 'Admin@123',
};

async function login(page, email, password) {
    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
}

test.describe('Auto-Logout Inactivity Tests', () => {

    test('should NOT logout before 5 minutes of inactivity', async ({ page }) => {
        await login(page, testUser.email, testUser.password);

        // Verify logged in
        await expect(page).toHaveURL(/dashboard/);
        console.log('Logged in successfully at:', new Date().toISOString());

        // Wait for 1 minute (60 seconds)
        console.log('Waiting 1 minute...');
        await page.waitForTimeout(60 * 1000);

        // Check if still logged in
        const currentUrl1 = page.url();
        console.log('After 1 minute, URL:', currentUrl1);

        // Should still be logged in (not redirected to login)
        expect(currentUrl1).not.toContain('/login');

        // Try to interact with page to verify session is active
        const dashboardVisible = await page.locator('text=/dashboard/i').first().isVisible();
        expect(dashboardVisible).toBe(true);

        await page.screenshot({ path: 'tests/screenshots/auto-logout-1min.png' });
    });

    test('should NOT logout after 2 minutes of inactivity', async ({ page }) => {
        await login(page, testUser.email, testUser.password);

        console.log('Logged in at:', new Date().toISOString());

        // Wait for 2 minutes (120 seconds)
        console.log('Waiting 2 minutes...');
        await page.waitForTimeout(120 * 1000);

        const currentUrl = page.url();
        console.log('After 2 minutes, URL:', currentUrl);

        // Should still be logged in
        expect(currentUrl).not.toContain('/login');

        await page.screenshot({ path: 'tests/screenshots/auto-logout-2min.png' });
    });

    test('should logout after 5 minutes of inactivity', async ({ page }) => {
        await login(page, testUser.email, testUser.password);

        console.log('Logged in at:', new Date().toISOString());

        // Wait for 5 minutes and 10 seconds (310 seconds) to ensure logout happens
        console.log('Waiting 5 minutes and 10 seconds...');
        await page.waitForTimeout(310 * 1000);

        const currentUrl = page.url();
        console.log('After 5+ minutes, URL:', currentUrl);

        // Should be logged out and redirected to login
        expect(currentUrl).toContain('/login');

        await page.screenshot({ path: 'tests/screenshots/auto-logout-5min-logged-out.png' });
    });

    test('should detect exact logout timing', async ({ page }) => {
        await login(page, testUser.email, testUser.password);

        const startTime = Date.now();
        console.log('Login completed at:', new Date(startTime).toISOString());

        let loggedOut = false;
        let logoutTime = null;

        // Check every 30 seconds for up to 6 minutes
        for (let i = 0; i < 12; i++) {
            await page.waitForTimeout(30 * 1000); // Wait 30 seconds

            const elapsed = (Date.now() - startTime) / 1000;
            const currentUrl = page.url();

            console.log(`Check ${i + 1}: ${elapsed}s elapsed, URL: ${currentUrl}`);

            if (currentUrl.includes('/login')) {
                loggedOut = true;
                logoutTime = elapsed;
                console.log(`LOGGED OUT after ${elapsed} seconds (${elapsed / 60} minutes)`);

                await page.screenshot({
                    path: `tests/screenshots/auto-logout-detected-at-${Math.floor(elapsed)}s.png`
                });

                break;
            }
        }

        // Report findings
        if (loggedOut) {
            console.log(`Auto-logout occurred at: ${logoutTime} seconds (${logoutTime / 60} minutes)`);

            // Check if it's happening too early (before 4.5 minutes)
            if (logoutTime < 270) {
                console.error(`WARNING: Auto-logout happening too early! Expected ~300s (5min), got ${logoutTime}s`);
            }

            expect(loggedOut).toBe(true);
        } else {
            console.log('No auto-logout detected within 6 minutes');
            expect(loggedOut).toBe(true); // This will fail if no logout happened
        }
    });

    test('should reset inactivity timer on user interaction', async ({ page }) => {
        await login(page, testUser.email, testUser.password);

        console.log('Logged in at:', new Date().toISOString());

        // Wait 4 minutes
        console.log('Waiting 4 minutes...');
        await page.waitForTimeout(240 * 1000);

        // Interact with page (move mouse, click something)
        console.log('Interacting with page...');
        await page.mouse.move(100, 100);
        await page.click('body');

        // Wait another 2 minutes (total 6 minutes, but with interaction at 4 min mark)
        console.log('Waiting another 2 minutes after interaction...');
        await page.waitForTimeout(120 * 1000);

        const currentUrl = page.url();
        console.log('After 6 total minutes (with interaction at 4min), URL:', currentUrl);

        // Should still be logged in because interaction reset the timer
        expect(currentUrl).not.toContain('/login');

        await page.screenshot({ path: 'tests/screenshots/auto-logout-with-interaction.png' });
    });

    test('should check console for inactivity warnings', async ({ page }) => {
        const consoleMessages = [];

        page.on('console', msg => {
            const text = msg.text().toLowerCase();
            if (text.includes('inactiv') || text.includes('timeout') || text.includes('session')) {
                consoleMessages.push({
                    type: msg.type(),
                    text: msg.text(),
                    timestamp: new Date().toISOString()
                });
                console.log('Console message:', msg.text());
            }
        });

        await login(page, testUser.email, testUser.password);

        // Wait for 5.5 minutes to capture any warnings
        console.log('Monitoring console for 5.5 minutes...');
        await page.waitForTimeout(330 * 1000);

        console.log('Captured console messages:', JSON.stringify(consoleMessages, null, 2));

        // Save console messages to file
        const fs = await import('fs');
        fs.writeFileSync(
            'tests/screenshots/console-inactivity-messages.json',
            JSON.stringify(consoleMessages, null, 2)
        );

    });
});
