import { PendleMarket, contracts } from "@pendle/sdk";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

async function getActiveMarketsWithSDK() {
    // Make sure you have RPC_URL in your .env file
    if (!process.env.RPC_URL) {
        throw new Error("RPC_URL environment variable is required");
    }

    // Initialize provider
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);

    try {
        // Get Ethereum mainnet contracts
        const mainnetContracts = contracts.MAINNET;

        // Create a market instance to query factory
        const market = new PendleMarket(
            mainnetContracts.MARKET_FACTORY,
            provider
        );

        // Get all markets from the factory
        const markets = await market.getAllMarkets();

        console.log(`Found ${markets.length} active markets\n`);

        // Display market details
        for (const marketAddress of markets) {
            const marketInstance = new PendleMarket(marketAddress, provider);
            console.log(`Market:`);
            console.log(`Address: ${marketAddress}`);

            try {
                const tokens = await marketInstance.tokens();
                console.log(`Tokens:`);
                console.log(`  Token0: ${tokens[0]}`);
                console.log(`  Token1: ${tokens[1]}`);
            } catch (err) {
                console.log("Could not fetch token addresses");
            }

            console.log("------------------------\n");
        }
    } catch (error) {
        console.error("Error fetching markets:", error);
    }
}

// Run the example
getActiveMarketsWithSDK().catch(console.error);
