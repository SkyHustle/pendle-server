import { test } from "@playwright/test";
import { getActiveMarkets } from "../api-client";

test("count market rows and extract names", async ({ page }) => {
    // Navigate to the markets page
    await page.goto("https://app.pendle.finance/pro/markets");

    // Wait for content to load
    await page.waitForSelector("pp-tr", { timeout: 10000 });
    await page.screenshot({ path: "markets-page.png", fullPage: true });

    // Get all market rows
    const rows = await page.$$("pp-tr");
    console.log(`Found ${rows.length} market rows`);

    // Extract market names and expiry dates
    for (const row of rows) {
        try {
            // Get market name from the first cell's div structure
            const nameDiv = await row.$(".font-bold");
            const name = await nameDiv?.textContent();

            // Get expiry date from the span with title attribute
            const expirySpan = await row.$(".text-water-300[title]");
            const expiry = await expirySpan?.getAttribute("title");

            // Get days until expiry
            const daysSpan = await row.$(".text-water-400 span");
            const days = await daysSpan?.textContent();

            if (name) {
                console.log(
                    `Market: ${name.trim()}, Expiry: ${expiry}, Days: ${days?.trim()}`
                );
            }
        } catch (error) {
            console.error("Error extracting data from row:", error);
        }
    }
});
