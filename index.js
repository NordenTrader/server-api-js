/**
 * ion-server-api
 * High-performance TCP client for IonTrader platform
 * Supports real-time quotes, trades, balance, user & symbol events
 */

const net = require('net');
const events = require('events');
const { jsonrepair } = require('jsonrepair');
const shortid = require('shortid');

// Configure shortid for safe extID generation
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');

const RECONNECT_DELAY_MS = 4000;
const RESPONSE_TIMEOUT_MS = 30000;
const AUTO_SUBSCRIBE_DELAY_MS = 500;
const SOCKET_KEEPALIVE = true;
const SOCKET_NODELAY = true;

class IONPlatform {
    /**
     * Create a new IONPlatform instance
     * @param {string} url - Host and port (e.g., 'host:8080')
     * @param {string} name - Identifier for logging
     * @param {Object} [options={}] - Configuration
     * @param {Array<string>} [options.autoSubscribe=[]] - Auto-subscribe channels
     * @param {boolean} [options.ignoreEvents=false] - Disable event emission
     * @param {string} [options.prefix='ion'] - Event prefix
     * @param {string} [options.mode='live'] - 'live' || 'demo' || ...
     * @param {Object} [broker={}] - Optional broker
     * @param {Object} [ctx={}] - Optional context
     * @param {string} token - JWT authentication token
     * @param {EventEmitter} [emitter=null] - Custom EventEmitter
     */
    constructor(url, name, options = {}, broker, ctx, token, emitter = null) {
        this.name = name;
        this.url = url;
        this.errorCount = 0;
        this.broker = broker || {};
        this.ctx = ctx || {};
        this.ignoreEvents = options.ignoreEvents || false;
        this.prefix = options.prefix || 'ion';
        this.mode = options.mode || 'live';
        this.token = token;
        this.emitter = emitter || new events.EventEmitter();
        this.autoSubscribeChannels = Array.isArray(options.autoSubscribe) ? options.autoSubscribe : [];
        this.seenNotifyTokens = new Set();

        this.createSocket();

        // Return proxy for dynamic command calls
        return new Proxy(this, {
            get: (target, prop) => {
                if (prop in target) return Reflect.get(target, prop);
                return (data = {}) => target.callCommand(prop, data);
            }
        });
    }

    /**
     * Establish TCP connection and set up event handlers
     */
    createSocket() {
        this.errorCount = 0;
        this.connected = false;
        this.alive = true;
        this.recv = '';
        this.seenNotifyTokens.clear();

        this.socket = new net.Socket();
        this.socket.setKeepAlive(SOCKET_KEEPALIVE);
        this.socket.setNoDelay(SOCKET_NODELAY);

        this.socket
            .on('connect', () => {
                console.info(`ION [${this.name}] Connected to ${this.url}`);
                this.connected = true;
                this.seenNotifyTokens.clear();

                // Auto-subscribe after connection
                if (this.autoSubscribeChannels.length > 0) {
                    setTimeout(() => {
                        this.subscribe(this.autoSubscribeChannels)
                            .then(() => console.info(`ION [${this.name}] Auto-subscribed: ${this.autoSubscribeChannels.join(', ')}`))
                            .catch(err => console.error(`ION [${this.name}] Auto-subscribe failed:`, err.message));
                    }, AUTO_SUBSCRIBE_DELAY_MS);
                }
            })
            .on('timeout', () => {
                console.error(`ION [${this.name}] Socket timeout`);
                if (this.alive) this.reconnect();
            })
            .on('close', () => {
                this.connected = false;
                console.warn(`ION [${this.name}] Connection closed`);
                if (this.alive) this.reconnect();
            })
            .on('error', (err) => {
                console.error(`ION [${this.name}] Socket error:`, err.message);
                if (this.alive) this.reconnect();
            })
            .on('data', (data) => this.handleData(data));

        const [host, port] = this.url.split(':');
        this.socket.connect({ host, port });
    }

    /**
     * Handle incoming TCP data
     * @param {Buffer} data - Raw TCP chunk
     */
    handleData(data) {
        this.recv += data.toString();

        const delimiterPos = this.recv.lastIndexOf('\r\n');
        if (delimiterPos === -1) return;

        const received = this.recv.slice(0, delimiterPos);
        this.recv = this.recv.slice(delimiterPos + 2);
        const tokens = received.split('\r\n');

        for (const token of tokens) {
            if (!token.trim()) continue;

            let parsed;
            try {
                const cleaned = token.replace(/[\n\r\t]/g, '').trim();
                parsed = JSON.parse(jsonrepair(cleaned));
            } catch (e) {
                console.error(`ION [${this.name}] Parse error:`, token, e.message);
                continue;
            }

            // === ARRAY MESSAGES ===
            if (Array.isArray(parsed)) {
                const [marker] = parsed;

                // Quote: ["t", symbol, bid, ask, timestamp]
                if (marker === 't' && parsed.length >= 4) {
                    const [, symbol, bid, ask, timestamp] = parsed;
                    if (typeof symbol === 'string' && typeof bid === 'number' && typeof ask === 'number') {
                        const quote = {
                            symbol,
                            bid,
                            ask,
                            timestamp: timestamp ? new Date(timestamp * 1000) : null
                        };
                        this.emit('quote', quote);
                        this.emit(`quote:${symbol.toUpperCase()}`, quote);
                    }
                    continue;
                }

                // Notify: ["n", msg, desc, token, status, level, user_id, time, data?, code]
                if (marker === 'n' && parsed.length >= 8) {
                    const [
                        , message, description, token, status, level, user_id, create_time, dataOrCode, code
                    ] = parsed;
                    const isObject = dataOrCode && typeof dataOrCode === 'object';
                    const notify = {
                        message, description, token, status, level, user_id,
                        create_time: create_time ? new Date(create_time * 1000) : null,
                        data: isObject ? dataOrCode : {},
                        code: Number(isObject ? code : dataOrCode)
                    };
                    if (this.seenNotifyTokens.has(token)) continue;
                    this.seenNotifyTokens.add(token);
                    this.emit('notify', notify);
                    this.emit(`notify:${level}`, notify);
                    continue;
                }

                // Symbols Reindex: ["sr", [[symbol, sym_index, sort_index], ...]]
                if (marker === 'sr' && parsed.length === 2) {
                    const [, symbols] = parsed;
                    this.emit('symbols:reindex', symbols);
                    continue;
                }

                // Security Reindex: ["sc", [[sec_index, sort_index], ...]]
                if (marker === 'sc' && parsed.length === 2) {
                    const [, groups] = parsed;
                    this.emit('security:reindex', groups);
                    continue;
                }

                console.warn(`ION [${this.name}] Unknown array message:`, parsed);
                continue;
            }

            // === JSON EVENT OBJECTS ===
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.event) {
                const { event, type, data } = parsed;

                this.emit(event, { type, data });

                if (data?.login) this.emit(`${event}:${data.login}`, { type, data });
                if (data?.symbol) this.emit(`${event}:${data.symbol}`, { type, data });
                if (data?.group) this.emit(`${event}:${data.group}`, { type, data });

                continue;
            }

            // === COMMAND RESPONSES (extID) ===
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.extID) {
                this.emit(parsed.extID, parsed);
                continue;
            }

            console.warn(`ION [${this.name}] Unknown message:`, parsed);
        }
    }

    /**
     * Emit event if not ignored
     * @param {string} name - Event name
     * @param {*} data - Event data
     */
    emit(name, data) {
        if (!this.ignoreEvents) {
            this.emitter.emit(name, data);
        }
    }

    /**
     * Send command via proxy (e.g., platform.AddUser())
     * @param {string} command - Command name
     * @param {Object} data - Command payload
     * @returns {Promise<Object>}
     */
    async callCommand(command, data = {}) {
        const payload = { command, data };
        if (!payload.extID) payload.extID = shortid.generate();
        return this.send(payload);
    }

    /**
     * Low-level send (legacy format)
     * @param {Object} payload - { command, data, extID?, __token }
     * @returns {Promise<Object>}
     */
    async send(payload) {
        if (!payload.extID) payload.extID = shortid.generate();
        payload.__token = this.token;

        if (!this.connected) {
            return Promise.reject(new Error(`ION [${this.name}] Not connected`));
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`ION [${this.name}] Timeout for extID: ${payload.extID}`));
            }, RESPONSE_TIMEOUT_MS);

            this.emitter.once(payload.extID, (resp) => {
                clearTimeout(timeout);
                resolve(resp);
            });

            try {
                this.socket.write(JSON.stringify(payload) + "\r\n");
            } catch (err) {
                clearTimeout(timeout);
                reject(err);
            }
        });
    }

    /**
     * Subscribe to market data channels (optimized for speed)
     * @param {string|Array<string>} channels - Symbol(s) or channel(s)
     * @returns {Promise<Object>}
     */
    async subscribe(channels) {
        const chanels = Array.isArray(channels) ? channels : [channels];
        return this.callCommand('Subscribe', { chanels });
    }

    /**
     * Unsubscribe from channels
     * @param {string|Array<string>} channels - Symbol(s) to unsubscribe
     * @returns {Promise<Object>}
     */
    async unsubscribe(channels) {
        const chanels = Array.isArray(channels) ? channels : [channels];
        return this.callCommand('Unsubscribe', { chanels });
    }

    /**
     * Reconnect logic with backoff
     */
    reconnect() {
        if (!this.alive || this._reconnectTimer) return;

        this.socket.destroy();
        this.seenNotifyTokens.clear();

        this._reconnectTimer = setTimeout(() => {
            delete this._reconnectTimer;
            console.info(`ION [${this.name}] Reconnecting...`);
            this.createSocket();
        }, RECONNECT_DELAY_MS);
    }

    /**
     * Gracefully close connection
     */
    destroy() {
        this.alive = false;
        if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
        this.seenNotifyTokens.clear();
        this.socket.destroy();
    }
}

module.exports = IONPlatform;