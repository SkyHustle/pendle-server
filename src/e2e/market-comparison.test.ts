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

function log(message: string) {
    console.log(message);
    testOutput.push(message);
}

function normalizeAddress(address: string | undefined): string {
    return address?.split("?")?.[0]?.toLowerCase() || "";
}

test.describe("Pendle markets comparison", () => {
    test.afterAll(async () => {
        fs.writeFileSync("test-results/test-output.txt", testOutput.join("\n"));
    });

    test("fetch all markets from web page", async ({ page }) => {
        testOutput = [];

        // Navigate and wait for initial load
        await page.goto("https://app.pendle.finance/pro/markets");

        // Wait for the first market row to be visible and clickable
        await page.waitForSelector("pp-tr", {
            state: "visible",
            timeout: 10000,
        });

        // Click "Show All" and wait for new markets to load
        await page.getByText("Show All").click();

        // Wait for the market list to stabilize (no new items being added)
        let previousCount = 0;
        let currentCount = 0;
        let stabilityCounter = 0;

        while (stabilityCounter < 2) {
            await page.waitForTimeout(200);
            currentCount = await page.locator("pp-tr").count();

            if (currentCount === previousCount) {
                stabilityCounter++;
            } else {
                stabilityCounter = 0;
            }

            previousCount = currentCount;
        }

        // Get all rows at once
        const rows = await page.$$("pp-tr");
        log(`Found ${rows.length} market rows on web page`);

        // Process all rows in parallel
        const marketPromises = rows.map(async (row) => {
            try {
                // Get all data in parallel using $eval for type safety
                const [name, expiry, days, links] = await Promise.all([
                    row.$eval(".font-bold", (el) => el.textContent || ""),
                    row.$eval(
                        ".text-water-300[title]",
                        (el) => el.getAttribute("title") || ""
                    ),
                    row.$eval(
                        ".text-water-400 span",
                        (el) => el.textContent || ""
                    ),
                    row.$$("a[href*='/trade/']"),
                ]);

                // Process addresses in parallel with proper typing
                const addresses = await Promise.all(
                    links.map(async (link) => {
                        const [href, type] = await Promise.all([
                            link.getAttribute("href"),
                            link.textContent(),
                        ]);
                        return {
                            href: href || "",
                            type: type || "",
                        };
                    })
                );

                let ytAddress = "",
                    ptAddress = "",
                    lpAddress = "";

                addresses.forEach(({ href, type }) => {
                    const address = href.split("/").pop() || "";
                    if (type?.includes("YT")) ytAddress = address;
                    else if (type?.includes("PT")) ptAddress = address;
                    else if (type?.includes("LP")) lpAddress = address;
                });

                if (name) {
                    const chain =
                        ytAddress?.match(/chain=([^&]+)/)?.[1] ||
                        ptAddress?.match(/chain=([^&]+)/)?.[1] ||
                        "unknown";

                    const cleanYtAddress = ytAddress?.split("?")?.[0] || "";
                    const cleanPtAddress = ptAddress?.split("?")?.[0] || "";

                    const marketInfo: MarketInfo = {
                        name: name.trim(),
                        expiry,
                        daysUntilExpiry: days.trim(),
                        ytAddress,
                        ptAddress,
                        lpAddress,
                        chain,
                    };

                    log(
                        `Market: ${name.trim()}, Expiry: ${expiry}, Days: ${days.trim()}`
                    );
                    log(`  YT: ${cleanYtAddress}`);
                    log(`  PT: ${cleanPtAddress}`);
                    log(`  LP: `);
                    log(`  Chain: ${chain}`);
                    log("");

                    return marketInfo;
                }
            } catch (error) {
                log(`Error extracting data from row: ${error}`);
                return null;
            }
        });

        const markets = (await Promise.all(marketPromises)).filter(
            (m): m is MarketInfo => m !== null
        );
        webMarkets = markets;
    });

    test("compare V1 markets from API with web markets", async () => {
        // Fetch API markets in parallel with web markets processing
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
            log(`  YT: ${normalizeAddress(market.ytAddress)}`);
            log(`  PT: ${normalizeAddress(market.ptAddress)}`);
            log(`  LP: `);
            log(`  Chain: ${market.chain}`);
            log("");
        });
    });
});
