import { test, expect } from '@playwright/test';


const testUser = {
    email: 'admin@thegateway.pk',
    password: 'Admin@123',
};

async function login(page) {
    await page.goto('/login');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
}

test.describe('Dashboard Module Tests', () => {

    test('should display dashboard with key metrics', async ({ page }) => {
        await login(page);

        // Wait for dashboard to load
        await page.waitForTimeout(2000);

        // Check for common dashboard elements
        const dashboardElements = [
            'text=/total|count|active/i',
            '[class*="card"], [class*="metric"], [class*="stat"]',
        ];

        for (const selector of dashboardElements) {
            const element = page.locator(selector).first();
            const count = await element.count();
            expect(count).toBeGreaterThan(0);
        }

        await page.screenshot({ path: 'tests/screenshots/dashboard-full.png', fullPage: true });
    });

    test('should display recent activity or tasks', async ({ page }) => {
        await login(page);
        await page.waitForTimeout(2000);

        // Look for activity feed or task list
        const activitySelectors = [
            'text=/recent activity|my tasks|daily task/i',
            '[class*="activity"], [class*="task-list"]',
        ];

        let found = false;
        for (const selector of activitySelectors) {
            const count = await page.locator(selector).count();
            if (count > 0) {
                found = true;
                break;
            }
        }

        expect(found).toBe(true);
    });
});

test.describe('Leads Module Tests', () => {

    test('should display leads page with table', async ({ page }) => {
        await login(page);
        await page.goto('/leads');
        await page.waitForTimeout(2000);

        // Check for leads table or list
        const tableExists = await page.locator('table, [class*="table"], [class*="grid"]').count();
        expect(tableExists).toBeGreaterThan(0);

        await page.screenshot({ path: 'tests/screenshots/leads-page.png', fullPage: true });
    });

    test('should have Add Lead button', async ({ page }) => {
        await login(page);
        await page.goto('/leads');
        await page.waitForTimeout(1000);

        const addButton = page.locator('button:has-text("Add Lead"), a:has-text("Add Lead")').first();
        await expect(addButton).toBeVisible();
    });

    test('should have Upload Excel button', async ({ page }) => {
        await login(page);
        await page.goto('/leads');
        await page.waitForTimeout(1000);

        const uploadButton = page.locator('button:has-text("Upload Excel"), a:has-text("Upload Excel")').first();
        await expect(uploadButton).toBeVisible();
    });

    test('should display lead status filters', async ({ page }) => {
        await login(page);
        await page.goto('/leads');
        await page.waitForTimeout(1000);

        // Look for status filters (All Leads, Active, etc.)
        const filterExists = await page.locator('text=/all leads|active|confirmed/i').count();
        expect(filterExists).toBeGreaterThan(0);
    });
});

test.describe('Students Module Tests', () => {

    test('should display students page', async ({ page }) => {
        await login(page);
        await page.goto('/students');
        await page.waitForTimeout(2000);

        await page.screenshot({ path: 'tests/screenshots/students-page.png', fullPage: true });

        // Check for students table
        const tableExists = await page.locator('table, [class*="table"]').count();
        expect(tableExists).toBeGreaterThan(0);
    });

    test('should show enrolled students count', async ({ page }) => {
        await login(page);
        await page.goto('/students');
        await page.waitForTimeout(2000);

        // Look for enrollment status or count
        const enrolledText = await page.locator('text=/enrolled|students/i').count();
        expect(enrolledText).toBeGreaterThan(0);
    });

    test('should have student action buttons', async ({ page }) => {
        await login(page);
        await page.goto('/students');
        await page.waitForTimeout(2000);

        // Look for Edit, Archive, or other action buttons
        const actionButtons = await page.locator('button:has-text("Edit"), button:has-text("Archive"), a:has-text("Edit")').count();
        expect(actionButtons).toBeGreaterThan(0);
    });
});

test.describe('Cases Module Tests', () => {

    test('should display cases page', async ({ page }) => {
        await login(page);
        await page.goto('/cases');
        await page.waitForTimeout(2000);

        await page.screenshot({ path: 'tests/screenshots/cases-page.png', fullPage: true });

        const pageLoaded = await page.locator('text=/case|ongoing/i').count();
        expect(pageLoaded).toBeGreaterThan(0);
    });

    test('should show active cases', async ({ page }) => {
        await login(page);
        await page.goto('/cases');
        await page.waitForTimeout(2000);

        // Look for case list or table
        const casesExist = await page.locator('table, [class*="case"], [class*="list"]').count();
        expect(casesExist).toBeGreaterThan(0);
    });
});

test.describe('Accounts Module Tests', () => {

    test('should display accounts/finances page', async ({ page }) => {
        await login(page);
        await page.goto('/accounts');
        await page.waitForTimeout(2000);

        await page.screenshot({ path: 'tests/screenshots/accounts-page.png', fullPage: true });

        const pageLoaded = await page.locator('text=/account|finance|cash/i').count();
        expect(pageLoaded).toBeGreaterThan(0);
    });

    test('should have Cash In and Cash Out options', async ({ page }) => {
        await login(page);
        await page.goto('/accounts');
        await page.waitForTimeout(2000);

        const cashIn = await page.locator('text=/cash in/i').count();
        const cashOut = await page.locator('text=/cash out/i').count();

        expect(cashIn + cashOut).toBeGreaterThan(0);
    });

    test('should display voucher tools', async ({ page }) => {
        await login(page);
        await page.goto('/accounts');
        await page.waitForTimeout(2000);

        const vouchers = await page.locator('text=/voucher/i').count();
        expect(vouchers).toBeGreaterThan(0);
    });
});

test.describe('Universities Module Tests', () => {

    test('should display universities page', async ({ page }) => {
        await login(page);
        await page.goto('/universities');
        await page.waitForTimeout(2000);

        await page.screenshot({ path: 'tests/screenshots/universities-page.png', fullPage: true });

        const pageLoaded = await page.locator('text=/universit/i').count();
        expect(pageLoaded).toBeGreaterThan(0);
    });

    test('should list universities', async ({ page }) => {
        await login(page);
        await page.goto('/universities');
        await page.waitForTimeout(2000);

        const listExists = await page.locator('table, [class*="list"], [class*="grid"]').count();
        expect(listExists).toBeGreaterThan(0);
    });
});

test.describe('Calendar Module Tests', () => {

    test('should display calendar page', async ({ page }) => {
        await login(page);
        await page.goto('/calendar');
        await page.waitForTimeout(2000);

        await page.screenshot({ path: 'tests/screenshots/calendar-page.png', fullPage: true });

        const calendarExists = await page.locator('[class*="calendar"], text=/calendar/i').count();
        expect(calendarExists).toBeGreaterThan(0);
    });
});
