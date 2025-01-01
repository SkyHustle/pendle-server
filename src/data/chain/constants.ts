// Simplified Market ABI with just the essential functions
export const MARKET_ABI = [
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
export const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
];

// ABI for the PendleMarketFactoryV3 contract
export const FACTORY_ABI = [
    "function isValidMarket(address market) external view returns (bool)",
    "event CreateNewMarket(address indexed market, address indexed PT, int256 scalarRoot, int256 initialAnchor, uint256 lnFeeRateRoot)",
];

// Replace with actual addresses for different networks (using V5 factories)
export const FACTORY_ADDRESSES = {
    mainnet: "0x6fcf753f2C67b83f7B09746Bbc4FA0047b35D050", // Ethereum mainnet V5
    arbitrum: "0xd29e76c6F15ada0150D10A1D3f45aCCD2098283B", // Arbitrum V5
    base: "0x59968008a703dC13E6beaECed644bdCe4ee45d13", // Base V5
    bnb: "0x7C7f73f7a320364DBB3C9aAa9bCcd402040EE0f9", // BNB Chain V5
} as const;
