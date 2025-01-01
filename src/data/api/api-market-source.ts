import { Market } from "../../core/types/market";
import { MarketDataSource } from "../../core/types/data-source";

export class ApiMarketSource implements MarketDataSource {
    private baseUrl: string;

    constructor(baseUrl: string = "https://api.pendle.finance/v1") {
        this.baseUrl = baseUrl;
    }

    getName(): string {
        return "Pendle API";
    }

    getVersion(): string {
        return "V1";
    }

    async getActiveMarkets(chain?: string): Promise<Market[]> {
        try {
            const response = await fetch(`${this.baseUrl}/markets`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const markets: Market[] = await response.json();

            // Filter by chain if specified
            if (chain) {
                return markets.filter(
                    (market) =>
                        market.chain.toLowerCase() === chain.toLowerCase()
                );
            }

            return markets;
        } catch (error) {
            console.error("Error fetching markets from API:", error);
            return [];
        }
    }
}
