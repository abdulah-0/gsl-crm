import { test, expect } from '@playwright/test';


const testUsers = {
    superAdmin: {
        email: 'admin@thegateway.pk',
        password: 'Admin@123',
    },
    counsellor: {
        email: 'counsellor1i8@thegateway.pk',
        password: 'Counsellor1@I8',
    },
};

// Helper function to login
async function login(page, email, password) {
    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
}

test.describe('Role-Based Access Control Tests', () => {

    test('Super Admin should access all modules', async ({ page }) => {
        await login(page, testUsers.superAdmin.email, testUsers.superAdmin.password);

        // Test access to various modules
        const modules = [
            { name: 'Leads', url: '/leads' },
            { name: 'Students', url: '/students' },
            { name: 'Cases', url: '/cases' },
            { name: 'Accounts', url: '/accounts' },
            { name: 'Employees', url: '/employees' },
        ];

        for (const module of modules) {
            await page.goto(module.url);
            await page.waitForTimeout(1000);

            // Should not redirect to login or show access denied
            const currentUrl = page.url();
            expect(currentUrl).toContain(module.url);

            // Take screenshot
            await page.screenshot({
                path: `tests/screenshots/superadmin-${module.name.toLowerCase()}.png`,
                fullPage: true
            });
        }
    });

    test('Counsellor should have restricted access - sidebar check', async ({ page }) => {
        await login(page, testUsers.counsellor.email, testUsers.counsellor.password);

        // Check sidebar for available modules
        const sidebar = page.locator('[class*="sidebar"], nav, [role="navigation"]').first();
        await expect(sidebar).toBeVisible();

        // Take screenshot of sidebar
        await page.screenshot({ path: 'tests/screenshots/counsellor-sidebar.png' });

        // Counsellor should see these modules
        const allowedModules = ['Dashboard', 'Cases', 'Calendar', 'Universities', 'Messenger'];

        for (const module of allowedModules) {
            const moduleLink = page.locator(`text=${module}`).first();
            // Module should exist in sidebar
            const count = await moduleLink.count();
            expect(count).toBeGreaterThan(0);
        }
    });

    test('SECURITY: Counsellor should NOT access Accounts via direct URL', async ({ page }) => {
        await login(page, testUsers.counsellor.email, testUsers.counsellor.password);

        // Try to access Accounts module directly
        await page.goto('/accounts');
        await page.waitForTimeout(2000);

        const currentUrl = page.url();

        // Should either:
        // 1. Redirect to dashboard or login
        // 2. Show access denied message
        // 3. NOT show the accounts page content

        const isOnAccounts = currentUrl.includes('/accounts');

        if (isOnAccounts) {
            // Check if there's an access denied message
            const accessDenied = await page.locator('text=/access denied|unauthorized|permission/i').count();

            // Take screenshot to document the security issue
            await page.screenshot({
                path: 'tests/screenshots/SECURITY-ISSUE-counsellor-accounts-access.png',
                fullPage: true
            });

            // This test should fail if counsellor can access accounts
            expect(accessDenied).toBeGreaterThan(0);
        } else {
            // Good - redirected away from accounts
            expect(currentUrl).not.toContain('/accounts');
        }
    });

    test('SECURITY: Counsellor should NOT access Leads via direct URL', async ({ page }) => {
        await login(page, testUsers.counsellor.email, testUsers.counsellor.password);

        await page.goto('/leads');
        await page.waitForTimeout(2000);

        const currentUrl = page.url();
        const isOnLeads = currentUrl.includes('/leads');

        if (isOnLeads) {
            const accessDenied = await page.locator('text=/access denied|unauthorized|permission/i').count();

            await page.screenshot({
                path: 'tests/screenshots/SECURITY-ISSUE-counsellor-leads-access.png',
                fullPage: true
            });

            expect(accessDenied).toBeGreaterThan(0);
        } else {
            expect(currentUrl).not.toContain('/leads');
        }
    });

    test('SECURITY: Counsellor should NOT access Employees via direct URL', async ({ page }) => {
        await login(page, testUsers.counsellor.email, testUsers.counsellor.password);

        await page.goto('/employees');
        await page.waitForTimeout(2000);

        const currentUrl = page.url();
        const isOnEmployees = currentUrl.includes('/employees');

        if (isOnEmployees) {
            const accessDenied = await page.locator('text=/access denied|unauthorized|permission/i').count();

            await page.screenshot({
                path: 'tests/screenshots/SECURITY-ISSUE-counsellor-employees-access.png',
                fullPage: true
            });

            expect(accessDenied).toBeGreaterThan(0);
        } else {
            expect(currentUrl).not.toContain('/employees');
        }
    });

    test('Counsellor CAN access allowed modules', async ({ page }) => {
        await login(page, testUsers.counsellor.email, testUsers.counsellor.password);

        // Modules counsellor should be able to access
        const allowedModules = [
            { name: 'Cases', url: '/cases' },
            { name: 'Universities', url: '/universities' },
            { name: 'Calendar', url: '/calendar' },
        ];

        for (const module of allowedModules) {
            await page.goto(module.url);
            await page.waitForTimeout(1000);

            const currentUrl = page.url();
            expect(currentUrl).toContain(module.url);

            // Should not show access denied
            const accessDenied = await page.locator('text=/access denied|unauthorized/i').count();
            expect(accessDenied).toBe(0);

            await page.screenshot({
                path: `tests/screenshots/counsellor-${module.name.toLowerCase()}-allowed.png`,
                fullPage: true
            });
        }
    });
});
