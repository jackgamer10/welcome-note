const dns = require('dns').promises;

async function getPTRRecord(ip, fallback = "example.com") {
    try {
        const domains = await dns.reverse(ip);
        if (domains && domains.length > 0) {
            return domains[0];
        }
        return fallback;
    } catch (err) {
        return fallback;
    }
}

async function getMXRecords(domain) {
    try {
        const records = await dns.resolveMx(domain);
        if (!records || records.length === 0) return [];
        return records.sort((a, b) => a.priority - b.priority).map(r => r.exchange);
    } catch (err) {
        return [];
    }
}

module.exports = { getMXRecords, getPTRRecord };
