const fs = require('fs');
const path = require('path');
const { getMXRecords } = require('./resolver');
const { sendDirectEmail } = require('./smtp_client');
const crypto = require('crypto');

class CampaignEngine {
    constructor(config) {
        this.config = config;
        this.stats = {
            delivered: 0,
            failed: 0,
            total: config.recipients.length,
            startTime: null,
            endTime: null,
            bounces: { hard: 0, soft: 0, block: 0 },
            retried: 0,
            retrySuccesses: 0,
            domainsFlagged: 0,
            domainEngagement: {}
        };
        this.sentTotalCounter = 0;
    }

    _processPlaceholders(content, recipient) {
        let result = content;
        const now = new Date();
        result = result.replace(/\[\[TIME\]\]/g, now.toLocaleTimeString());
        result = result.replace(/\[\[DATE\]\]/g, now.toLocaleDateString());

        const [userName, userDomain] = recipient.split('@');
        result = result.replace(/\[\[USER_NAME\]\]/g, userName);
        result = result.replace(/\[\[USER_DOMAIN\]\]/g, userDomain);

        const logoTag = `<img src="https://logo.clearbit.com/${userDomain}" alt="${userDomain} logo" style="max-height: 100px;">`;
        result = result.replace(/\[\[logo\]\]/g, logoTag);

        result = result.replace(/\[\[RANDOM_STR:?(\d*)\]\]/g, (match, len) => {
            return crypto.randomBytes(Math.ceil((len || 8) / 2)).toString('hex').slice(0, len || 8);
        });

        result = result.replace(/\[\[NOISE\]\]/g, () => {
            const noise = crypto.randomBytes(4).toString('hex');
            return `<!-- ${noise} -->`;
        });

        return result;
    }

    async run(callback) {
        this.stats.startTime = Date.now();

        for (const recipient of this.config.recipients) {
            await this._processRecipient(recipient, callback);
        }

        this.stats.endTime = Date.now();
        return this.stats;
    }

    async _processRecipient(recipient, callback) {
        const domain = recipient.split('@')[1];
        const mxHosts = await getMXRecords(domain);

        const subject = this.config.subjects[Math.floor(Math.random() * this.config.subjects.length)];
        const [templateName, templateContent] = this.config.templates[Math.floor(Math.random() * this.config.templates.length)];
        const proxy = this.config.proxies.length > 0 ? this.config.proxies[Math.floor(Math.random() * this.config.proxies.length)] : null;

        const finalSubject = this._processPlaceholders(subject, recipient);
        const finalTemplate = this._processPlaceholders(templateContent, recipient);

        const msgOptions = {
            subject: finalSubject,
            html: finalTemplate
        };

        let success = false;
        let lastError = "Unknown";

        for (const mxHost of mxHosts.slice(0, 2)) {
            const [ok, err] = await sendDirectEmail(mxHost, this.config.senders[0], recipient, msgOptions, proxy, this.config.ehloHost);
            success = ok;
            lastError = err;
            if (success) break;
        }

        if (!this.stats.domainEngagement[domain]) {
            this.stats.domainEngagement[domain] = { delivered: 0, failed: 0, errors: {} };
        }

        if (success) {
            this.stats.delivered++;
            this.stats.domainEngagement[domain].delivered++;
        } else {
            this.stats.failed++;
            this.stats.domainEngagement[domain].failed++;
            // Classification would go here
            this.stats.bounces.hard++;
        }

        if (callback) {
            callback(recipient, success, lastError, subject, templateName, this.config.senders[0]);
        }
    }
}

module.exports = { CampaignEngine };
