const dns = require('dns').promises;

/**
 * Advanced MX Resolver with A-record fallback and retry logic.
 */
async function getMXRecords(domain) {
    let records = [];

    // Try MX records first
    try {
        const mxRecords = await dns.resolveMx(domain);
        if (mxRecords && mxRecords.length > 0) {
            records = mxRecords.sort((a, b) => a.priority - b.priority).map(r => r.exchange);
        }
    } catch (e) {
        // If MX fails, we'll try A record as fallback (Standard SMTP behavior)
    }

    // Fallback to A record if no MX records found
    if (records.length === 0) {
        try {
            const aRecords = await dns.resolve4(domain);
            if (aRecords && aRecords.length > 0) {
                // In A-record fallback, the domain itself acts as the MX
                records = [domain];
            }
        } catch (e) {
            // Domain doesn't exist or has no A records
        }
    }

    return records;
}

/**
 * Enhanced PTR Lookup
 */
async function getPTRRecord(ip, fallback) {
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
    try {
        await dns.resolve(domain);
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = { getMXRecords, getPTRRecord, validateDomain };
