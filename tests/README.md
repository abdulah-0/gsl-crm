# GSL CRM - Playwright Testing Guide

## Overview
This directory contains automated end-to-end tests for the GSL CRM system using Playwright.

## Test Suites

### 1. Authentication Tests (`auth.spec.js`)
- ✅ Login page display
- ✅ Invalid credentials rejection
- ✅ Successful login for all user roles:
  - Super Admin
  - Head Office MD
  - Counsellor
  - Instructor
- ✅ Logout functionality

### 2. Role-Based Access Control Tests (`rbac.spec.js`)
- ✅ Super Admin full access verification
- ✅ Counsellor permission restrictions
- 🔒 **SECURITY TESTS**: Unauthorized access detection
  - Tests if Counsellor can bypass permissions via direct URLs
  - Checks access to Accounts, Leads, Employees modules
- ✅ Allowed module access verification

### 3. Module Functionality Tests (`modules.spec.js`)
- ✅ Dashboard metrics and activity feed
- ✅ Leads module (table, Add Lead, Upload Excel buttons)
- ✅ Students module (enrollment list, action buttons)
- ✅ Cases module (active cases display)
- ✅ Accounts module (Cash In/Out, vouchers)
- ✅ Universities module (university list)
- ✅ Calendar module

### 4. Auto-Logout Tests (`auto-logout.spec.js`)
- ⏱️ Inactivity timeout verification
- ⏱️ Tests at 1, 2, and 5+ minute intervals
- ⏱️ Exact logout timing detection
- ⏱️ Interaction timer reset verification
- 📊 Console monitoring for session warnings

## Running Tests

### Prerequisites
Make sure the development server is running:
\`\`\`bash
npm run start
\`\`\`

### Run All Tests
\`\`\`bash
npm test
\`\`\`

### Run Specific Test Suites
\`\`\`bash
# Authentication tests only
npm run test:auth

# Role-based access control tests
npm run test:rbac

# Module functionality tests
npm run test:modules

# Auto-logout tests (takes ~6 minutes)
npm run test:logout
\`\`\`

### Run Tests in UI Mode (Interactive)
\`\`\`bash
npm run test:ui
\`\`\`

### Run Tests in Headed Mode (See Browser)
\`\`\`bash
npm run test:headed
\`\`\`

### View Test Report
\`\`\`bash
npm run test:report
\`\`\`

## Test Credentials

All test credentials are defined in the test files:

- **Super Admin**: admin@thegateway.pk / Admin@123
- **Head Office MD**: md@thegateway.pk / GSL@md@2025
- **Counsellor**: counsellor1i8@thegateway.pk / Counsellor1@I8
- **Instructor**: instructor1i8@thegateway.pk / Instructor1@i8

## Screenshots

Test screenshots are automatically saved to:
\`\`\`
tests/screenshots/
\`\`\`

Key screenshots include:
- Dashboard views for each role
- Module pages (Leads, Students, Cases, etc.)
- Security issue documentation (if RBAC bypass detected)
- Auto-logout timing snapshots

## Important Notes

### Auto-Logout Tests
⚠️ **The auto-logout tests take approximately 6 minutes to complete** because they need to wait for the inactivity timeout.

The test suite includes:
1. Quick checks at 1 and 2 minutes (should NOT logout)
2. Full 5+ minute wait to verify logout occurs
3. Precise timing detection (checks every 30 seconds)
4. Interaction reset test

### Security Tests
🔒 The RBAC tests will **intentionally fail** if security vulnerabilities are detected:
- If a Counsellor can access restricted modules via direct URL
- If access control is not properly enforced on the backend

These failures indicate **critical security issues** that need to be fixed.

## Continuous Integration

To run tests in CI/CD:
\`\`\`bash
# Headless mode with retries
npx playwright test --reporter=html
\`\`\`

## Troubleshooting

### Tests Failing Due to Timeouts
- Increase timeout in `playwright.config.js`
- Ensure dev server is running and responsive
- Check network latency

### Element Not Found Errors
- Verify the application is running on `http://localhost:4028`
- Check if UI elements have changed (update selectors)
- Ensure test data exists in the database

### Auto-Logout Test Issues
- Make sure no other browser tabs are interacting with the session
- Check browser console for session management errors
- Verify the inactivity timeout is configured correctly in the backend

## Next Steps

After running tests:
1. Review the HTML report: `npm run test:report`
2. Check screenshots in `tests/screenshots/`
3. Fix any failing tests
4. Address security issues if RBAC tests fail
5. Investigate auto-logout timing if users report premature logouts
