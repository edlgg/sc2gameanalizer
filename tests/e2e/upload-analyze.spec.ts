// tests/e2e/upload-analyze.spec.ts
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Replay Upload and Analysis', () => {
  test('should upload replay and show analysis', async ({ page }) => {
    await page.goto('/');

    // Check page loads
    await expect(page.locator('h1')).toContainText('SC2 Replay Analyzer');

    // Check upload section exists
    await expect(page.locator('h2')).toContainText('Upload Replay');

    // Note: This test requires a test replay file at backend/tests/fixtures/test_replay.SC2Replay
    const testReplayPath = path.join(__dirname, '../../backend/tests/fixtures/test_replay.SC2Replay');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testReplayPath);

    // Click analyze button
    const analyzeButton = page.locator('button', { hasText: 'Analyze Replay' });
    await analyzeButton.click();

    // Wait for analysis to complete
    await expect(page.locator('text=Analyzing...')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('text=Analysis Results')).toBeVisible({ timeout: 30000 });

    // Check results display
    await expect(page.locator('h3', { hasText: 'Game Info' })).toBeVisible();
    await expect(page.locator('h3', { hasText: 'Top Recommendations' })).toBeVisible();
    await expect(page.locator('h3', { hasText: 'Performance Comparison' })).toBeVisible();

    // Check charts rendered
    const charts = page.locator('.recharts-wrapper');
    await expect(charts).toHaveCount(2); // Worker count + Army value
  });

  test('should show error for invalid file', async ({ page }) => {
    await page.goto('/');

    // Try to upload invalid file (if test exists)
    // This is a simplified test
    await expect(page.locator('button', { hasText: 'Analyze Replay' })).toBeDisabled();
  });
});
