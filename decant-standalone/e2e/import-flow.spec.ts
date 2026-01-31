// ============================================================
// Import Flow E2E Tests
// ============================================================
//
// NOTE: This is a Playwright E2E test. Install with:
// pnpm add -D @playwright/test
//
// Run with: pnpm exec playwright test
//
// Alternatively, these can be manual test cases if Playwright
// is not desired. See the "Manual Testing Guide" section below.
// ============================================================

import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173'; // Vite dev server default

test.describe('Import Flow E2E', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Complete Import Workflow', () => {
    test('should import a URL through the full workflow', async () => {
      // 1. Open import dialog
      await page.click('button:has-text("Import")');

      // 2. Verify dialog is visible
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('h2:has-text("Import URL")')).toBeVisible();

      // 3. Enter URL
      const urlInput = page.locator('input[type="url"]');
      await urlInput.fill('https://example.com/test-article');

      // 4. Submit import
      await page.click('button:has-text("Import")');

      // 5. Verify progress indicators appear
      await expect(page.locator('.import-progress-container')).toBeVisible();
      await expect(page.locator('.progress-step:has-text("Validating")')).toBeVisible();
      await expect(page.locator('.progress-step:has-text("Fetching")')).toBeVisible();
      await expect(page.locator('.progress-step:has-text("Classifying")')).toBeVisible();

      // 6. Wait for completion
      await expect(page.locator('.import-dialog-success')).toBeVisible({ timeout: 30000 });
      await expect(page.locator(':has-text("Import Complete!")')).toBeVisible();

      // 7. Verify classification preview
      await expect(page.locator('.import-classification-preview')).toBeVisible();

      // 8. Click "View Node" button
      await page.click('button:has-text("View Node")');

      // 9. Verify dialog closes and node is selected
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
      await expect(page.locator('.detail-panel .detail-title')).toBeVisible();

      // 10. Verify node appears in tree
      await expect(page.locator('.tree-panel').locator(':has-text("test-article")')).toBeVisible();
    });

    test('should handle import errors gracefully', async () => {
      // 1. Open import dialog
      await page.click('button:has-text("Import")');

      // 2. Enter invalid URL
      const urlInput = page.locator('input[type="url"]');
      await urlInput.fill('https://invalid-url-that-will-fail.test');

      // 3. Submit
      await page.click('button:has-text("Import")');

      // 4. Wait for error
      await expect(page.locator('.import-dialog-error')).toBeVisible({ timeout: 15000 });

      // 5. Verify error message
      await expect(page.locator('.import-dialog-error')).toContainText(/failed|error/i);

      // 6. Verify retry button is available
      await expect(page.locator('button:has-text("Retry")')).toBeVisible();

      // 7. Can retry or close
      await page.click('button:has-text("Cancel")');
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('should show Phase 2 enrichment status', async () => {
      // This test assumes the backend returns phase2: { queued: true }

      // 1. Start import
      await page.click('button:has-text("Import")');
      const urlInput = page.locator('input[type="url"]');
      await urlInput.fill('https://example.com/article-with-enrichment');
      await page.click('button:has-text("Import")');

      // 2. Wait for completion
      await expect(page.locator('.import-dialog-success')).toBeVisible({ timeout: 30000 });

      // 3. Verify enrichment status is shown
      await expect(page.locator(':has-text("Enriching in background")')).toBeVisible();

      // 4. Verify enrichment icon is animating
      const enrichmentIcon = page.locator('.enrichment-icon');
      await expect(enrichmentIcon).toBeVisible();

      // 5. View the node
      await page.click('button:has-text("View Node")');

      // 6. Verify node is in "pending enrichment" state
      // (Implementation depends on UI indicators)
    });
  });

  test.describe('Dialog Interactions', () => {
    test('should close dialog on Escape key', async () => {
      // Open dialog
      await page.click('button:has-text("Import")');
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Verify closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('should close dialog by clicking overlay', async () => {
      // Open dialog
      await page.click('button:has-text("Import")');
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Click overlay (not the dialog itself)
      await page.locator('.import-dialog-overlay').click({ position: { x: 10, y: 10 } });

      // Verify closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('should not close dialog when clicking inside content', async () => {
      // Open dialog
      await page.click('button:has-text("Import")');
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Click inside dialog
      await page.locator('[role="dialog"]').click();

      // Should remain open
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    });

    test('should not allow closing during active import', async () => {
      // Open dialog
      await page.click('button:has-text("Import")');

      // Start import
      const urlInput = page.locator('input[type="url"]');
      await urlInput.fill('https://example.com/test');
      await page.click('button:has-text("Import")');

      // Verify progress is shown
      await expect(page.locator('.import-progress-container')).toBeVisible();

      // Try to press Escape - should not close
      await page.keyboard.press('Escape');
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Close button should be disabled
      const closeButton = page.locator('button[aria-label="Close dialog"]');
      await expect(closeButton).toBeDisabled();
    });
  });

  test.describe('Progress Tracking', () => {
    test('should show all progress phases in order', async () => {
      // Open dialog and start import
      await page.click('button:has-text("Import")');
      const urlInput = page.locator('input[type="url"]');
      await urlInput.fill('https://example.com/test');
      await page.click('button:has-text("Import")');

      // Validating phase
      await expect(page.locator('.progress-step.active:has-text("Validating")')).toBeVisible();

      // Fetching phase
      await expect(page.locator('.progress-step.active:has-text("Fetching")')).toBeVisible({
        timeout: 5000,
      });

      // Classifying phase
      await expect(page.locator('.progress-step.active:has-text("Classifying")')).toBeVisible({
        timeout: 15000,
      });

      // Saving phase
      await expect(page.locator('.progress-step.active:has-text("Saving")')).toBeVisible({
        timeout: 5000,
      });

      // Complete
      await expect(page.locator('.progress-step.complete:has-text("Complete")')).toBeVisible({
        timeout: 5000,
      });
    });

    test('should update progress bar percentage', async () => {
      await page.click('button:has-text("Import")');
      const urlInput = page.locator('input[type="url"]');
      await urlInput.fill('https://example.com/test');
      await page.click('button:has-text("Import")');

      // Progress bar should start small
      const progressBar = page.locator('.import-progress-fill');
      await expect(progressBar).toBeVisible();

      // Should grow over time
      await page.waitForTimeout(1000);
      const initialWidth = await progressBar.evaluate((el) => el.style.width);

      await page.waitForTimeout(2000);
      const laterWidth = await progressBar.evaluate((el) => el.style.width);

      // Later width should be greater
      expect(parseFloat(laterWidth)).toBeGreaterThan(parseFloat(initialWidth));
    });

    test('should show descriptive messages for each phase', async () => {
      await page.click('button:has-text("Import")');
      const urlInput = page.locator('input[type="url"]');
      await urlInput.fill('https://example.com/test');
      await page.click('button:has-text("Import")');

      // Message should update
      const messageArea = page.locator('.import-progress-message');
      await expect(messageArea).toContainText(/validating/i);

      await expect(messageArea).toContainText(/fetching/i, { timeout: 5000 });
      await expect(messageArea).toContainText(/classifying/i, { timeout: 15000 });
    });
  });

  test.describe('Classification Display', () => {
    test('should display classification tags', async () => {
      await page.click('button:has-text("Import")');
      const urlInput = page.locator('input[type="url"]');
      await urlInput.fill('https://example.com/tech-article');
      await page.click('button:has-text("Import")');

      // Wait for classification preview
      await expect(page.locator('.import-classification-preview')).toBeVisible({
        timeout: 30000,
      });

      // Should show segment, category, and content type
      await expect(page.locator('.classification-tag.segment')).toBeVisible();
      await expect(page.locator('.classification-tag.category')).toBeVisible();
      await expect(page.locator('.classification-tag.content-type')).toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should submit form on Enter key', async () => {
      await page.click('button:has-text("Import")');

      const urlInput = page.locator('input[type="url"]');
      await urlInput.fill('https://example.com/test');

      // Press Enter
      await urlInput.press('Enter');

      // Should start import
      await expect(page.locator('.import-progress-container')).toBeVisible({ timeout: 2000 });
    });

    test('should focus input when dialog opens', async () => {
      await page.click('button:has-text("Import")');

      // Input should be focused
      const urlInput = page.locator('input[type="url"]');
      await expect(urlInput).toBeFocused();
    });
  });

  test.describe('API Key Configuration', () => {
    test('should show error if API key is not configured', async () => {
      // This test assumes API key is not set
      // May need to clear API key first through settings

      await page.click('button:has-text("Import")');
      const urlInput = page.locator('input[type="url"]');
      await urlInput.fill('https://example.com/test');
      await page.click('button:has-text("Import")');

      // Should show API key error
      await expect(page.locator('.import-dialog-error')).toContainText(/api key/i, {
        timeout: 5000,
      });
    });
  });
});

// ============================================================
// Manual Testing Guide
// ============================================================
//
// If Playwright is not installed, use these manual test steps:
//
// TEST 1: Complete Import Flow
// 1. Click "Import" button in the toolbar
// 2. Verify import dialog opens
// 3. Enter URL: https://example.com/test-article
// 4. Click "Import" button
// 5. EXPECT: Progress steps show in order (Validating → Fetching → Classifying → Saving → Complete)
// 6. EXPECT: Progress bar fills from 0% to 100%
// 7. EXPECT: Classification preview shows segment, category, and content type
// 8. EXPECT: Success message "Import Complete!" appears
// 9. Click "View Node" button
// 10. EXPECT: Dialog closes
// 11. EXPECT: Node details appear in detail panel
// 12. EXPECT: Node appears in tree panel
//
// TEST 2: Error Handling
// 1. Click "Import" button
// 2. Enter invalid URL: https://this-will-404.example.com
// 3. Click "Import"
// 4. EXPECT: Error message appears
// 5. EXPECT: "Retry" button is available
// 6. Click "Cancel"
// 7. EXPECT: Dialog closes
//
// TEST 3: Phase 2 Enrichment
// 1. Import a URL successfully
// 2. EXPECT: After completion, see "Enriching in background..." message
// 3. EXPECT: Spinning icon next to message
// 4. Click "View Node"
// 5. EXPECT: Node shows enrichment in progress
//
// TEST 4: Dialog Controls
// 1. Click "Import" button
// 2. Press Escape key
// 3. EXPECT: Dialog closes
// 4. Click "Import" button again
// 5. Click outside dialog (on overlay)
// 6. EXPECT: Dialog closes
// 7. Click "Import" button again
// 8. Click inside dialog content
// 9. EXPECT: Dialog stays open
//
// TEST 5: Import In Progress Protection
// 1. Click "Import" button
// 2. Enter a valid URL
// 3. Click "Import"
// 4. While importing, press Escape
// 5. EXPECT: Dialog stays open
// 6. EXPECT: Close button is disabled
// 7. EXPECT: Cancel button is disabled
// 8. Wait for import to complete
// 9. EXPECT: Close button becomes enabled
//
// TEST 6: Validation
// 1. Click "Import" button
// 2. Leave URL field empty
// 3. EXPECT: Import button is disabled
// 4. Type "not-a-url"
// 5. Click "Import"
// 6. EXPECT: Nothing happens (invalid URL)
// 7. Clear field and type "https://valid-url.com"
// 8. EXPECT: Import button becomes enabled
//
// TEST 7: Accessibility
// 1. Click "Import" button
// 2. EXPECT: URL input is focused
// 3. Navigate with Tab key
// 4. EXPECT: Can reach all buttons
// 5. EXPECT: Dialog has proper ARIA labels
// 6. Use screen reader
// 7. EXPECT: Progress updates are announced
//
// ============================================================
