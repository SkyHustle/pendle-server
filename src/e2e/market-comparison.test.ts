import { test } from "@playwright/test";
import { getActiveMarkets } from "../api-client";

interface MarketInfo {
    name: string;
    expiry: string;
    daysUntilExpiry: string;
}

let webMarkets: MarketInfo[] = [];

test.describe("Pendle markets comparison", () => {
    test("fetch all markets from web page", async ({ page }) => {
        // Navigate to the markets page
        await page.goto("https://app.pendle.finance/pro/markets");

        // Wait for content to load
        await page.waitForSelector("pp-tr", { timeout: 10000 });

        // Click "Show All" button
        const showAllButton = await page.getByText("Show All");
        await showAllButton.click();

        // Wait for additional markets to load
        await page.waitForTimeout(2000);
        await page.screenshot({ path: "markets-page.png", fullPage: true });

        // Get all market rows
        const rows = await page.$$("pp-tr");
        console.log(`Found ${rows.length} market rows on web page`);

        // Extract market names and expiry dates
        for (const row of rows) {
            try {
                // Get market name from the first cell's div structure
                const nameDiv = await row.$(".font-bold");
                const name = (await nameDiv?.textContent()) || "";

                // Get expiry date from the span with title attribute
                const expirySpan = await row.$(".text-water-300[title]");
                const expiry = (await expirySpan?.getAttribute("title")) || "";

                // Get days until expiry
                const daysSpan = await row.$(".text-water-400 span");
                const days = (await daysSpan?.textContent()) || "";

                if (name) {
                    webMarkets.push({
                        name: name.trim(),
                        expiry,
                        daysUntilExpiry: days.trim(),
                    });
                    console.log(
                        `Market: ${name.trim()}, Expiry: ${expiry}, Days: ${days.trim()}`
                    );
                }
            } catch (error) {
                console.error("Error extracting data from row:", error);
            }
        }
    });

    test("compare V1 markets from API with web markets", async () => {
        // Get V1 markets from API
        const apiMarkets = await getActiveMarkets();
        console.log(`Found ${apiMarkets.length} V1 markets from API`);

        // Create a map of API markets by name for easier lookup
        const apiMarketsByName = new Map(
            apiMarkets.map((market) => [market.name, market])
        );

        // Find which V1 markets are shown on the web page
        const v1MarketsOnWeb = webMarkets.filter((webMarket) =>
            apiMarketsByName.has(webMarket.name)
        );

        console.log("\nMarket Comparison Summary:");
        console.log(`Total markets on web page: ${webMarkets.length}`);
        console.log(`Total V1 markets from API: ${apiMarkets.length}`);
        console.log(`V1 markets found on web page: ${v1MarketsOnWeb.length}`);

        // Log V1 markets found on web page with their details
        console.log("\nV1 Markets found on web page:");
        v1MarketsOnWeb.forEach((market) => {
            const apiMarket = apiMarketsByName.get(market.name);
            console.log(`- ${market.name}`);
            console.log(`  Web Expiry: ${market.expiry}`);
            console.log(`  Days until expiry: ${market.daysUntilExpiry}`);
            console.log(`  API Address: ${apiMarket?.address}`);
            console.log();
        });

        // Log V1 markets that are in API but not on web page
        const missingFromWeb = Array.from(apiMarketsByName.entries())
            .filter(
                ([name]) => !v1MarketsOnWeb.some((web) => web.name === name)
            )
            .map(([name]) => name);

        console.log("\nV1 Markets in API but not found on web page:");
        missingFromWeb.forEach((name) => console.log(`- ${name}`));

        // Log web markets that are not V1 markets
        const nonV1Markets = webMarkets
            .filter((web) => !apiMarketsByName.has(web.name))
            .map((m) => m.name);

        console.log("\nWeb markets that are not V1 markets:");
        nonV1Markets.forEach((name) => console.log(`- ${name}`));
    });
});
