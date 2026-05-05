const dns = require('dns').promises;

/**
 * High-Fidelity MX Resolver with Retries and Fallbacks.
 */
async function getMXRecords(domain, retries = 2) {
    if (!domain || typeof domain !== 'string' || !domain.includes('.')) return [];

    const resolveWithRetry = async (fn, arg) => {
        for (let i = 0; i <= retries; i++) {
            try {
                return await fn(arg);
            } catch (e) {
                if (i === retries) throw e;
                await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
            }
        }
    };

    let records = [];

    // 1. Resolve MX
    try {
        const mxRecords = await resolveWithRetry(dns.resolveMx.bind(dns), domain);
        if (mxRecords && mxRecords.length > 0) {
            records = mxRecords.sort((a, b) => a.priority - b.priority).map(r => r.exchange);
        }
    } catch (e) {}

    // 2. Fallback to A record (Standard SMTP)
    if (records.length === 0) {
        try {
            const aRecords = await resolveWithRetry(dns.resolve4.bind(dns), domain);
            if (aRecords && aRecords.length > 0) records = [domain];
        } catch (e) {}
    }

    // 3. Fallback to AAAA record (IPv6 SMTP)
    if (records.length === 0) {
        try {
            const aaaaRecords = await resolveWithRetry(dns.resolve6.bind(dns), domain);
            if (aaaaRecords && aaaaRecords.length > 0) records = [domain];
        } catch (e) {}
    }

    return records;
}

/**
 * Enhanced PTR Lookup
 */
async function getPTRRecord(ip, fallback) {
    if (!ip) return fallback;
    try {
        const names = await dns.reverse(ip);
        return names && names.length > 0 ? names[0] : fallback;
    } catch (e) {
        return fallback;
    }
}

/**
 * Validates domain existence
 */
async function validateDomain(domain) {
    if (!domain || !domain.includes('.')) return false;
    try {
        await dns.resolve(domain);
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = { getMXRecords, getPTRRecord, validateDomain };
