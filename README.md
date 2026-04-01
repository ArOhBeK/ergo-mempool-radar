# Ergo Mempool Radar 📡

Real-time web dashboard that polls the Ergo Explorer mempool API to visualize pending transactions, fee distribution, and whale activity.

## Features

- **Live mempool polling** — refreshes every 15 seconds via Ergo Explorer API
- **Whale Alerts feed** — flags large pending transactions with on-chain commentary
- **Fee histogram** — visualizes fee distribution across pending txs
- **Ticker bar** — shows current ERG price, block height, and pending tx count
- **Radar scan animation** — animated sweep overlay for that radar feel

## Usage

Open `index.html` in any modern browser. No build step, no dependencies, no API key required.

## Stack

Pure HTML / CSS / JS — single page, no frameworks.

Data sourced from the public [Ergo Explorer API](https://api.ergoplatform.com).
