import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// Simplified Market ABI with just the essential functions
const MARKET_ABI = [
    "function readTokens() external view returns (address _SY, address _PT, address _YT)",
    "function expiry() view returns (uint256)",
    "function isExpired() view returns (bool)",
    "function getReserves() external view returns (uint256 reserveSy, uint256 reservePt)",
    "function totalSupply() external view returns (uint256)",
    "function factory() external view returns (address)",
    "function scalarRoot() external view returns (int256)",
    "function getImpliedRate() external view returns (int256)",
    "function observationIndex() external view returns (uint16)",
    "function lnFeeRateRoot() external view returns (uint256)",
];

// ABI for ERC20 token info
const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
];

// ABI for the PendleMarketFactoryV3 contract
const FACTORY_ABI = [
    "function isValidMarket(address market) external view returns (bool)",
    "event CreateNewMarket(address indexed market, address indexed PT, int256 scalarRoot, int256 initialAnchor, uint256 lnFeeRateRoot)",
];

// Replace with actual addresses for different networks (using V5 factories)
const FACTORY_ADDRESSES = {
    mainnet: "0x6fcf753f2C67b83f7B09746Bbc4FA0047b35D050", // Ethereum mainnet V5
    arbitrum: "0xd29e76c6F15ada0150D10A1D3f45aCCD2098283B", // Arbitrum V5
    base: "0x59968008a703dC13E6beaECed644bdCe4ee45d13", // Base V5
    bnb: "0x7C7f73f7a320364DBB3C9aAa9bCcd402040EE0f9", // BNB Chain V5
};

// Add this helper function for delay
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTokenInfo(
    tokenAddress: string,
    provider: ethers.providers.Provider
) {
    try {
        const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const [name, symbol] = await Promise.all([
            token.name().catch(() => "Unknown"),
            token.symbol().catch(() => "???"),
        ]);
        return { name, symbol };
    } catch (error) {
        console.error(`Error fetching token info for ${tokenAddress}:`, error);
        return { name: "Unknown", symbol: "???" };
    }
}

async function getMarketDetails(
    marketAddress: string,
    provider: ethers.providers.Provider
) {
    try {
        const market = new ethers.Contract(marketAddress, MARKET_ABI, provider);

        // Get all market info in parallel
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

        // Get token information
        const [ptInfo, syInfo] = await Promise.all([
            getTokenInfo(PT, provider),
            getTokenInfo(SY, provider),
        ]);

        return {
            address: marketAddress,
            factory: factoryAddress,
            PT: {
                address: PT,
                ...ptInfo,
            },
            YT: {
                address: YT,
            },
            SY: {
                address: SY,
                ...syInfo,
            },
            expiry: new Date(expiry.toNumber() * 1000).toISOString(),
            expiryTimestamp: expiry.toNumber(),
            timeUntilExpiry: `${Math.floor(
                (expiry.toNumber() - currentTimestamp) / (24 * 60 * 60)
            )} days`,
            marketState: {
                reserveSy: reserveSy.toString(),
                reservePt: reservePt.toString(),
                totalSupply: totalSupply ? totalSupply.toString() : "0",
                scalarRoot: scalarRoot ? scalarRoot.toString() : "0",
                impliedRate: impliedRate ? impliedRate.toString() : "0",
                observationIndex: observationIndex
                    ? observationIndex.toString()
                    : "0",
                lnFeeRateRoot: lnFeeRateRoot ? lnFeeRateRoot.toString() : "0",
            },
        };
    } catch (error) {
        console.error("Error fetching market details:", error);
        return null;
    }
}

export async function getActiveMarkets(
    network: keyof typeof FACTORY_ADDRESSES,
    provider?: ethers.providers.Provider
) {
    if (!provider) {
        if (!process.env.RPC_URL) {
            throw new Error("Please set RPC_URL in .env file");
        }
        provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    }

    const factory = new ethers.Contract(
        FACTORY_ADDRESSES[network],
        FACTORY_ABI,
        provider
    );

    // Calculate block range for last 180 days
    const latestBlock = await provider.getBlockNumber();
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
                        return await getMarketDetails(
                            event.args?.market,
                            provider as ethers.providers.Provider
                        );
                    } catch (err) {
                        const error = err as Error;
                        if (error.message.includes("rate limit")) {
                            await delay(2000);
                            return await getMarketDetails(
                                event.args?.market,
                                provider as ethers.providers.Provider
                            );
                        }
                        return null;
                    }
                })
            );
            marketDetails.push(...batchResults);
        } catch (err) {
            const error = err as Error;
            console.error(`Error processing batch ${i + 1}:`, error.message);
        }

        // Add delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
            await delay(1000); // 1 second delay between batches
        }
    }

    // Filter out null results and sort by expiry
    const activeMarkets = marketDetails
        .filter(
            (market): market is NonNullable<typeof market> => market !== null
        )
        .sort((a, b) => a.expiryTimestamp - b.expiryTimestamp);

    return activeMarkets;
}

async function main() {
    try {
        console.log("Fetching active Pendle V5 markets...\n");
        const markets = await getActiveMarkets("mainnet");

        if (markets.length === 0) {
            console.log("\nNo active markets found.");
            return;
        }

        // Show total number of markets found
        console.log(`\nFound ${markets.length} active markets in total.`);

        console.log("\nFirst active market details:");
        const market = markets[0];

        console.log("\nBasic Information:");
        console.log("Market Address:", market.address);
        console.log("Factory:", market.factory);
        console.log("Expiry:", market.expiry);
        console.log("Time Until Expiry:", market.timeUntilExpiry);

        console.log("\nTokens:");
        console.log("PT:", {
            address: market.PT.address,
            name: market.PT.name,
            symbol: market.PT.symbol,
        });
        console.log("YT:", {
            address: market.YT.address,
        });
        console.log("SY:", {
            address: market.SY.address,
            name: market.SY.name,
            symbol: market.SY.symbol,
        });

        console.log("\nMarket State:");
        console.log("Reserves:");
        console.log(
            "  SY:",
            ethers.utils.formatEther(market.marketState.reserveSy),
            "tokens"
        );
        console.log(
            "  PT:",
            ethers.utils.formatEther(market.marketState.reservePt),
            "tokens"
        );
        console.log(
            "Total Supply:",
            ethers.utils.formatEther(market.marketState.totalSupply),
            "LP tokens"
        );
        console.log("Scalar Root:", market.marketState.scalarRoot);
        console.log("Implied Rate:", market.marketState.impliedRate);
        console.log("Observation Index:", market.marketState.observationIndex);
        console.log("Ln Fee Rate Root:", market.marketState.lnFeeRateRoot);
    } catch (error) {
        console.error("Error:", error);
    }
}

if (require.main === module) {
    main();
}
