import { ethers } from "ethers";
import { getActiveMarkets } from "../index";

// Known active markets from Pendle Dapp (as of a specific date)
// You'll need to update these periodically
const KNOWN_ACTIVE_MARKETS = {
    mainnet: [
        {
            address: "0xcbA3B226cA62e666042Cb4a1e6E4681053885F75",
            ptSymbol: "PT-weETHs-26JUN2025",
            sySymbol: "SY-weETHs",
            expiry: "2025-06-26T00:00:00.000Z",
        },
        // Add more known markets here
    ],
} as const;

describe("Pendle Market Tests", () => {
    // Increase timeout for all tests in this describe block
    jest.setTimeout(60000);

    let provider: ethers.providers.JsonRpcProvider;

    beforeAll(() => {
        if (!process.env.RPC_URL) {
            throw new Error("RPC_URL environment variable is required");
        }
        provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    });

    afterAll(() => {
        // Clean up provider connections
        if (provider) {
            provider.removeAllListeners();
        }
    });

    describe("getActiveMarkets", () => {
        it("should fetch all known active markets on mainnet", async () => {
            const markets = await getActiveMarkets("mainnet", provider);

            // Check if all known markets are present
            for (const knownMarket of KNOWN_ACTIVE_MARKETS.mainnet) {
                const foundMarket = markets.find(
                    (m) =>
                        m.address.toLowerCase() ===
                        knownMarket.address.toLowerCase()
                );

                expect(foundMarket).toBeDefined();
                if (foundMarket) {
                    expect(foundMarket.PT.symbol).toBe(knownMarket.ptSymbol);
                    expect(foundMarket.SY.symbol).toBe(knownMarket.sySymbol);
                    expect(foundMarket.expiry).toBe(knownMarket.expiry);
                }
            }
        });

        it("should not return expired markets", async () => {
            const markets = await getActiveMarkets("mainnet", provider);
            const currentTimestamp = Math.floor(Date.now() / 1000);

            for (const market of markets) {
                expect(market.expiryTimestamp).toBeGreaterThan(
                    currentTimestamp
                );
            }
        });

        it("should return markets with valid token information", async () => {
            const markets = await getActiveMarkets("mainnet", provider);

            for (const market of markets) {
                // Check PT token info
                expect(market.PT.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
                expect(market.PT.symbol).toBeTruthy();
                expect(market.PT.name).toBeTruthy();

                // Check SY token info
                expect(market.SY.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
                expect(market.SY.symbol).toBeTruthy();
                expect(market.SY.name).toBeTruthy();

                // Check YT token info
                expect(market.YT.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
            }
        });

        it("should return markets with valid market state", async () => {
            const markets = await getActiveMarkets("mainnet", provider);

            for (const market of markets) {
                // Check market state values
                expect(market.marketState.reserveSy).toBeTruthy();
                expect(market.marketState.reservePt).toBeTruthy();
                expect(market.marketState.totalSupply).toBeTruthy();
                expect(market.marketState.scalarRoot).toBeTruthy();
                expect(market.marketState.impliedRate).toBeTruthy();
                expect(market.marketState.observationIndex).toBeTruthy();
                expect(market.marketState.lnFeeRateRoot).toBeTruthy();
            }
        });
    });
});
