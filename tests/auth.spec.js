import { test, expect } from '@playwright/test';


// Test credentials from product specification
const testUsers = {
    superAdmin: {
        email: 'admin@thegateway.pk',
        password: 'Admin@123',
        role: 'Super Admin'
    },
    headOffice: {
        email: 'md@thegateway.pk',
        password: 'GSL@md@2025',
        role: 'Admin'
    },
    counsellor: {
        email: 'counsellor1i8@thegateway.pk',
        password: 'Counsellor1@I8',
        role: 'Counsellor'
    },
    instructor: {
        email: 'instructor1i8@thegateway.pk',
        password: 'Instructor1@i8',
        role: 'Instructor'
    }
};

test.describe('Authentication Tests', () => {

    test('should display login page correctly', async ({ page }) => {
        await page.goto('/login');

        // Check page title
        await expect(page).toHaveTitle(/Sign In to GSL CRM/);

        // Check for login form elements
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should reject invalid credentials', async ({ page }) => {
        await page.goto('/login');

        await page.fill('input[type="email"]', 'invalid@example.com');
        await page.fill('input[type="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');

        // Wait for error message
        await page.waitForTimeout(2000);

        // Should still be on login page or show error
        const currentUrl = page.url();
        expect(currentUrl).toContain('login');
    });

    test('should login successfully as Super Admin', async ({ page }) => {
        await page.goto('/login');

        await page.fill('input[type="email"]', testUsers.superAdmin.email);
        await page.fill('input[type="password"]', testUsers.superAdmin.password);
        await page.click('button[type="submit"]');

        // Wait for navigation to dashboard
        await page.waitForURL('**/dashboard', { timeout: 10000 });

        // Verify dashboard loaded
        await expect(page).toHaveURL(/dashboard/);

        // Take screenshot
        await page.screenshot({ path: 'tests/screenshots/superadmin-dashboard.png', fullPage: true });
    });

    test('should login successfully as Head Office MD', async ({ page }) => {
        await page.goto('/login');

        await page.fill('input[type="email"]', testUsers.headOffice.email);
        await page.fill('input[type="password"]', testUsers.headOffice.password);
        await page.click('button[type="submit"]');

        await page.waitForURL('**/dashboard', { timeout: 10000 });
        await expect(page).toHaveURL(/dashboard/);

        await page.screenshot({ path: 'tests/screenshots/headoffice-dashboard.png', fullPage: true });
    });

    test('should login successfully as Counsellor', async ({ page }) => {
        await page.goto('/login');

        await page.fill('input[type="email"]', testUsers.counsellor.email);
        await page.fill('input[type="password"]', testUsers.counsellor.password);
        await page.click('button[type="submit"]');

        await page.waitForURL('**/dashboard', { timeout: 10000 });
        await expect(page).toHaveURL(/dashboard/);

        await page.screenshot({ path: 'tests/screenshots/counsellor-dashboard.png', fullPage: true });
    });

    test('should login successfully as Instructor', async ({ page }) => {
        await page.goto('/login');

        await page.fill('input[type="email"]', testUsers.instructor.email);
        await page.fill('input[type="password"]', testUsers.instructor.password);
        await page.click('button[type="submit"]');

        await page.waitForURL('**/dashboard', { timeout: 10000 });
        await expect(page).toHaveURL(/dashboard/);

        await page.screenshot({ path: 'tests/screenshots/instructor-dashboard.png', fullPage: true });
    });

    test('should logout successfully', async ({ page }) => {
        // Login first
        await page.goto('/login');
        await page.fill('input[type="email"]', testUsers.superAdmin.email);
        await page.fill('input[type="password"]', testUsers.superAdmin.password);
        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard', { timeout: 10000 });

        // Find and click logout
        // Try common logout selectors
        const logoutSelectors = [
            'text=Logout',
            'text=Log Out',
            'text=Sign Out',
            '[data-testid="logout"]',
            'button:has-text("Logout")'
        ];

        let loggedOut = false;
        for (const selector of logoutSelectors) {
            try {
                const element = page.locator(selector).first();
                if (await element.isVisible({ timeout: 1000 })) {
                    await element.click();
                    loggedOut = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (!loggedOut) {
            // Try clicking user profile menu first
            await page.click('[class*="profile"], [class*="user-menu"], [class*="avatar"]');
            await page.waitForTimeout(500);
            await page.click('text=Logout');
        }

        // Verify redirected to login
        await page.waitForURL('**/login', { timeout: 5000 });
        await expect(page).toHaveURL(/login/);
    });
});
