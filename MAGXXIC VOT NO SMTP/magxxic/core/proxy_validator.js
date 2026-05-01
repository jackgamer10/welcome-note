const net = require('net');
const { SocksProxyAgent } = require('socks-proxy-agent');

async function checkProxy(proxyStr, testHost = "smtp.google.com", testPort = 25, timeout = 5000) {
    return new Promise((resolve) => {
        try {
            const agent = new SocksProxyAgent(proxyStr);
            const socket = agent.callback(null, { host: testHost, port: testPort });

            const timer = setTimeout(() => {
                if (socket.destroy) socket.destroy();
                resolve(false);
            }, timeout);

            if (socket instanceof Promise) {
                socket.then(s => {
                    s.on('connect', () => {
                        clearTimeout(timer);
                        s.destroy();
                        resolve(true);
                    });
                    s.on('error', () => {
                        clearTimeout(timer);
                        resolve(false);
                    });
                }).catch(() => {
                    clearTimeout(timer);
                    resolve(false);
                });
            } else {
                socket.on('connect', () => {
                    clearTimeout(timer);
                    socket.destroy();
                    resolve(true);
                });
                socket.on('error', () => {
                    clearTimeout(timer);
                    resolve(false);
                });
            }
        } catch (e) {
            resolve(false);
        }
    });
}

async function validateProxies(proxyList, concurrency = 20, testPort25 = false) {
    const valid = [];
    for (let i = 0; i < proxyList.length; i += concurrency) {
        const batch = proxyList.slice(i, i + concurrency);
        const results = await Promise.all(batch.map(async p => {
            const ok = await checkProxy(p, testPort25 ? "smtp.google.com" : "google.com", testPort25 ? 25 : 80);
            return ok ? p : null;
        }));
        valid.push(...results.filter(r => r));
    }
    return valid;
}

module.exports = { checkProxy, validateProxies };
