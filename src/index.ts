import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// Simplified Market ABI with just the essential functions
const MARKET_ABI = [
    "function readTokens() external view returns (address _SY, address _PT, address _YT)",
    "function expiry() view returns (uint256)",
    "function isExpired() view returns (bool)",
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

        // Get basic market info
        const [tokens, expiry] = await Promise.all([
            market.readTokens().catch(() => null),
            market.expiry().catch(() => null),
        ]);

        if (!tokens || !expiry) {
            return null;
        }

        const currentTimestamp = Math.floor(Date.now() / 1000);
        if (expiry.toNumber() <= currentTimestamp) {
            return null;
        }

        const [SY, PT, YT] = tokens;

        // Get token information
        const [ptInfo, syInfo] = await Promise.all([
            getTokenInfo(PT, provider),
            getTokenInfo(SY, provider),
        ]);

        return {
            address: marketAddress,
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
            timeUntilExpiry: `${Math.floor((expiry.toNumber() - currentTimestamp) / (24 * 60 * 60))} days`,
        };
    } catch (error) {
        return null;
    }
}

async function getActiveMarkets(network: keyof typeof FACTORY_ADDRESSES) {
    if (!process.env.RPC_URL) {
        throw new Error("Please set RPC_URL in .env file");
    }

    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const factory = new ethers.Contract(
        FACTORY_ADDRESSES[network],
        FACTORY_ABI,
        provider
    );

    // Calculate block range for last 180 days
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = latestBlock - 1_368_000; // Look back ~190 days

    const filter = factory.filters.CreateNewMarket();
    console.log(`Fetching market creation events...`);
    const events = await factory.queryFilter(filter, fromBlock);

    console.log(`Processing ${events.length} markets...`);

    // Get all market details in parallel
    const marketDetails = await Promise.all(
        events.map((event) => getMarketDetails(event.args?.market, provider))
    );

    // Filter out null results and sort by expiry
    const activeMarkets = marketDetails
        .filter((market) => market !== null)
        .sort((a, b) => a!.expiryTimestamp - b!.expiryTimestamp);

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

        console.log(`\nFound ${markets.length} active markets:`);
        markets.forEach((market, index) => {
            console.log(`\n${index + 1}.`);
            console.log(market);
        });
    } catch (error) {
        console.error("Error:", error);
    }
}

main();
