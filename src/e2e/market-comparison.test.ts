import { test } from "@playwright/test";
import { getActiveMarkets } from "../api-client";
import * as fs from "fs";

interface MarketInfo {
    name: string;
    expiry: string;
    daysUntilExpiry: string;
    ytAddress?: string;
    ptAddress?: string;
    lpAddress?: string;
    chain: string;
}

let webMarkets: MarketInfo[] = [];
let testOutput: string[] = [];

// Helper function to log both to console and to our output array
function log(message: string) {
    console.log(message);
    testOutput.push(message);
}

// Helper function to normalize addresses for comparison
function normalizeAddress(address: string | undefined): string {
    return address?.split("?")?.[0]?.toLowerCase() || "";
}

test.describe("Pendle markets comparison", () => {
    test.afterAll(async () => {
        // Write all output to a file
        fs.writeFileSync("test-results/test-output.txt", testOutput.join("\n"));
    });

    test("fetch all markets from web page", async ({ page }) => {
        // Reset output array at the start of tests
        testOutput = [];

        await page.goto("https://app.pendle.finance/pro/markets");
        await page.waitForSelector("pp-tr", { timeout: 10000 });

        const showAllButton = await page.getByText("Show All");
        await showAllButton.click();

        await page.waitForTimeout(5000);
        await page.screenshot({
            path: "test-results/markets-page.png",
            fullPage: true,
        });

        const rows = await page.$$("pp-tr");
        log(`Found ${rows.length} market rows on web page`);

        for (const row of rows) {
            try {
                const nameDiv = await row.$(".font-bold");
                const name = (await nameDiv?.textContent()) || "";

                const expirySpan = await row.$(".text-water-300[title]");
                const expiry = (await expirySpan?.getAttribute("title")) || "";

                const daysSpan = await row.$(".text-water-400 span");
                const days = (await daysSpan?.textContent()) || "";

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
                    const chain =
                        ytAddress?.match(/chain=([^&]+)/)?.[1] ||
                        ptAddress?.match(/chain=([^&]+)/)?.[1] ||
                        "unknown";

                    const cleanYtAddress = ytAddress?.split("?")?.[0] || "";
                    const cleanPtAddress = ptAddress?.split("?")?.[0] || "";

                    webMarkets.push({
                        name: name.trim(),
                        expiry,
                        daysUntilExpiry: days.trim(),
                        ytAddress,
                        ptAddress,
                        lpAddress,
                        chain,
                    });
                    log(
                        `Market: ${name.trim()}, Expiry: ${expiry}, Days: ${days.trim()}`
                    );
                    log(`  YT: ${cleanYtAddress}`);
                    log(`  PT: ${cleanPtAddress}`);
                    log(`  LP: `);
                    log(`  Chain: ${chain}`);
                    log("");
                }
            } catch (error) {
                log(`Error extracting data from row: ${error}`);
            }
        }
    });

    test("compare V1 markets from API with web markets", async () => {
        const apiMarkets = await getActiveMarkets();
        log(`Found ${apiMarkets.length} V1 markets from API`);

        const ethereumMarkets = webMarkets.filter(
            (market) => market.chain === "ethereum"
        );
        log(
            `Found ${ethereumMarkets.length} Ethereum chain markets on web page`
        );

        const apiMarketsByAddress = new Map(
            apiMarkets.map((market) => [market.address.toLowerCase(), market])
        );

        const v1MarketsOnWeb = ethereumMarkets.filter((webMarket) => {
            const ytAddress = normalizeAddress(webMarket.ytAddress);
            const ptAddress = normalizeAddress(webMarket.ptAddress);
            return (
                apiMarketsByAddress.has(ytAddress) ||
                apiMarketsByAddress.has(ptAddress)
            );
        });

        log("\nMarket Comparison Summary:");
        log(`Total Ethereum markets on web page: ${ethereumMarkets.length}`);
        log(`Total V1 markets from API: ${apiMarkets.length}`);
        log(`V1 markets found on web page: ${v1MarketsOnWeb.length}`);

        log("\nV1 Markets found on web page:");
        v1MarketsOnWeb.forEach((market) => {
            const ytAddress = normalizeAddress(market.ytAddress);
            const ptAddress = normalizeAddress(market.ptAddress);
            const apiMarket =
                apiMarketsByAddress.get(ytAddress) ||
                apiMarketsByAddress.get(ptAddress);
            log(`- ${market.name}`);
            log(`  Web Expiry: ${market.expiry}`);
            log(`  Days until expiry: ${market.daysUntilExpiry}`);
            log(`  API Address: ${apiMarket?.address}`);
            log(`  Web Addresses:`);
            log(`    YT: ${ytAddress}`);
            log(`    PT: ${ptAddress}`);
            log(`    LP: `);
            log(`  Chain: ${market.chain}`);
            log("");
        });

        const webAddresses = new Set(
            ethereumMarkets.flatMap((m) => [
                normalizeAddress(m.ytAddress),
                normalizeAddress(m.ptAddress),
            ])
        );

        const missingFromWeb = Array.from(apiMarketsByAddress.values()).filter(
            (market) => !webAddresses.has(market.address.toLowerCase())
        );

        log("\nV1 Markets in API but not found on web page:");
        missingFromWeb.forEach((market) => {
            log(`- ${market.name}`);
            log(`  Expiry: ${market.expiry}`);
            log(`  Address: ${market.address}`);
            log("");
        });

        // Find web markets that are not V1 markets
        const nonV1Markets = ethereumMarkets.filter((web) => {
            const ytAddress = normalizeAddress(web.ytAddress);
            const ptAddress = normalizeAddress(web.ptAddress);
            return (
                !apiMarketsByAddress.has(ytAddress) &&
                !apiMarketsByAddress.has(ptAddress)
            );
        });

        log("\nEthereum chain markets that are not V1 markets:");
        nonV1Markets.forEach((market) => {
            log(`- ${market.name}`);
            log(`  Expiry: ${market.expiry}`);
            log(`  YT: ${market.ytAddress}`);
            log(`  PT: ${market.ptAddress}`);
            log(`  LP: ${market.lpAddress}`);
            log("");
        });
    });
});
