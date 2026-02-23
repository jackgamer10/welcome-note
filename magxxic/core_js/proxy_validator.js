const { SocksProxyAgent } = require('socks-proxy-agent');
const net = require('net');

async function checkProxy(proxyStr, testHost = "8.8.8.8", testPort = 53, timeout = 5000) {
    if (!proxyStr) return false;

    let proxyUrl = proxyStr;
    if (!proxyStr.startsWith("socks5://")) {
        proxyUrl = `socks5://${proxyStr}`;
    }

    const agent = new SocksProxyAgent(proxyUrl);

    return new Promise((resolve) => {
        const socket = agent.callback(
            { host: testHost, port: testPort },
            { timeout }
        );

        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });

        socket.on('error', () => {
            resolve(false);
        });

        setTimeout(() => {
            socket.destroy();
            resolve(false);
        }, timeout);
    });
}

async function validateProxies(proxies, maxWorkers = 20) {
    if (!proxies || proxies.length === 0) return [];

    const workingProxies = [];
    const chunks = [];
    for (let i = 0; i < proxies.length; i += maxWorkers) {
        chunks.push(proxies.slice(i, i + maxWorkers));
    }

    for (const chunk of chunks) {
        const results = await Promise.all(chunk.map(p => checkProxy(p)));
        results.forEach((res, i) => {
            if (res) workingProxies.push(chunk[i]);
        });
    }
    return workingProxies;
}

module.exports = { checkProxy, validateProxies };
