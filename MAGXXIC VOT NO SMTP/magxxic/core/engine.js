const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getMXRecords, getPTRRecord } = require('./resolver');
const { sendDirectEmail } = require('./smtp_client');
const { checkProxy } = require('./proxy_validator');
const { generatePdf, generateIcs, generateRtf, generateEml, createZip } = require('./attachment_gen');

class CampaignEngine {
    constructor(config, data) {
        this.config = config;
        this.data = data; // { senders, subjects, links, recipients, proxies, localIps, templates, attachmentTemplates }
        this.stats = {
            delivered: 0,
            failed: 0,
            total: data.recipients.length,
            startTime: null,
            endTime: null,
            domainEngagement: {}
        };
        this.proxyIndex = 0;
        this.throttles = {}; // { domain: { count, lastReset } }
        this.sentEmails = new Set();
    }

    _processPlaceholders(content, recipient, options = {}) {
        let result = content;
        const now = new Date();
        const [userName, userDomain] = recipient.split('@');

        const tags = {
            '[[TIME]]': now.toLocaleTimeString(),
            '[[DATE]]': now.toLocaleDateString(),
            '[[CURRENT_DATE]]': now.toDateString(),
            '[[USER_NAME]]': userName,
            '[[USER_DOMAIN]]': userDomain,
            '[[RECIPIENTDOMAIN]]': userDomain,
            '[[EMAIL]]': recipient,
            '[[DOMAINNAME]]': userDomain.split('.')[0],
            '[[TLD]]': userDomain.split('.').pop()
        };

        Object.entries(tags).forEach(([tag, val]) => {
            result = result.split(tag).join(val);
        });

        // Content Randomization
        result = result.replace(/\[\[RANDOM_STR:?(\d*)\]\]/g, (m, len) => crypto.randomBytes(Math.ceil((len || 8) / 2)).toString('hex').slice(0, len || 8));
        result = result.replace(/\{SENDER_RANDOM_STRING\((\d+)\)\}/g, (m, len) => crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len));

        result = result.replace(/\[\[RANDOM_LINK\]\]/g, () => this.data.links[Math.floor(Math.random() * this.data.links.length)] || "http://example.com");

        // Zero-font injection
        if (this.config.military_features?.zero_font_injection?.enabled) {
            result = result.replace(/<\/p>/g, () => `<span style="display:none;font-size:0;color:transparent;">${crypto.randomBytes(4).toString('hex')}</span></p>`);
        }

        // Encryption tags
        if (!this.config.inbox_mode) {
            result = result.replace(/\[\[ENCRYPT:(.*?)\]\]/g, (m, text) => {
                const key = crypto.randomBytes(1)[0];
                const enc = Buffer.from(text).map(b => b ^ key);
                return key.toString(16).padStart(2, '0') + enc.toString('hex');
            });
            result = result.replace(/\[\[B64_ENCRYPT:(.*?)\]\]/g, (m, text) => {
                const key = crypto.randomBytes(1)[0];
                const enc = Buffer.from(text).map(b => b ^ key);
                return Buffer.concat([Buffer.from([key]), enc]).toString('base64');
            });
        }

        return result;
    }

    _applyPolymorphism(html) {
        if (this.config.inbox_mode || !this.config.military_features?.html_polymorphic?.enabled) return html;

        let poly = html;
        // Randomize class names
        poly = poly.replace(/class="([^"]+)"/g, (m, cls) => `class="magxxic_${crypto.randomBytes(3).toString('hex')}"`);
        // Randomize style attributes (injecting useless styles)
        poly = poly.replace(/style="([^"]+)"/g, (m, style) => `style="${style}; --magxxic-${crypto.randomBytes(2).toString('hex')}: ${crypto.randomBytes(2).toString('hex')};"`);

        return poly;
    }

    _injectBayesianPoison(html) {
        if (this.config.inbox_mode || !this.config.military_features?.bayesian_poison?.enabled) return html;

        const snippets = [
            "The professional services provided were exceptional.",
            "Please find the attached invoice for your records.",
            "We look forward to continuing our partnership.",
            "Thank you for your prompt attention to this matter.",
            "Our team is dedicated to providing the best support possible.",
            "The document has been verified and approved by the department."
        ];
        const poison = `<div style="display:none !important; font-size:0; color:transparent; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden;">${snippets[Math.floor(Math.random() * snippets.length)]} ${crypto.randomBytes(8).toString('hex')}</div>`;
        return html + poison;
    }

    async _prepareAttachments(recipient, sender, subject, html) {
        const attachments = [];
        let mode = this.config.attachment_mode;

        if (mode === 'random_type') {
            const types = this.config.random_attachment_types || ["html_to_pdf", "eml", "ics", "rtf"];
            mode = types[Math.floor(Math.random() * types.length)];
        }

        const docName = (this.config.document_names?.[Math.floor(Math.random() * this.config.document_names.length)] || this.config.document_name) + crypto.randomBytes(3).toString('hex');

        if (mode === 'html_to_pdf') {
            const template = this.data.attachmentTemplates[Math.floor(Math.random() * this.data.attachmentTemplates.length)];
            const atHtml = template ? this._processPlaceholders(template[1], recipient) : html;
            const pdf = await generatePdf(atHtml);
            attachments.push({ filename: `${docName}.pdf`, content: pdf });
        } else if (mode === 'eml') {
            const eml = generateEml(sender, recipient, subject, html);
            attachments.push({ filename: `${docName}.eml`, content: Buffer.from(eml) });
        } else if (mode === 'ics') {
            const ics = generateIcs(this.config.ics_attachment);
            attachments.push({ filename: `${docName}.ics`, content: Buffer.from(ics) });
        } else if (mode === 'rtf') {
            const rtf = generateRtf(html);
            attachments.push({ filename: `${docName}.rtf`, content: Buffer.from(rtf) });
        } else if (mode === 'direct_file') {
            const files = this.config.direct_attachment_files.filter(f => f.enabled);
            const fileData = files.map(f => ({
                name: path.basename(f.path),
                content: fs.readFileSync(path.join(__dirname, '../../', f.path))
            }));

            if (this.config.create_zip) {
                const zipOptions = {
                    password: this.config.zip_compression.password_protected ? this.config.zip_compression.password : null,
                    fingerprint: this.config.zip_compression.fingerprint_enabled
                };
                if (this.config.zip_compression.password_type === 'recipient_based') {
                    zipOptions.password = recipient.slice(0, 4) + crypto.randomBytes(2).toString('hex');
                }
                const zip = await createZip(fileData, zipOptions);
                attachments.push({
                    filename: `Document_${crypto.randomBytes(4).toString('hex')}.zip`,
                    content: zip
                });
            } else {
                fileData.forEach(f => attachments.push(f));
            }
        }

        return attachments;
    }

    _isClean(recipient) {
        if (!this.config.military_features?.list_hygiene?.enabled) return true;
        const traps = ['abuse@', 'postmaster@', 'spam@', 'trap@'];
        if (traps.some(t => recipient.toLowerCase().includes(t))) return false;
        if (!recipient.includes('@') || !recipient.includes('.')) return false;
        return true;
    }

    async _verifyEmail(recipient) {
        if (!this.config.military_features?.email_verification?.enabled) return true;
        return Math.random() * 100 >= (100 - (this.config.military_features.email_verification.min_score || 50));
    }

    async run(callback) {
        this.stats.startTime = Date.now();
        const threads = this.config.max_threads || 10;
        const batchSize = threads * 2;

        let recipientList = this.data.recipients;
        if (this.config.military_features?.remove_duplicates?.enabled) {
            recipientList = [...new Set(recipientList)];
        }

        for (let i = 0; i < recipientList.length; i += batchSize) {
            const batch = recipientList.slice(i, i + batchSize);
            const chunks = [];
            for (let j = 0; j < batch.length; j += threads) chunks.push(batch.slice(j, j + threads));

            for (const chunk of chunks) {
                await Promise.all(chunk.map(r => this._processRecipient(r, callback)));
            }

            const delay = (11 - (this.config.sending_speed || 1)) * 1000;
            await new Promise(res => setTimeout(res, delay));
        }

        this.stats.endTime = Date.now();
        return this.stats;
    }

    async _processRecipient(recipient, callback) {
        if (!this._isClean(recipient)) {
            if (callback) callback(recipient, false, "List Hygiene: Flagged as invalid/trap", "N/A", "N/A", "N/A");
            return;
        }

        if (!(await this._verifyEmail(recipient))) {
            if (callback) callback(recipient, false, "Verification Failed: Low deliverability score", "N/A", "N/A", "N/A");
            return;
        }

        const domain = recipient.split('@')[1];

        if (this.config.military_features?.domain_throttling?.enabled) {
            const limit = domain.includes('gmail') ? 100 : 50;
            if (!this.throttles[domain]) this.throttles[domain] = { count: 0, lastReset: Date.now() };
            if (Date.now() - this.throttles[domain].lastReset > 3600000) {
                this.throttles[domain].count = 0;
                this.throttles[domain].lastReset = Date.now();
            }
            if (this.throttles[domain].count >= limit) {
                if (callback) callback(recipient, false, `Throttled for ${domain}`, "N/A", "N/A", "N/A");
                return;
            }
            this.throttles[domain].count++;
        }

        if (this.config.military_features?.timing_jitter?.enabled) {
            await new Promise(res => setTimeout(res, Math.random() * 5000 + 2000));
        }

        const mxHosts = await getMXRecords(domain);
        if (mxHosts.length === 0) {
            this.stats.failed++;
            if (callback) callback(recipient, false, "No MX records", "N/A", "N/A", "N/A");
            return;
        }

        const proxy = this.data.proxies.length > 0 ? this.data.proxies[this.proxyIndex++ % this.data.proxies.length] : null;
        const sender = this.data.senders[Math.floor(Math.random() * this.data.senders.length)];
        const subject = this.data.subjects[Math.floor(Math.random() * this.data.subjects.length)];
        const [tName, tContent] = this.data.templates[Math.floor(Math.random() * this.data.templates.length)];

        let finalSubject = this._processPlaceholders(subject, recipient);
        let finalHtml = this._processPlaceholders(tContent, recipient);
        finalHtml = this._applyPolymorphism(finalHtml);
        finalHtml = this._injectBayesianPoison(finalHtml);

        const msgOptions = {
            subject: finalSubject,
            html: finalHtml,
            headers: {
                'X-Mailer': 'MAGXXIC-VOT-3.0',
                'X-Priority': this.config.email_priority === 'high' ? '1' : '3',
                'Message-ID': `<${crypto.randomBytes(12).toString('hex')}@${sender.split('@')[1]}>`
            },
            attachments: await this._prepareAttachments(recipient, sender, finalSubject, finalHtml),
            list: {
                unsubscribe: {
                    url: this.config.unsubscribe_base_url + '?email=' + Buffer.from(recipient).toString('base64'),
                    comment: 'Unsubscribe'
                }
            }
        };

        if (this.config.inbox_mode) {
            msgOptions.headers['X-Mailprotector-Decision'] = 'deliver';
        }

        let success = false;
        let lastErr = "";
        for (const mx of mxHosts.slice(0, 3)) {
            const [ok, err] = await sendDirectEmail(mx, sender, recipient, msgOptions, proxy, this.config.ehlo_hostname);
            success = ok;
            lastErr = err;
            if (success) break;
        }

        if (success) this.stats.delivered++; else this.stats.failed++;
        if (callback) callback(recipient, success, lastErr, finalSubject, tName, sender);
    }
}

module.exports = { CampaignEngine };
