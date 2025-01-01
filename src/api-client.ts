import axios, { AxiosError } from "axios";

const API_BASE_URL = "https://api-v2.pendle.finance/core";

export interface MarketData {
    name: string;
    address: string;
    expiry: string;
    pt: string;
    yt: string;
    sy: string;
    underlyingAsset: string;
}

/**
 * Fetches all active Pendle V1 markets for a given chain
 * For V5 markets, use the on-chain implementation in index.ts
 */
export async function getActiveMarkets(
    chainId: number = 1
): Promise<MarketData[]> {
    try {
        const response = await axios.get(
            `${API_BASE_URL}/v1/${chainId}/markets/active`
        );
        return response.data.markets;
    } catch (error) {
        if (error instanceof AxiosError) {
            console.error(
                "API request failed:",
                error.response?.data || error.message
            );
        } else {
            console.error("Unexpected error:", error);
        }
        throw error;
    }
}

/**
 * Fetches details for a specific Pendle V1 market
 * For V5 markets, use the on-chain implementation in index.ts
 */
export async function getMarketData(
    marketAddress: string,
    chainId: number = 1
): Promise<MarketData> {
    try {
        const response = await axios.get(
            `${API_BASE_URL}/v1/${chainId}/markets/${marketAddress}`
        );
        return response.data;
    } catch (error) {
        if (error instanceof AxiosError) {
            console.error(
                "API request failed:",
                error.response?.data || error.message
            );
        } else {
            console.error("Unexpected error:", error);
        }
        throw error;
    }
}

// Example usage
async function main() {
    try {
        console.log("Fetching active Pendle V1 markets via API...\n");
        const markets = await getActiveMarkets();

        console.log(`Found ${markets.length} active V1 markets\n`);

        // Calculate days until expiry for each market
        const marketsWithDays = markets.map((market) => {
            const expiryDate = new Date(market.expiry);
            const now = new Date();
            const daysUntilExpiry = Math.ceil(
                (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );
            return {
                name: market.name,
                daysUntilExpiry,
            };
        });

        // Sort by days until expiry
        marketsWithDays.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

        // Display all markets
        console.log("All active markets (sorted by days until expiry):");
        console.log("---------------------------------------------");
        marketsWithDays.forEach((market) => {
            console.log(
                `${market.name.padEnd(20)} | ${
                    market.daysUntilExpiry
                } days until expiry`
            );
        });
    } catch (error) {
        if (error instanceof AxiosError) {
            console.error("API Error:", error.response?.data || error.message);
        } else if (error instanceof Error) {
            console.error("Error:", error.message);
        } else {
            console.error("Unknown error:", error);
        }
    }
}

if (require.main === module) {
    main();
}
