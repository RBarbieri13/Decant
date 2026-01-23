import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const SCREENSHOT_DIR = 'test-output/verification-screenshots';

test.describe('Desktop App UI Verification', () => {
    test.beforeAll(() => {
        if (!existsSync(SCREENSHOT_DIR)) {
            mkdirSync(SCREENSHOT_DIR, { recursive: true });
        }
    });

    test('PROOF: App renders and UI is populated', async () => {
        const distPath = join(__dirname, '../../dist/main.cjs');

        console.log('Launching Electron app from:', distPath);

        const app = await electron.launch({
            args: [distPath],
            env: {
                ...process.env,
                TRILIUM_INTEGRATION_TEST: 'memory',
                TRILIUM_DATA_DIR: 'data-verification'
            }
        });

        try {
            const window = await app.firstWindow();
            await window.waitForLoadState('domcontentloaded');

            // Capture initial load
            await window.screenshot({
                path: `${SCREENSHOT_DIR}/01-initial-load.png`
            });
            console.log('Screenshot 1: Initial load captured');

            // Verify page has content (not blank)
            const bodyContent = await window.evaluate(() => document.body?.innerHTML?.length || 0);
            expect(bodyContent).toBeGreaterThan(500);
            console.log(`EVIDENCE: Body content length = ${bodyContent}`);

            // Verify no error overlays
            const errorOverlay = window.locator('.error-overlay, .fatal-error');
            const hasError = await errorOverlay.count() > 0;
            expect(hasError).toBe(false);
            console.log(`EVIDENCE: Error overlays present = ${hasError}`);

            // Verify title
            const title = await window.title();
            console.log(`EVIDENCE: Window title = "${title}"`);
            expect(title).toBeTruthy();

            // If setup page, complete it
            if (title === 'Setup') {
                console.log('Setup page detected, completing setup...');

                // Select demo database option
                const demoOption = window.locator('input[type="radio"]').first();
                await demoOption.click();
                await window.screenshot({ path: `${SCREENSHOT_DIR}/02-setup-selected.png` });
                console.log('Screenshot 2: Setup option selected');

                // Click Next
                const nextButton = window.locator('button[type="submit"]');
                const newWindowPromise = app.waitForEvent('window');
                await nextButton.click();

                const mainWindow = await newWindowPromise;
                await mainWindow.waitForLoadState('domcontentloaded');
                await mainWindow.waitForTimeout(3000); // Allow UI to render

                // Capture main window
                await mainWindow.screenshot({
                    path: `${SCREENSHOT_DIR}/03-main-window.png`
                });
                console.log('Screenshot 3: Main window captured');

                // Verify tree is visible
                const tree = mainWindow.locator('.tree-wrapper');
                await expect(tree).toBeVisible({ timeout: 10000 });
                await tree.screenshot({ path: `${SCREENSHOT_DIR}/04-note-tree.png` });
                console.log('Screenshot 4: Note tree captured');

                // Verify tree has nodes
                const nodeCount = await mainWindow.locator('.fancytree-node').count();
                console.log(`EVIDENCE: Tree node count = ${nodeCount}`);
                expect(nodeCount).toBeGreaterThan(0);

                // Verify note split visible
                const noteSplit = mainWindow.locator('.note-split:not(.hidden-ext)');
                await expect(noteSplit).toBeVisible();
                await noteSplit.screenshot({ path: `${SCREENSHOT_DIR}/05-note-split.png` });
                console.log('Screenshot 5: Note split captured');

                console.log('\n=== VERIFICATION PASSED ===');
                console.log(`Screenshots saved to: ${SCREENSHOT_DIR}/`);
            } else {
                // Main window loaded directly (existing database)
                console.log('Main window detected, verifying UI...');

                // Verify tree is visible
                const tree = window.locator('.tree-wrapper');
                await expect(tree).toBeVisible({ timeout: 10000 });
                await tree.screenshot({ path: `${SCREENSHOT_DIR}/02-note-tree.png` });
                console.log('Screenshot 2: Note tree captured');

                // Verify tree has nodes
                const nodeCount = await window.locator('.fancytree-node').count();
                console.log(`EVIDENCE: Tree node count = ${nodeCount}`);
                expect(nodeCount).toBeGreaterThan(0);

                console.log('\n=== VERIFICATION PASSED ===');
                console.log(`Screenshots saved to: ${SCREENSHOT_DIR}/`);
            }

        } finally {
            await app.close();
        }
    });
});
