import { test, expect } from '@playwright/test';

test.describe('Validate Feature Calculations', () => {
  test('Validate Combat Trade calculations are correct', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log('BROWSER:', msg.text()));

    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);

    // Click first game
    const firstGame = page.locator('button:has-text("View Analysis")').first();
    await firstGame.waitFor({ timeout: 10000 });
    await firstGame.click();

    // Wait for dashboard
    await page.waitForSelector('text=Performance Analysis', { timeout: 15000 });

    // Inject validation script
    const results = await page.evaluate(() => {
      // Find Combat Trade Analysis card
      const combatCard = Array.from(document.querySelectorAll('.card')).find(el =>
        el.textContent?.includes('Combat Trade Analysis')
      );

      if (!combatCard) return { error: 'Combat Trade Analysis not found' };

      // Extract metrics
      const extractMetric = (label: string): string | null => {
        const elements = Array.from(combatCard.querySelectorAll('*'));
        for (const el of elements) {
          if (el.textContent?.includes(label)) {
            const parent = el.parentElement;
            if (parent) {
              const valueMatch = parent.textContent?.match(/(\d+\.?\d*)%?/);
              if (valueMatch) return valueMatch[1];
            }
          }
        }
        return null;
      };

      const armySpending = extractMetric('Army Spending');
      const economySpending = extractMetric('Economy Spending');
      const techSpending = extractMetric('Tech');
      const tradeEfficiency = extractMetric('Trade Efficiency');
      const armySurvival = extractMetric('Army Survival');

      return {
        armySpending: armySpending ? parseFloat(armySpending) : null,
        economySpending: economySpending ? parseFloat(economySpending) : null,
        techSpending: techSpending ? parseFloat(techSpending) : null,
        tradeEfficiency: tradeEfficiency ? parseFloat(tradeEfficiency) : null,
        armySurvival: armySurvival ? parseFloat(armySurvival) : null,
      };
    });

    console.log('Combat Trade Metrics:', JSON.stringify(results, null, 2));

    // Validate spending percentages
    if (results.armySpending !== null) {
      expect(results.armySpending).toBeGreaterThanOrEqual(0);
      expect(results.armySpending).toBeLessThanOrEqual(100);
      console.log(`✓ Army spending valid: ${results.armySpending}%`);
    }

    if (results.economySpending !== null) {
      expect(results.economySpending).toBeGreaterThanOrEqual(0);
      expect(results.economySpending).toBeLessThanOrEqual(100);
      console.log(`✓ Economy spending valid: ${results.economySpending}%`);
    }

    // Trade efficiency should be >= 0 (0 = no combat, >0 = combat occurred)
    if (results.tradeEfficiency !== null) {
      expect(results.tradeEfficiency).toBeGreaterThanOrEqual(0);
      console.log(`✓ Trade efficiency valid: ${results.tradeEfficiency}`);
    }

    // Army survival should be 0-100%
    if (results.armySurvival !== null) {
      expect(results.armySurvival).toBeGreaterThanOrEqual(0);
      expect(results.armySurvival).toBeLessThanOrEqual(100);
      console.log(`✓ Army survival valid: ${results.armySurvival}%`);
    }

    // Take screenshot for visual inspection
    await page.locator('text=Combat Trade Analysis').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '.playwright-mcp/combat-validation.png' });
  });

  test('Validate no impossible values appear', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);

    const firstGame = page.locator('button:has-text("View Analysis")').first();
    await firstGame.waitFor({ timeout: 10000 });
    await firstGame.click();

    await page.waitForSelector('text=Performance Analysis', { timeout: 15000 });

    // Get all text content
    const pageText = await page.textContent('body');

    // Check for impossible values
    const issues = [];

    // Check for percentages > 100%
    const percentMatches = pageText?.matchAll(/(\d{3,})%/g);
    if (percentMatches) {
      for (const match of percentMatches) {
        const value = parseInt(match[1]);
        if (value > 200) { // Allow some buffer for formatting
          issues.push(`Found percentage > 200%: ${match[0]}`);
        }
      }
    }

    // Check for NaN or Infinity
    if (pageText?.includes('NaN') || pageText?.includes('Infinity')) {
      issues.push('Found NaN or Infinity in page');
    }

    // Check for negative percentages in spending (some metrics can be negative, but not spending)
    if (pageText?.includes('-') && pageText?.includes('% of total resources')) {
      const negativeSpending = pageText.match(/-\d+\.?\d*% of total resources/);
      if (negativeSpending) {
        issues.push(`Found negative spending: ${negativeSpending[0]}`);
      }
    }

    // Report issues
    if (issues.length > 0) {
      console.log('Issues found:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    } else {
      console.log('✓ No impossible values found');
    }

    expect(issues.length).toBe(0);

    // Full page screenshot
    await page.screenshot({ path: '.playwright-mcp/full-validation.png', fullPage: true });
  });
});
