const dns = require('dns').promises;

async function getMXRecords(domain) {
    try {
        const records = await dns.resolveMx(domain);
        if (!records || records.length === 0) return [];
        return records.sort((a, b) => a.priority - b.priority).map(r => r.exchange);
    } catch (e) {
        return [];
    }
}

async function getPTRRecord(ip, fallback) {
    try {
        const names = await dns.reverse(ip);
        return names && names.length > 0 ? names[0] : fallback;
    } catch (e) {
        return fallback;
    }
}

module.exports = { getMXRecords, getPTRRecord };
