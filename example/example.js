/**
 * IonTrader API Example
 * Demonstrates full event handling and subscribe/unsubscribe
 */

const IONPlatform = require('../index');
const shortid = require('shortid');
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');

const url = 'example.host:8080'; // Host and port for the ION platform
const name = 'ion-example'; // Platform name
const token = 'YOUR_TOKEN'; // Authentication token

const platform = new IONPlatform(
    url,
    name,
    {
        autoSubscribe: ['EURUSD', 'BTCUSD']
    },
    null,
    null,
    token
);

// === EVENTS ===
platform.emitter.on('quote', (q) => {
    console.log(`[QUOTE] ${q.symbol}: ${q.bid}/${q.ask}`);
});

platform.emitter.on('quote:EURUSD', (q) => {
    console.log(`[EURUSD] Bid: ${q.bid}`);
});

platform.emitter.on('notify', (n) => {
    const level = { 10: 'INFO', 20: 'WARN', 30: 'ERROR', 40: 'PROMO' }[n.level] || n.level;
    console.log(`[NOTIFY:${level}] ${n.message}`);
});

platform.emitter.on('trade:event', (e) => {
    const d = e.data;
    const cmd = d.cmd === 0 ? 'BUY' : d.cmd === 1 ? 'SELL' : 'UNKNOWN';
    console.log(`[TRADE #${d.order}] ${cmd} ${d.volume} ${d.symbol} @ ${d.open_price} (P&L: ${d.profit})`);
});

platform.emitter.on('balance:event', (e) => {
    const d = e.data;
    console.log(`[BALANCE] ${d.login} | Balance: ${d.balance} | Equity: ${d.equity} | Margin: ${d.margin_level}%`);
});

platform.emitter.on('user:event', (e) => {
    const d = e.data;
    console.log(`[USER] ${d.login} | ${d.name} | Group: ${d.group} | Leverage: ${d.leverage}`);
});

platform.emitter.on('symbols:reindex', (list) => {
    console.log(`[REINDEX] ${list.length} symbols updated`);
});

// === COMMANDS ===
setTimeout(async () => {
    if (!platform.connected) {
        console.error('Not connected');
        return;
    }

    try {
        // Optimized subscribe
        await platform.subscribe('GBPUSD');
        console.log('Subscribed to GBPUSD');

        // Create user
        const user = await platform.AddUser({
            group: "TestGroup",
            name: "John Doe",
            password: "pass123",
            leverage: 100,
            enable: 1,
            email: "john@example134412.com"
        });
        console.log('User created:', user);

        // Unsubscribe after 10s
        setTimeout(async () => {
            await platform.unsubscribe('BTCUSD');
            console.log('Unsubscribed from BTCUSD');
        }, 10000);

    } catch (err) {
        console.error('Command error:', err.message);
    }

    // Auto shutdown
    setTimeout(() => {
        console.log('Shutting down...');
        platform.destroy();
        process.exit(0);
    }, 30000);
}, 2000);