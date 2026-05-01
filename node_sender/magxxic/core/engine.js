const fs = require('fs');
const path = require('path');
const { getMXRecords, getPTRRecord } = require('./resolver');
const { sendDirectEmail } = require('./smtp_client');
const { checkProxy } = require('./proxy_validator');
const crypto = require('crypto');
const net = require('net');
const PDFDocument = require('pdfkit');

class CampaignEngine {
    constructor(config) {
        this.config = config;
        this.localIps = config.local_ips || [];
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

    _classifyError(errorMsg) {
        const msg = String(errorMsg).toLowerCase();
        let code = 0;
        const match = msg.match(/(\d{3})/);
        if (match) code = parseInt(match[1]);

        if (msg.includes('spam') || msg.includes('block') || msg.includes('blacklisted') || msg.includes('rbl')) {
            return ['block', code];
        }
        if (code >= 500 && code < 600) return ['hard', code];
        if (code >= 400 && code < 500) return ['soft', code];
        return ['hard', code];
    }

    async _generatePdf(htmlContent) {
        return new Promise((resolve) => {
            const doc = new PDFDocument();
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                resolve(Buffer.concat(buffers));
            });
            // Simplified: extract text from HTML for the PDF
            const text = htmlContent.replace(/<[^>]*>?/gm, '');
            doc.text(text);
            doc.end();
        });
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

        result = result.replace(/\[\[RANDOM_LINK\]\]/g, () => {
            if (this.config.links && this.config.links.length > 0) {
                return this.config.links[Math.floor(Math.random() * this.config.links.length)];
            }
            return "http://example.com";
        });

        result = result.replace(/\[\[TRACK:(.*?)\]\]/g, (match, url) => {
            if (this.config.tracking_url) {
                const encodedUrl = Buffer.from(url).toString('base64').replace(/=/g, '');
                const recipientB64 = Buffer.from(recipient).toString('base64').replace(/=/g, '');
                const sep = this.config.tracking_url.includes('?') ? '&' : '?';
                return `${this.config.tracking_url}${sep}u=${encodedUrl}&r=${recipientB64}`;
            }
            return url;
        });

        result = result.replace(/\[\[RANDOM_STR:?(\d*)\]\]/g, (match, len) => {
            return crypto.randomBytes(Math.ceil((len || 8) / 2)).toString('hex').slice(0, len || 8);
        });

        result = result.replace(/\[\[NOISE\]\]/g, () => {
            const noise = crypto.randomBytes(4).toString('hex');
            return `<!-- ${noise} -->`;
        });

        result = result.replace(/\[\[ENCRYPT:(.*?)\]\]/g, (match, text) => {
            const key = crypto.randomBytes(1)[0];
            const encrypted = Buffer.from(text).map(b => b ^ key);
            return key.toString(16).padStart(2, '0') + encrypted.toString('hex');
        });

        result = result.replace(/\[\[B64_ENCRYPT:(.*?)\]\]/g, (match, text) => {
            const key = crypto.randomBytes(1)[0];
            const encrypted = Buffer.from(text).map(b => b ^ key);
            return Buffer.concat([Buffer.from([key]), encrypted]).toString('base64');
        });

        return result;
    }

    async run(callback) {
        this.stats.startTime = Date.now();
        const batchSize = this.config.batch_size || 10;
        const threads = this.config.threads || 5;

        for (let i = 0; i < this.config.recipients.length; i += batchSize) {
            const batch = this.config.recipients.slice(i, i + batchSize);

            // Process batch with limited concurrency
            const chunks = [];
            for (let j = 0; j < batch.length; j += threads) {
                chunks.push(batch.slice(j, j + threads));
            }

            for (const chunk of chunks) {
                await Promise.all(chunk.map(r => this._processRecipient(r, callback)));
            }

            if (i + batchSize < this.config.recipients.length && this.config.batch_pause_seconds > 0) {
                await new Promise(resolve => setTimeout(resolve, this.config.batch_pause_seconds * 1000));
            }
        }

        this.stats.endTime = Date.now();
        return this.stats;
    }

    async _processRecipient(recipient, callback) {
        const domain = recipient.split('@')[1];

        // Select a Stealth Identity
        let stealthHost = null;
        if (this.config.proxies.length > 0) {
            const fakeProxy = this.config.proxies[Math.floor(Math.random() * this.config.proxies.length)];
            try {
                stealthHost = fakeProxy.includes('://') ? new URL(fakeProxy).hostname : fakeProxy.split('@').pop().split(':')[0];
            } catch (e) {}
        }

        // Pre-send MX Check
        if (this.config.validate_mx_before_send !== false) {
            const records = await getMXRecords(domain);
            if (records.length === 0) {
                this.stats.failed++;
                if (!this.stats.domainEngagement[domain]) this.stats.domainEngagement[domain] = { delivered: 0, failed: 0, errors: {} };
                this.stats.domainEngagement[domain].failed++;
                this.stats.domainEngagement[domain].errors[0] = (this.stats.domainEngagement[domain].errors[0] || 0) + 1;
                if (callback) callback(recipient, false, "No MX records found", "No Subject", "No Template", this.config.senders[0]);
                return;
            }
        }

        const mxHosts = await getMXRecords(domain);
        const subject = this.config.subjects[Math.floor(Math.random() * this.config.subjects.length)];
        const [templateName, templateContent] = this.config.templates[Math.floor(Math.random() * this.config.templates.length)];
        const proxy = this.config.proxies.length > 0 ? this.config.proxies[Math.floor(Math.random() * this.config.proxies.length)] : null;

        if (this.config.hide_ip && !proxy) {
            this.stats.failed++;
            if (callback) callback(recipient, false, "IP-Hiding enabled but no proxy available", subject, templateName, this.config.senders[0]);
            return;
        }

        const finalSubject = this._processPlaceholders(subject, recipient);
        const finalTemplate = this._processPlaceholders(templateContent, recipient);

        const msgOptions = {
            subject: finalSubject,
            html: finalTemplate,
            headers: {},
            attachments: []
        };

        // PDF Attachment
        if (this.config.attach_pdf && this.config.attachment_templates && this.config.attachment_templates.length > 0) {
            if (Math.random() * 100 <= (this.config.attachment_probability || 100)) {
                const [atName, atContent] = this.config.attachment_templates[Math.floor(Math.random() * this.config.attachment_templates.length)];
                const finalAtHtml = this._processPlaceholders(atContent, recipient);
                const pdfBuffer = await this._generatePdf(finalAtHtml);
                const pdfFilename = this._processPlaceholders(this.config.pdf_filename_format || "Document.pdf", recipient);
                msgOptions.attachments.push({
                    filename: pdfFilename,
                    content: pdfBuffer
                });
            }
        }

        // DKIM
        if (this.config.dkim) {
            msgOptions.dkim = this.config.dkim;
        }

        // Standard Anti-Spam Headers
        const sender = this.config.senders[Math.floor(Math.random() * this.config.senders.length)];
        msgOptions.headers['Message-ID'] = `<${Date.now()}.${Math.floor(Math.random()*10000)}@${sender.split('@')[1]}>`;
        msgOptions.headers['X-Mailer'] = this.config.x_mailer || "Magxxic-V2";

        // Military Grade Headers if enabled
        if (this.config.military_grade_headers) {
            msgOptions.headers['X-Security-Level'] = 'Classified';
            msgOptions.headers['X-Transmission-Encryption'] = 'AES-256-GCM';
            msgOptions.headers['X-Originating-IP-Hiding'] = 'Enabled';
            msgOptions.headers['X-Protocol-Type'] = 'Scorpion-Secure';
            msgOptions.headers['X-Content-Signature'] = `sha256:${crypto.randomBytes(16).toString('hex')}`;
        }

        // Custom Headers
        if (this.config.custom_headers) {
            Object.entries(this.config.custom_headers).forEach(([k, v]) => {
                msgOptions.headers[k] = this._processPlaceholders(v, recipient);
            });
        }

        // Header Forgery (IP Hiding via Headers)
        if (this.config.forge_relay_headers && stealthHost) {
            try {
                const timestamp = new Date().toUTCString();
                const idStr = crypto.randomBytes(6).toString('hex');
                // Multiple relay hops to obfuscate RDP source
                const hop1 = `from magxxic-app (localhost [127.0.0.1]) by ${stealthHost} (ESMTPS id ${idStr}.local); ${timestamp}`;
                const hop2 = `from ${stealthHost} ([${stealthHost}]) by mta-outbound.magxxic.local (ESMTPS id ${idStr}.relay); ${timestamp}`;
                msgOptions.headers['Received'] = `${hop1}\r\n\t${hop2}`;
            } catch (e) {}
        }

        let success = false;
        let lastError = "Unknown";

        let attempts = 0;
        const proxyRetries = this.config.proxy_retries || 2;
        const timeout = this.config.timeout || 15;

        while (!success && attempts <= proxyRetries) {
            if (attempts > 0) {
                // Pick a different proxy
                proxy = this.config.proxies.length > 0 ? this.config.proxies[Math.floor(Math.random() * this.config.proxies.length)] : null;
                if (!proxy && this.config.hide_ip) break;
            }

        for (const mxHost of mxHosts.slice(0, 2)) {
            // Dynamic EHLO with Stealth Identity
            let currentEhlo = this.config.ehloHost || "example.com";

            const targetForIdentity = proxy ? (proxy.includes('://') ? new URL(proxy).hostname : proxy.split('@').pop().split(':')[0]) : stealthHost;

            if (targetForIdentity) {
                currentEhlo = targetForIdentity;
                if (this.config.auto_ehlo) {
                    currentEhlo = await getPTRRecord(targetForIdentity, currentEhlo);
                }
            }

            // Connection test if enabled
            if (this.config.test_connection_before_send) {
                if (proxy) {
                    if (!await checkProxy(proxy, mxHost, 25, 5000)) {
                        lastError = `Connection test failed (Proxy cannot reach ${mxHost}:25)`;
                        continue;
                    }
                } else {
                    const reachable = await new Promise(resolve => {
                        const s = net.createConnection(25, mxHost);
                        s.setTimeout(5000);
                        s.on('connect', () => { s.destroy(); resolve(true); });
                        s.on('error', () => { resolve(false); });
                        s.on('timeout', () => { s.destroy(); resolve(false); });
                    });
                    if (!reachable) {
                        lastError = `Connection test failed (Direct IP cannot reach ${mxHost}:25)`;
                        continue;
                    }
                }
            }

            // Local IP Rotation
            let localAddress = null;
            if (this.config.rotate_local_ips && this.localIps.length > 0) {
                localAddress = this.localIps[Math.floor(Math.random() * this.localIps.length)];
            }

            const [ok, err] = await sendDirectEmail(mxHost, this.config.senders[0], recipient, msgOptions, proxy, currentEhlo, this.config.smtp_debug, timeout, localAddress);
            success = ok;
            lastError = err;
            if (success) break;
        }

        if (success) break;

        if (String(lastError).toLowerCase().includes('timeout') || String(lastError).toLowerCase().includes('connection')) {
            attempts++;
        } else {
            break;
        }
        }

        if (!this.stats.domainEngagement[domain]) {
            this.stats.domainEngagement[domain] = { delivered: 0, failed: 0, errors: {} };
        }

        if (success) {
            this.stats.delivered++;
            this.sentTotalCounter++;
            this.stats.domainEngagement[domain].delivered++;

            // Special Email Trigger
            if (this.config.special_email && this.config.special_email_interval > 0 && this.sentTotalCounter % this.config.special_email_interval === 0) {
                const specialMx = await getMXRecords(this.config.special_email.split('@')[1]);
                if (specialMx.length > 0) {
                    await sendDirectEmail(specialMx[0], sender, this.config.special_email, msgOptions, proxy, this.config.ehloHost);
                }
            }
        } else {
            this.stats.failed++;
            this.stats.domainEngagement[domain].failed++;
            const [bounceType, code] = this._classifyError(lastError);
            this.stats.bounces[bounceType]++;
            this.stats.domainEngagement[domain].errors[code] = (this.stats.domainEngagement[domain].errors[code] || 0) + 1;
            if (bounceType === 'block') this.stats.domainsFlagged++;
        }

        if (callback) {
            callback(recipient, success, lastError, subject, templateName, sender);
        }
    }
}

module.exports = { CampaignEngine };
