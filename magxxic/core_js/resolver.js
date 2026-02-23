const dns = require('dns').promises;

async function getMXRecords(domain) {
    try {
        const records = await dns.resolveMx(domain);
        if (!records || records.length === 0) return [];
        return records.sort((a, b) => a.priority - b.priority).map(r => r.exchange);
    } catch (err) {
        return [];
    }
}

module.exports = { getMXRecords };
