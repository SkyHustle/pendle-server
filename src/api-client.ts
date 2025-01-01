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
        console.log("Fetching active Pendle markets via API...\n");
        const markets = await getActiveMarkets();

        console.log(`Found ${markets.length} active markets`);

        if (markets.length > 0) {
            console.log("\nFirst market details:");
            const firstMarket = markets[0];
            console.log({
                name: firstMarket.name,
                address: firstMarket.address,
                expiry: firstMarket.expiry,
                pt: firstMarket.pt,
                yt: firstMarket.yt,
                sy: firstMarket.sy,
                underlyingAsset: firstMarket.underlyingAsset,
            });
        }
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
