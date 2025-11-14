<div align="center">

# ion-server-api

**Ultra-low latency Node.js TCP client for [IonTrader](https://iontrader.com)**  
Real-time market data, trade execution, balance & user management via TCP.

![npm](https://img.shields.io/npm/v/ion-server-api?color=green)
![Node.js](https://img.shields.io/badge/node-%3E%3D14-blue)
![License](https://img.shields.io/badge/license-MIT-blue)
![Downloads](https://img.shields.io/npm/dm/ion-server-api)

> **Server-to-Server (S2S) integration** — ideal for brokers, CRMs, HFT bots, and back-office systems.

[Documentation](https://iontrader.com/tcp) · [Examples](./example) · [Report Bug](https://github.com/iontrader/server-api-js/issues)

</div>

---

## Features

| Feature | Description |
|-------|-------------|
| **TCP S2S** | Direct TCP connection — no HTTP overhead |
| **Real-time Events** | Quotes, trades, balance, user & symbol updates |
| **Optimized Subscribe** | `platform.subscribe()` / `unsubscribe()` |
| **Dynamic Commands** | `platform.AddUser({})`, `platform.GetTrades()` |
| **Auto-reconnect** | Robust reconnection with backoff |
| **Event Filtering** | `ignoreEvents`, per-symbol listeners |
| **extID Tracking** | Reliable command responses |
| **JSON Repair** | Handles malformed packets gracefully |

---

## Installation

```bash
npm install ion-server-api
```

> **Required**: Configure `shortid` for safe `extID` generation:

```js
const shortid = require('shortid');
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');
```

---

## Quick Start

```js
const IONPlatform = require('ion-server-api');

// Initialize with minimal config
const platform = new IONPlatform(
  'broker.iontrader.com:8080', // Host:port
  'my-trading-bot',
  { autoSubscribe: ['EURUSD', 'BTCUSD'] },
  null, null,
  'your-jwt-auth-token'
);

// Real-time quotes
platform.emitter.on('quote', q => {
  console.log(`${q.symbol}: ${q.bid}/${q.ask}`);
});

// Trade events
platform.emitter.on('trade:event', e => {
  const d = e.data;
  console.log(`#${d.order} ${d.cmd === 0 ? 'BUY' : 'SELL'} ${d.volume} ${d.symbol}`);
});

// Subscribe to new symbol
platform.subscribe('XAUUSD');

// Create user
await platform.AddUser({
  name: 'John Doe',
  group: 'VIP',
  leverage: 500,
  email: 'john@example.com'
});

// Graceful shutdown
platform.destroy();
```

---

## Supported Events

| Event | Description | Example |
|------|-------------|--------|
| `quote` | Real-time tick | `{ symbol: 'EURUSD', bid: 1.085, ask: 1.086 }` |
| `quote:SYMBOL` | Per-symbol | `quote:EURUSD` |
| `notify` | System alerts | `notify:20` (warning) |
| `trade:event` | Order open/close/modify | `data.order`, `data.profit` |
| `balance:event` | Balance & margin update | `data.equity`, `data.margin_level` |
| `user:event` | User profile change | `data.leverage`, `data.group` |
| `symbol:event` | Symbol settings update | `data.spread`, `data.swap_long` |
| `group:event` | Group config change | `data.default_leverage` |
| `symbols:reindex` | Symbol index map | `[[symbol, sym_index, sort_index], ...]` |
| `security:reindex` | Security group map | `[[sec_index, sort_index], ...]` |

---

### Methods

| Method | Description |
|-------|-------------|
| `subscribe(channels)` | Fast subscribe to symbols |
| `unsubscribe(channels)` | Fast unsubscribe |
| `platform.CommandName(data)` | Dynamic command (e.g., `AddUser`) |
| `platform.send(payload)` | Legacy format: `{ command, data }` |
| `platform.destroy()` | Close connection |

---

## Examples

### Subscribe & Unsubscribe

```js
await platform.subscribe(['GBPUSD', 'USDJPY']);
await platform.unsubscribe('BTCUSD');
```

### Get All Users

```js
const users = await platform.GetUsers({});
console.log(users);
```

### Listen to Balance Changes

```js
platform.emitter.on('balance:event', e => {
  console.log(`User ${e.data.login}: Equity = ${e.data.equity}`);
});
```

### Full Example

See [`example/example.js`](./example/example.js)

---

## Configuration

| Option | Type | Default | Description |
|-------|------|---------|-------------|
| `autoSubscribe` | `string[]` | `[]` | Auto-subscribe on connect |
| `ignoreEvents` | `boolean` | `false` | Disable all event emission |
| `mode` | `'live' \| 'demo'` | `'live'` | Environment mode |

---

## Documentation

- **TCP API**: [https://iontrader.com/tcp](https://iontrader.com/tcp)
- **Client API**: [https://iontrader.com/client-api](https://iontrader.com/client-api)
- **FIX API**: [https://iontrader.com/fix-api](https://iontrader.com/fix-api)

---

## Requirements

- Node.js **v14 or higher**
- Valid **IonTrader JWT token**

---

## License

Distributed under the **MIT License**.  
See [`LICENSE`](LICENSE) for more information.

---

<div align="center">

**Made with passion for high-frequency trading**

[iontrader.com](https://iontrader.com) · [GitHub](https://github.com/iontrader/server-api-js)

</div>