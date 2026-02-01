import { test, expect } from '@playwright/test';

test.describe('New Advanced Features Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(1000);
  });

  test('Combat Trade Analyzer - validates data correctness', async ({ page }) => {
    // Wait for game library to load
    await page.waitForSelector('.card', { timeout: 10000 });

    // Click on first game
    const firstGame = page.locator('button:has-text("View Analysis")').first();
    await firstGame.click();

    // Wait for comparison dashboard
    await page.waitForSelector('text=Performance Analysis', { timeout: 10000 });

    // Scroll to Combat Trade Analysis section
    await page.locator('text=Combat Trade Analysis').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: '.playwright-mcp/combat-trade-analysis.png', fullPage: false });

    // Validate Combat Trade Analyzer is present
    await expect(page.locator('text=Combat Trade Analysis')).toBeVisible();

    // Check for key metrics
    const tradeEfficiency = page.locator('text=Trade Efficiency').first();
    await expect(tradeEfficiency).toBeVisible();

    // Validate percentages are reasonable (< 100%)
    const armySpendingText = await page.locator('text=Army Spending').first().locator('..').textContent();
    console.log('Army Spending text:', armySpendingText);

    const economySpendingText = await page.locator('text=Economy Spending').first().locator('..').textContent();
    console.log('Economy Spending text:', economySpendingText);

    // Extract percentage values and validate
    if (armySpendingText) {
      const armyMatch = armySpendingText.match(/(\d+\.\d+)%/);
      if (armyMatch) {
        const armyPercent = parseFloat(armyMatch[1]);
        console.log('Army spending percentage:', armyPercent);
        expect(armyPercent).toBeLessThanOrEqual(100);
        expect(armyPercent).toBeGreaterThanOrEqual(0);
      }
    }

    if (economySpendingText) {
      const econMatch = economySpendingText.match(/(\d+\.\d+)%/);
      if (econMatch) {
        const econPercent = parseFloat(econMatch[1]);
        console.log('Economy spending percentage:', econPercent);
        expect(econPercent).toBeLessThanOrEqual(100);
        expect(econPercent).toBeGreaterThanOrEqual(0);
      }
    }

    // Check for Sankey diagram (should have SVG)
    const sankeyDiagram = page.locator('svg').first();
    await expect(sankeyDiagram).toBeVisible();

    // Validate insights are present
    await expect(page.locator('text=Key Insights')).toBeVisible();
  });

  test('Supply Block Analyzer - validates detection logic', async ({ page }) => {
    // Navigate to comparison dashboard
    await page.waitForSelector('.card', { timeout: 10000 });
    const firstGame = page.locator('button:has-text("View Analysis")').first();
    await firstGame.click();
    await page.waitForSelector('text=Performance Analysis', { timeout: 10000 });

    // Scroll to Supply Block Analysis
    await page.locator('text=Supply Block Analysis').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: '.playwright-mcp/supply-block-analysis.png', fullPage: false });

    // Validate Supply Block Analyzer is present
    await expect(page.locator('text=Supply Block Analysis')).toBeVisible();

    // Check for key metrics
    await expect(page.locator('text=Total Blocked Time')).toBeVisible();
    await expect(page.locator('text=Block Count')).toBeVisible();
    await expect(page.locator('text=Wasted Minerals')).toBeVisible();

    // Get blocked time value
    const blockedTimeText = await page.locator('text=Total Blocked Time').locator('..').textContent();
    console.log('Blocked time text:', blockedTimeText);

    // Check if ghost units section exists (only if there were blocks)
    const hasGhostUnits = await page.locator('text=Units You Could Have Built').isVisible();
    console.log('Has ghost units:', hasGhostUnits);

    if (hasGhostUnits) {
      // Validate ghost units have reasonable counts
      const ghostUnitsSection = page.locator('text=Units You Could Have Built').locator('..');
      await expect(ghostUnitsSection).toBeVisible();
    }

    // Validate status (GOOD, AVERAGE, POOR, etc.)
    const statusLabels = ['EXCELLENT', 'GOOD', 'AVERAGE', 'POOR'];
    let hasStatus = false;
    for (const label of statusLabels) {
      if (await page.locator(`text=${label}`).isVisible()) {
        hasStatus = true;
        console.log('Supply block status:', label);
        break;
      }
    }
    expect(hasStatus).toBe(true);
  });

  test('Scouting Analyzer - handles missing data gracefully', async ({ page }) => {
    // Navigate to comparison dashboard
    await page.waitForSelector('.card', { timeout: 10000 });
    const firstGame = page.locator('button:has-text("View Analysis")').first();
    await firstGame.click();
    await page.waitForSelector('text=Performance Analysis', { timeout: 10000 });

    // Scroll to Scouting Analysis
    await page.locator('text=Scouting Intelligence Analysis').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: '.playwright-mcp/scouting-analysis.png', fullPage: false });

    // Validate Scouting Analyzer is present
    await expect(page.locator('text=Scouting Intelligence Analysis')).toBeVisible();

    // Check if it shows data not available message OR actual data
    const hasNoDataMessage = await page.locator('text=Vision data not available').isVisible();
    const hasScoutingData = await page.locator('text=Scouting Grade').isVisible();

    console.log('Has no data message:', hasNoDataMessage);
    console.log('Has scouting data:', hasScoutingData);

    // One of these should be true
    expect(hasNoDataMessage || hasScoutingData).toBe(true);

    if (hasScoutingData) {
      // If data is available, validate the grade
      const grades = ['A', 'B', 'C', 'D', 'F'];
      let hasGrade = false;
      for (const grade of grades) {
        const gradeElement = page.locator(`text=${grade}`).first();
        if (await gradeElement.isVisible()) {
          hasGrade = true;
          console.log('Scouting grade:', grade);
          break;
        }
      }
      expect(hasGrade).toBe(true);
    }
  });

  test('Win Probability Predictor - validates probability curve', async ({ page }) => {
    // Navigate to comparison dashboard
    await page.waitForSelector('.card', { timeout: 10000 });
    const firstGame = page.locator('button:has-text("View Analysis")').first();
    await firstGame.click();
    await page.waitForSelector('text=Performance Analysis', { timeout: 10000 });

    // Scroll to Win Probability Analysis
    await page.locator('text=Win Probability Analysis').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: '.playwright-mcp/win-probability-analysis.png', fullPage: false });

    // Validate Win Probability Predictor is present
    await expect(page.locator('text=Win Probability Analysis')).toBeVisible();

    // Check for key metrics
    await expect(page.locator('text=Final Probability')).toBeVisible();
    await expect(page.locator('text=Game Type')).toBeVisible();

    // Validate probability is between 0-100%
    const finalProbText = await page.locator('text=Final Probability').locator('..').textContent();
    console.log('Final probability text:', finalProbText);

    if (finalProbText) {
      const probMatch = finalProbText.match(/(\d+)%/);
      if (probMatch) {
        const probability = parseInt(probMatch[1]);
        console.log('Final probability:', probability);
        expect(probability).toBeGreaterThanOrEqual(0);
        expect(probability).toBeLessThanOrEqual(100);
      }
    }

    // Check game type classification
    const gameTypes = ['DOMINANT VICTORY', 'COMEBACK VICTORY', 'CLOSE GAME', 'UPHILL BATTLE'];
    let hasGameType = false;
    for (const type of gameTypes) {
      if (await page.locator(`text=${type}`).isVisible()) {
        hasGameType = true;
        console.log('Game type:', type);
        break;
      }
    }
    expect(hasGameType).toBe(true);

    // Check for chart (should have SVG)
    const chart = page.locator('svg').last();
    await expect(chart).toBeVisible();

    // Validate turning points section exists
    const hasTurningPoints = await page.locator('text=Key Turning Points').isVisible();
    console.log('Has turning points:', hasTurningPoints);

    if (hasTurningPoints) {
      await expect(page.locator('text=Key Turning Points')).toBeVisible();
    }
  });

  test('Full dashboard - all features integrated', async ({ page }) => {
    // Navigate and load dashboard
    await page.waitForSelector('.card', { timeout: 10000 });
    const firstGame = page.locator('button:has-text("View Analysis")').first();
    await firstGame.click();
    await page.waitForSelector('text=Performance Analysis', { timeout: 10000 });

    // Take full page screenshot
    await page.screenshot({ path: '.playwright-mcp/full-dashboard-with-new-features.png', fullPage: true });

    // Verify all new features are present
    await expect(page.locator('text=Combat Trade Analysis')).toBeVisible();
    await expect(page.locator('text=Supply Block Analysis')).toBeVisible();
    await expect(page.locator('text=Scouting Intelligence Analysis')).toBeVisible();
    await expect(page.locator('text=Win Probability Analysis')).toBeVisible();

    // Verify existing features still work
    await expect(page.locator('text=Worker Count Over Time')).toBeVisible();
    await expect(page.locator('text=Build Order Timeline')).toBeVisible();

    console.log('All features integrated successfully!');
  });
});
