# Pendle Server

This project contains automated tests and utilities for verifying the consistency between Pendle's V1 markets API and the markets displayed on [app.pendle.finance](https://app.pendle.finance).

## Purpose

The main functionality includes:

-   Fetching and comparing V1 markets from the Pendle API with markets displayed on the web interface
-   Focusing on Ethereum chain markets
-   Verifying market details including names, addresses, and expiry dates
-   Logging detailed comparison results for analysis

## Architecture

The project is organized into several layers:

### Core Layer (`src/core/`)

-   Contains the core business logic and types
-   Includes market interfaces and shared utilities
-   Chain-agnostic code that can be reused across different implementations

### Data Layer (`src/data/`)

-   Different implementations for fetching market data:
    -   `chain/`: Direct blockchain interaction using ethers.js
    -   `api/`: REST API client implementation
    -   Common interfaces for data sources

### Tests (`src/tests/`)

-   `e2e/`: End-to-end tests comparing different data sources
-   `integration/`: Tests for individual data sources
-   `unit/`: Unit tests for core business logic

## Setup

### Prerequisites

-   Node.js (latest LTS version recommended)
-   pnpm (package manager)
-   Git

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd pendle-server
```

2. Install dependencies:

```bash
pnpm install
```

3. Install Playwright browsers:

```bash
pnpm exec playwright install
```

## Running Tests

To run the market comparison tests:

```bash
pnpm exec playwright test
```

The tests will:

1. Fetch all markets from app.pendle.finance/pro/markets
2. Retrieve V1 markets from the Pendle API
3. Compare the markets and generate detailed logs
4. Save test results in the `test-results` directory

## Project Structure

```
pendle-server/
├── src/
│   ├── core/           # Core business logic and types
│   │   ├── types/     # Shared type definitions
│   │   └── utils/     # Shared utilities
│   ├── data/          # Data access layer
│   │   ├── chain/     # Blockchain interaction (ethers.js)
│   │   └── api/       # REST API client
│   └── tests/         # All tests
│       ├── e2e/       # End-to-end tests
│       ├── integration/ # Integration tests
│       └── unit/      # Unit tests
├── test-results/      # Test outputs and screenshots (git-ignored)
├── playwright.config.ts # Playwright configuration
└── package.json       # Project dependencies and scripts
```

## Test Output

Test results are saved in `test-results/test-output.txt` and include:

-   Total number of markets found
-   Detailed market information (names, expiry dates, addresses)
-   Comparison results between API and web markets
-   List of markets unique to either source

## Configuration

The project uses Playwright for end-to-end testing. Configuration can be found in `playwright.config.ts`, including:

-   Test timeouts
-   Screenshot settings
-   Test output directory
-   Browser settings

## Notes

-   The tests are optimized for performance and run in approximately 50 seconds
-   Only Ethereum chain markets are compared with V1 markets from the API
-   Screenshots and test artifacts are saved in the `test-results` directory (git-ignored)
