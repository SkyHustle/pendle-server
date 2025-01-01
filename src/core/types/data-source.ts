import { Market } from "./market";

export interface MarketDataSource {
    getActiveMarkets(chain?: string): Promise<Market[]>;
    getName(): string;
    getVersion(): string;
}
