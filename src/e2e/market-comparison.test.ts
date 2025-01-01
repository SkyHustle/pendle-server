import { test } from "@playwright/test";
import { getActiveMarkets } from "../api-client";

interface MarketInfo {
    name: string;
    expiry: string;
    daysUntilExpiry: string;
    ytAddress?: string;
    ptAddress?: string;
    lpAddress?: string;
}

let webMarkets: MarketInfo[] = [];

// Helper function to normalize addresses for comparison
function normalizeAddress(address: string | undefined): string {
    // Remove query parameters and convert to lowercase
    return address?.split("?")?.[0]?.toLowerCase() || "";
}

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

                // Extract market addresses from links
                const links = await row.$$("a[href*='/trade/']");
                let ytAddress = "",
                    ptAddress = "",
                    lpAddress = "";

                for (const link of links) {
                    const href = (await link.getAttribute("href")) || "";
                    const type = await link.textContent();
                    const address = href.split("/").pop() || "";

                    if (type?.includes("YT")) ytAddress = address;
                    else if (type?.includes("PT")) ptAddress = address;
                    else if (type?.includes("LP")) lpAddress = address;
                }

                if (name) {
                    webMarkets.push({
                        name: name.trim(),
                        expiry,
                        daysUntilExpiry: days.trim(),
                        ytAddress,
                        ptAddress,
                        lpAddress,
                    });
                    console.log(
                        `Market: ${name.trim()}, Expiry: ${expiry}, Days: ${days.trim()}`
                    );
                    console.log(`  YT: ${ytAddress}`);
                    console.log(`  PT: ${ptAddress}`);
                    console.log(`  LP: ${lpAddress}`);
                    console.log();
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

        // Create a map of API markets by address for easier lookup
        const apiMarketsByAddress = new Map(
            apiMarkets.map((market) => [market.address.toLowerCase(), market])
        );

        // Find which V1 markets are shown on the web page
        const v1MarketsOnWeb = webMarkets.filter((webMarket) => {
            const ytAddress = normalizeAddress(webMarket.ytAddress);
            const ptAddress = normalizeAddress(webMarket.ptAddress);
            return (
                apiMarketsByAddress.has(ytAddress) ||
                apiMarketsByAddress.has(ptAddress)
            );
        });

        console.log("\nMarket Comparison Summary:");
        console.log(`Total markets on web page: ${webMarkets.length}`);
        console.log(`Total V1 markets from API: ${apiMarkets.length}`);
        console.log(`V1 markets found on web page: ${v1MarketsOnWeb.length}`);

        // Log V1 markets found on web page with their details
        console.log("\nV1 Markets found on web page:");
        v1MarketsOnWeb.forEach((market) => {
            const ytAddress = normalizeAddress(market.ytAddress);
            const ptAddress = normalizeAddress(market.ptAddress);
            const apiMarket =
                apiMarketsByAddress.get(ytAddress) ||
                apiMarketsByAddress.get(ptAddress);
            console.log(`- ${market.name}`);
            console.log(`  Web Expiry: ${market.expiry}`);
            console.log(`  Days until expiry: ${market.daysUntilExpiry}`);
            console.log(`  API Address: ${apiMarket?.address}`);
            console.log(`  Web Addresses:`);
            console.log(`    YT: ${market.ytAddress}`);
            console.log(`    PT: ${market.ptAddress}`);
            console.log(`    LP: ${market.lpAddress}`);
            console.log();
        });

        // Log V1 markets that are in API but not on web page
        const webAddresses = new Set(
            webMarkets.flatMap((m) => [
                normalizeAddress(m.ytAddress),
                normalizeAddress(m.ptAddress),
            ])
        );

        const missingFromWeb = Array.from(apiMarketsByAddress.values()).filter(
            (market) => !webAddresses.has(market.address.toLowerCase())
        );

        console.log("\nV1 Markets in API but not found on web page:");
        missingFromWeb.forEach((market) => {
            console.log(`- ${market.name}`);
            console.log(`  Expiry: ${market.expiry}`);
            console.log(`  Address: ${market.address}`);
            console.log();
        });

        // Log web markets that are not V1 markets
        const nonV1Markets = webMarkets.filter((web) => {
            const ytAddress = normalizeAddress(web.ytAddress);
            const ptAddress = normalizeAddress(web.ptAddress);
            return (
                !apiMarketsByAddress.has(ytAddress) &&
                !apiMarketsByAddress.has(ptAddress)
            );
        });

        console.log("\nWeb markets that are not V1 markets:");
        nonV1Markets.forEach((market) => {
            console.log(`- ${market.name}`);
            console.log(`  Expiry: ${market.expiry}`);
            console.log(`  YT: ${market.ytAddress}`);
            console.log(`  PT: ${market.ptAddress}`);
            console.log(`  LP: ${market.lpAddress}`);
            console.log();
        });
    });
});
