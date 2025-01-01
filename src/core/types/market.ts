export interface Token {
    address: string;
    name?: string;
    symbol?: string;
}

export interface MarketState {
    reserveSy: string;
    reservePt: string;
    totalSupply: string;
    scalarRoot: string;
    impliedRate: string;
    observationIndex: string;
    lnFeeRateRoot: string;
}

export interface Market {
    address: string;
    name: string;
    factory?: string;
    PT: Token;
    YT: Token;
    SY: Token;
    expiry: string;
    expiryTimestamp: number;
    timeUntilExpiry: string;
    marketState?: MarketState;
    chain: string;
}
