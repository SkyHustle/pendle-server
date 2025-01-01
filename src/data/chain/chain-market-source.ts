import { ethers } from "ethers";
import { Market, Token, MarketState } from "../../core/types/market";
import { MarketDataSource } from "../../core/types/data-source";
import {
    MARKET_ABI,
    ERC20_ABI,
    FACTORY_ABI,
    FACTORY_ADDRESSES,
} from "./constants";

export class ChainMarketSource implements MarketDataSource {
    private provider: ethers.providers.Provider;

    constructor(rpcUrl?: string) {
        if (!rpcUrl) {
            if (!process.env.RPC_URL) {
                throw new Error("Please set RPC_URL in .env file");
            }
            rpcUrl = process.env.RPC_URL;
        }
        this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    }

    getName(): string {
        return "Chain Market Source";
    }

    getVersion(): string {
        return "V5";
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async getTokenInfo(tokenAddress: string): Promise<Token> {
        try {
            const token = new ethers.Contract(
                tokenAddress,
                ERC20_ABI,
                this.provider
            );
            const [name, symbol] = await Promise.all([
                token.name().catch(() => "Unknown"),
                token.symbol().catch(() => "???"),
            ]);
            return { address: tokenAddress, name, symbol };
        } catch (error) {
            console.error(
                `Error fetching token info for ${tokenAddress}:`,
                error
            );
            return { address: tokenAddress, name: "Unknown", symbol: "???" };
        }
    }

    private async getMarketDetails(
        marketAddress: string
    ): Promise<Market | null> {
        try {
            const market = new ethers.Contract(
                marketAddress,
                MARKET_ABI,
                this.provider
            );

            const [
                tokens,
                expiry,
                reserves,
                totalSupply,
                factoryAddress,
                scalarRoot,
                impliedRate,
                observationIndex,
                lnFeeRateRoot,
            ] = await Promise.all([
                market.readTokens().catch(() => null),
                market.expiry().catch(() => null),
                market.getReserves().catch(() => null),
                market.totalSupply().catch(() => null),
                market.factory().catch(() => null),
                market.scalarRoot().catch(() => null),
                market.getImpliedRate().catch(() => null),
                market.observationIndex().catch(() => null),
                market.lnFeeRateRoot().catch(() => null),
            ]);

            if (!tokens || !expiry) {
                return null;
            }

            const currentTimestamp = Math.floor(Date.now() / 1000);
            if (expiry.toNumber() <= currentTimestamp) {
                return null;
            }

            const [SY, PT, YT] = tokens;
            const [reserveSy, reservePt] = reserves || [
                ethers.BigNumber.from(0),
                ethers.BigNumber.from(0),
            ];

            const [ptInfo, syInfo] = await Promise.all([
                this.getTokenInfo(PT),
                this.getTokenInfo(SY),
            ]);

            const marketState: MarketState = {
                reserveSy: reserveSy.toString(),
                reservePt: reservePt.toString(),
                totalSupply: totalSupply ? totalSupply.toString() : "0",
                scalarRoot: scalarRoot ? scalarRoot.toString() : "0",
                impliedRate: impliedRate ? impliedRate.toString() : "0",
                observationIndex: observationIndex
                    ? observationIndex.toString()
                    : "0",
                lnFeeRateRoot: lnFeeRateRoot ? lnFeeRateRoot.toString() : "0",
            };

            return {
                address: marketAddress,
                factory: factoryAddress,
                PT: ptInfo,
                YT: { address: YT },
                SY: syInfo,
                expiry: new Date(expiry.toNumber() * 1000).toISOString(),
                expiryTimestamp: expiry.toNumber(),
                timeUntilExpiry: `${Math.floor(
                    (expiry.toNumber() - currentTimestamp) / (24 * 60 * 60)
                )} days`,
                marketState,
                chain: "ethereum", // Default to ethereum for now
            };
        } catch (error) {
            console.error("Error fetching market details:", error);
            return null;
        }
    }

    async getActiveMarkets(
        chain: keyof typeof FACTORY_ADDRESSES = "mainnet"
    ): Promise<Market[]> {
        const factory = new ethers.Contract(
            FACTORY_ADDRESSES[chain],
            FACTORY_ABI,
            this.provider
        );

        const latestBlock = await this.provider.getBlockNumber();
        const fromBlock = latestBlock - 1_368_000; // Look back ~190 days

        const filter = factory.filters.CreateNewMarket();
        const events = await factory.queryFilter(filter, fromBlock);

        // Process markets in batches of 5
        const BATCH_SIZE = 5;
        const batches = [];
        for (let i = 0; i < events.length; i += BATCH_SIZE) {
            batches.push(events.slice(i, i + BATCH_SIZE));
        }

        const marketDetails = [];
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];

            try {
                const batchResults = await Promise.all(
                    batch.map(async (event) => {
                        try {
                            return await this.getMarketDetails(
                                event.args?.market
                            );
                        } catch (err) {
                            const error = err as Error;
                            if (error.message.includes("rate limit")) {
                                await this.delay(2000);
                                return await this.getMarketDetails(
                                    event.args?.market
                                );
                            }
                            return null;
                        }
                    })
                );
                marketDetails.push(...batchResults);
            } catch (err) {
                const error = err as Error;
                console.error(
                    `Error processing batch ${i + 1}:`,
                    error.message
                );
            }

            if (i < batches.length - 1) {
                await this.delay(1000);
            }
        }

        return marketDetails
            .filter((market): market is Market => market !== null)
            .sort((a, b) => a.expiryTimestamp - b.expiryTimestamp);
    }
}
