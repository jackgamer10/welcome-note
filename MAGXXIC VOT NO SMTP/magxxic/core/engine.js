const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getMXRecords, getPTRRecord } = require('./resolver');
const { sendDirectEmail } = require('./smtp_client');
const { checkProxy } = require('./proxy_validator');
const { generatePdf, generateIcs, generateRtf, generateEml, createZip } = require('./attachment_gen');
const { faker } = require('@faker-js/faker');
const QRCode = require('qrcode');

class CampaignEngine {
    constructor(config, data) {
        this.config = config;
        this.data = data;
        this.stats = {
            delivered: 0,
            failed: 0,
            total: data.recipients.length,
            startTime: null,
            endTime: null,
            domainEngagement: {}
        };
        this.proxyIndex = 0;
        this.throttles = {};
        this.bounces = new Set();
        this.engagement = {}; // { domain: { delivered, failed } }
        this.senderSeed = crypto.randomBytes(4).readUInt32BE(0);

        if (config.faker_locale) {
            try { faker.setLocale(config.faker_locale); } catch(e) {}
        }
    }

    _getGuessedNames(email) {
        const local = email.split('@')[0];
        const parts = local.split(/[\._\-]/);
        let first = parts[0] || "Customer";
        let last = parts[1] || "";
        first = first.charAt(0).toUpperCase() + first.slice(1);
        if (last) last = last.charAt(0).toUpperCase() + last.slice(1);
        return { first, last, full: `${first} ${last}`.trim() };
    }

    _getCountryInfo(tld) {
        const mapping = {
            'com': ['United States', 'US'],
            'uk': ['United Kingdom', 'GB'],
            'jp': ['Japan', 'JP'],
            'de': ['Germany', 'DE'],
            'fr': ['France', 'FR'],
            'ca': ['Canada', 'CA'],
            'au': ['Australia', 'AU'],
            'br': ['Brazil', 'BR'],
            'in': ['India', 'IN']
        };
        return mapping[tld.toLowerCase()] || ['United States', 'US'];
    }

    _processPlaceholders(content, recipient, isSenderContext = false) {
        let result = content;
        const now = new Date();
        const [emailLocal, emailDomain] = recipient.split('@');
        const domainParts = emailDomain.split('.');
        const domainName = domainParts[0];
        const tld = domainParts.slice(1).join('.');
        const names = this._getGuessedNames(recipient);
        const country = this._getCountryInfo(domainParts.pop());

        const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

        // 1. RECIPIENT-BASED
        const recTags = {
            '[[RECIPIENT_EMAIL]]': recipient,
            '[[RECIPIENT_DOMAIN]]': emailDomain,
            '[[RECIPIENTDOMAIN]]': emailDomain,
            '[[RECIPIENT_DOMAIN_NAME]]': domainName,
            '[[DOMAINNAME]]': domainName,
            '[[RECIPIENT_LOCAL]]': emailLocal,
            '[[RECIPIENT_FIRST]]': names.first,
            '[[RECIPIENT_LAST]]': names.last,
            '[[RECIPIENT_NAME]]': names.full,
            '[[RECIPIENT_INITIAL]]': emailLocal.charAt(0).toUpperCase(),
            '[[RECIPIENT_LOCAL_INITIAL]]': emailLocal.slice(0, 2),
            '[[RECIPIENT_DOMAIN_INITIAL]]': domainName.slice(0, 2),
            '[[RECIPIENT_EMAIL_HASH4]]': md5(recipient).slice(0, 4),
            '[[RECIPIENT_EMAIL_HASH8]]': md5(recipient).slice(0, 8),
            '[[RECIPIENT_BASE64_EMAIL]]': Buffer.from(recipient).toString('base64'),
            '[[RECIPIENT_MASKED_EMAIL]]': `${emailLocal.slice(0, 2)}***@${emailDomain.slice(0, 1)}***.${tld}`,
            '[[RECIPIENT_MASKED_V2]]': `${emailLocal.charAt(0)}***${emailLocal.slice(-1)}@${emailDomain.slice(0, 1)}***.${tld}`,
            '[[RECIPIENT_COUNTRY]]': country[0],
            '[[RECIPIENT_COUNTRY_CODE]]': country[1],
            '[[RECIPIENT_TLD]]': tld,
            '[[TLD]]': tld,
            '[[USER_NAME]]': emailLocal, // compatibility
            '[[USER_DOMAIN]]': emailDomain, // compatibility
            '[[DOMAIN_FAVICON]]': `https://${emailDomain}/favicon.ico`
        };

        // 2. DATE & TIME
        const d = now;
        const ordinal = (n) => n + (n > 10 && n < 20 ? 'th' : {1: 'st', 2: 'nd', 3: 'rd'}[n % 10] || 'th');
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        const dateTags = {
            '[[CURRENT_DATE]]': `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}/${d.getFullYear()}`,
            '[[CURRENT_DATE_LONG]]': `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
            '[[CURRENT_FULL_DATE]]': `${ordinal(d.getDate())} of ${months[d.getMonth()]} ${d.getFullYear()}`,
            '[[CURRENT_DATE_PLUS_TIME]]': `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`,
            '[[CURRENT_FULL_DATETIME]]': `${days[d.getDay()]}, ${ordinal(d.getDate())} of ${months[d.getMonth()]} ${d.getFullYear()} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}`,
            '[[CURRENT_TIME]]': d.toTimeString().split(' ')[0],
            '[[CURRENT_TIME_12H]]': d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
            '[[CURRENT_HOUR]]': d.getHours().toString().padStart(2, '0'),
            '[[CURRENT_MINUTE]]': d.getMinutes().toString().padStart(2, '0'),
            '[[CURRENT_SECOND]]': d.getSeconds().toString().padStart(2, '0'),
            '[[CURRENT_DAY]]': days[d.getDay()],
            '[[CURRENT_DAY_NUM]]': d.getDate().toString(),
            '[[CURRENT_MONTH]]': months[d.getMonth()],
            '[[CURRENT_MONTH_NUM]]': (d.getMonth()+1).toString().padStart(2, '0'),
            '[[CURRENT_YEAR]]': d.getFullYear().toString(),
            '[[CURRENT_YEAR_SHORT]]': d.getFullYear().toString().slice(-2),
            '[[TIMESTAMP]]': Math.floor(Date.now() / 1000).toString(),
            '[[TIMESTAMP_HEX]]': Math.floor(Date.now() / 1000).toString(16).toUpperCase()
        };

        // 3. RANDOM
        const randTags = {
            '[[RANDOM_NUM4]]': Math.floor(1000 + Math.random() * 9000).toString(),
            '[[RANDOM_NUM6]]': Math.floor(100000 + Math.random() * 900000).toString(),
            '[[RANDOM_NUMBER10]]': Math.floor(1000000000 + Math.random() * 9000000000).toString(),
            '[[RANDOM_STRING]]': crypto.randomBytes(6).toString('hex'),
            '[[RANDOM_STR8]]': crypto.randomBytes(4).toString('hex'),
            '[[RANDOM_HEX8]]': crypto.randomBytes(4).toString('hex'),
            '[[RANDOM_MD5]]': md5(Math.random().toString()),
            '[[RANDOM_MD5_UPPER]]': md5(Math.random().toString()).toUpperCase(),
            '[[RANDOM_UUID]]': crypto.randomUUID(),
            '[[RANDOM_UUID_SHORT]]': crypto.randomUUID().split('-')[0],
            '[[RANDOM_PHONE]]': `+1-${Math.floor(200+Math.random()*800)}-${Math.floor(200+Math.random()*800)}-${Math.floor(1000+Math.random()*9000)}`,
            '[[RANDOM_PATH]]': `/docs/ref/${crypto.randomBytes(4).toString('hex')}`
        };

        // 4. RANDOM NAMES
        const nameTags = {
            '[[RANDOM_FULLNAME]]': faker.name.fullName(),
            '[[RANDOM_FIRSTNAME]]': faker.name.firstName(),
            '[[RANDOM_LASTNAME]]': faker.name.lastName(),
            '[[RANDOM_US_FULLNAME]]': faker.name.fullName(),
            '[[RANDOM_US_FIRSTNAME]]': faker.name.firstName(),
            '[[RANDOM_US_LASTNAME]]': faker.name.lastName(),
            '[[RANDOM_EUROPEAN_FULLNAME]]': faker.name.fullName(),
            '[[RANDOM_EUROPEAN_FIRSTNAME]]': faker.name.firstName(),
            '[[RANDOM_EUROPEAN_LASTNAME]]': faker.name.lastName(),
            '[[RANDOM_ASIAN_FULLNAME]]': faker.name.fullName(),
            '[[RANDOM_ASIAN_FIRSTNAME]]': faker.name.firstName(),
            '[[RANDOM_ASIAN_LASTNAME]]': faker.name.lastName(),
            '[[RANDOM_UK_FULLNAME]]': faker.name.fullName(),
            '[[RANDOM_LATIN_FULLNAME]]': faker.name.fullName(),
            '[[RAND-NAMES]]': faker.name.fullName()
        };

        // 5. RANDOM COMPANIES
        const compTags = {
            '[[RANDOM_COMPANY]]': faker.company.name(),
            '[[RANDOM_US_COMPANY]]': faker.company.name(),
            '[[RANDOM_EUROPEAN_COMPANY]]': faker.company.name(),
            '[[RANDOM_ASIAN_COMPANY]]': faker.company.name(),
            '[[RANDOM_UK_COMPANY]]': faker.company.name(),
            '[[RANDOM_COMPANY_SUFFIX]]': faker.company.companySuffix(),
            '[[FAKE_COMPANY_EMAIL]]': faker.internet.email().toLowerCase(),
            '[[FAKE_COMPANY_EMAIL_AND_FULLNAME]]': `${faker.name.fullName()} <${faker.internet.email().toLowerCase()}>`,
            '[[LINK]]': this.data.links[Math.floor(Math.random() * this.data.links.length)] || "http://example.com",
            '[[RANDOM_LINK]]': this.data.links[Math.floor(Math.random() * this.data.links.length)] || "http://example.com"
        };

        // 6. RANDOM LOCATIONS
        const locTags = {
            '[[RANDOM_COUNTRY]]': faker.address.country(),
            '[[RANDOM_COUNTRY_CODE]]': faker.address.countryCode(),
            '[[RANDOM_CITY]]': faker.address.city(),
            '[[RANDOM_US_CITY]]': faker.address.city(),
            '[[RANDOM_EUROPEAN_CITY]]': faker.address.city(),
            '[[RANDOM_ASIAN_CITY]]': faker.address.city(),
            '[[RANDOM_LATIN_CITY]]': faker.address.city(),
            '[[RANDOM_ADDRESS]]': `${faker.address.streetAddress()}, ${faker.address.city()}`
        };

        // 7. REFERENCE IDs
        const refTags = {
            '[[REF_NUMBER]]': `INV-${d.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
            '[[TICKET_ID]]': `TKT-${Math.floor(1000 + Math.random() * 9000)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
            '[[CASE_ID]]': `CASE-${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${Math.floor(1000 + Math.random() * 9000)}`,
            '[[ORDER_ID]]': `ORD-${Math.floor(100000 + Math.random() * 900000)}-${d.getFullYear()}`,
            '[[TRANSACTION_ID]]': `TXN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
            '[[TRACKING_NUM]]': `1Z${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
            '[[CONFIRMATION_CODE]]': `BK-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${d.getFullYear()}`
        };

        // Apply all basic tags
        const allTags = { ...recTags, ...dateTags, ...randTags, ...nameTags, ...compTags, ...locTags, ...refTags };
        Object.entries(allTags).forEach(([tag, val]) => {
            result = result.split(tag).join(val);
        });

        // CID Tags
        result = result.replace(/\[\[CID:(.*?)\]\]/g, (m, filename) => `cid:${filename}`);

        // Tracking URL
        if (this.config.tracking?.enabled) {
            result = result.replace(/\[\[TRACK:(.*?)\]\]/g, (m, url) => {
                const encodedUrl = Buffer.from(url).toString('base64').replace(/=/g, '');
                const encodedRecipient = Buffer.from(recipient).toString('base64').replace(/=/g, '');
                const sep = this.config.tracking.server_url.includes('?') ? '&' : '?';
                return `${this.config.tracking.server_url}${sep}u=${encodedUrl}&r=${encodedRecipient}&c=${this.config.tracking.campaign_name}`;
            });
        }

        // Regex-based tags with parameters
        result = result.replace(/\[\[RANDOM_NUM[()|:](\d+)[)]?\]\]/g, (m, n) => {
            let res = '';
            for(let i=0; i<n; i++) res += Math.floor(Math.random()*10).toString();
            return res;
        });

        result = result.replace(/\[\[RANDOM_STR[()|:](\d+)[)]?\]\]/g, (m, n) => crypto.randomBytes(Math.ceil(n/2)).toString('hex').slice(0, n));
        result = result.replace(/\[\[RANDOM_MIX[()|:](\d+)[)]?\]\]/g, (m, n) => {
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let res = '';
            for(let i=0; i<n; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
            return res;
        });
        result = result.replace(/\[\[RANDOM_STR_UPPER[()|:](\d+)[)]?\]\]/g, (m, n) => crypto.randomBytes(Math.ceil(n/2)).toString('hex').slice(0, n).toUpperCase());
        result = result.replace(/\[\[RANDOM_HEX[()|:](\d+)[)]?\]\]/g, (m, n) => crypto.randomBytes(Math.ceil(n/2)).toString('hex').slice(0, n));

        result = result.replace(/\[\[FUTURE_DATE\((\d+)\)\]\]/g, (m, n) => {
            const fd = new Date(Date.now() + parseInt(n) * 86400000);
            return `${(fd.getMonth()+1).toString().padStart(2,'0')}/${fd.getDate().toString().padStart(2,'0')}/${fd.getFullYear()}`;
        });

        result = result.replace(/\[\[PAST_DATE\((\d+)\)\]\]/g, (m, n) => {
            const pd = new Date(Date.now() - parseInt(n) * 86400000);
            return `${(pd.getMonth()+1).toString().padStart(2,'0')}/${pd.getDate().toString().padStart(2,'0')}/${pd.getFullYear()}`;
        });

        // SENDER SPECIFIC
        if (isSenderContext) {
            result = result.replace(/\[\[SENDER_RANDOM_STRING\]\]/g, crypto.randomBytes(4).toString('hex'));
            result = result.replace(/\[\[SENDER_RANDOM_STRING\((\d+)\)\]\]/g, (m, n) => crypto.randomBytes(Math.ceil(n/2)).toString('hex').slice(0, n));
            result = result.replace(/\[\[SENDER_RANDOM_NUM\((\d+)\)\]\]/g, (m, n) => {
                let res = '';
                for(let i=0; i<n; i++) res += Math.floor(Math.random()*10).toString();
                return res;
            });
            result = result.replace(/\[\[SENDER_UUID\]\]/g, crypto.randomUUID().split('-')[0]);
            result = result.replace(/\[\[SENDER_SAFE_DATE\]\]/g, `${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}`);
            result = result.replace(/\[\[SENDER_TIMESTAMP\]\]/g, Math.floor(Date.now()/1000).toString());
        }

        // ENCODING
        result = result.replace(/\[\[BASE64_ENCODE\((.*?)\)\]\]/g, (m, t) => Buffer.from(t).toString('base64'));
        result = result.replace(/\[\[BASE64_DECODE\((.*?)\)\]\]/g, (m, t) => Buffer.from(t, 'base64').toString());
        result = result.replace(/\[\[UPPERCASE\((.*?)\)\]\]/g, (m, t) => t.toUpperCase());
        result = result.replace(/\[\[LOWERCASE\((.*?)\)\]\]/g, (m, t) => t.toLowerCase());
        result = result.replace(/\[\[CAPITALIZE\((.*?)\)\]\]/g, (m, t) => t.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));

        return result;
    }

    _applyPolymorphism(html) {
        if (this.config.inbox_mode || !this.config.military_features?.html_polymorphic?.enabled) return html;
        let poly = html;
        poly = poly.replace(/class="([^"]+)"/g, (m, cls) => `class="magxxic_${crypto.randomBytes(3).toString('hex')}"`);
        poly = poly.replace(/style="([^"]+)"/g, (m, style) => `style="${style}; --magxxic-${crypto.randomBytes(2).toString('hex')}: ${crypto.randomBytes(2).toString('hex')};"`);
        // Randomly insert comments
        poly = poly.replace(/<\/div>/g, () => `</div><!-- ${crypto.randomBytes(4).toString('hex')} -->`);
        return poly;
    }

    _injectBayesianPoison(html) {
        if (this.config.inbox_mode || !this.config.military_features?.bayesian_poison?.enabled) return html;
        const snippets = [
            "The professional services provided were exceptional.",
            "Please find the attached invoice for your records.",
            "We look forward to continuing our partnership.",
            "Thank you for your prompt attention to this matter."
        ];
        const poison = `<div style="display:none !important; font-size:0; color:transparent; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden;">${snippets[Math.floor(Math.random() * snippets.length)]} ${crypto.randomBytes(8).toString('hex')}</div>`;
        return html + poison;
    }

    _isClean(recipient) {
        if (!this.config.military_features?.list_hygiene?.enabled) return true;
        // Advanced Hygiene: Only flag definitive traps and malformed strings
        const traps = ['abuse@', 'spam@', 'trap@', 'nospam@', 'null@'];

        const email = recipient.toLowerCase();
        if (traps.some(t => email.includes(t))) return false;

        // Basic syntax and length checks
        const parts = email.split('@');
        if (parts.length !== 2) return false;
        if (parts[0].length === 0 || parts[1].length < 3) return false;
        if (!parts[1].includes('.')) return false;

        return true;
    }

    async _verifyEmail(recipient) {
        if (!this.config.military_features?.email_verification?.enabled &&
            !this.config.email_verification_settings?.enabled) return true;

        if (!recipient.includes('@')) return false;

        const disposables = ['tempmail.com', 'mailinator.com', '10minutemail.com'];
        const domain = recipient.split('@')[1];
        if (disposables.includes(domain)) return false;

        // Enhanced: Perform DNS check during verification (if enabled)
        if (this.config.military_features?.email_verification?.enabled || this.config.email_verification_settings?.enabled) {
            try {
                const mxRecords = await getMXRecords(domain);
                // getMXRecords now has brute-force fallback, so it only fails if domain is really invalid
                if (!mxRecords || mxRecords.length === 0) {
                    return false;
                }
            } catch (e) {
                return false;
            }
        }

        return true;
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
            const pdfOptions = {
                password_protected: this.config.pdf_encryption?.enabled,
                password: this.config.pdf_encryption?.password
            };
            if (this.config.pdf_encryption?.password_type === 'recipient_based') {
                pdfOptions.password = recipient.slice(0, 4) + Math.floor(1000 + Math.random() * 9000);
            }
            const pdf = await generatePdf(atHtml, pdfOptions);
            attachments.push({ filename: `${docName}.pdf`, content: pdf });
        } else if (mode === 'eml') {
            const eml = generateEml(sender, recipient, subject, html);
            attachments.push({ filename: `${docName}.eml`, content: Buffer.from(eml) });
        } else if (mode === 'ics') {
            const icsConfig = {
                summary: this._processPlaceholders(this.config.ics_attachment.summary, recipient),
                description: this._processPlaceholders(this.config.ics_attachment.description, recipient),
                location: this._processPlaceholders(this.config.ics_attachment.location, recipient),
                duration_hours: this.config.ics_attachment.duration_hours
            };
            const ics = generateIcs(icsConfig);
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
                attachments.push({ filename: `Document_${crypto.randomBytes(4).toString('hex')}.zip`, content: zip });
            } else {
                fileData.forEach(f => attachments.push(f));
            }
        }
        return attachments;
    }

    async run(callback) {
        this.stats.startTime = Date.now();
        this.stats.delivered = 0;
        this.stats.failed = 0;
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

    async _generateQrCode(url) {
        try {
            const opts = {
                color: {
                    dark: this.config.qrcode_color || '#000000',
                    light: this.config.qrcode_bg_color === 'transparent' ? '#00000000' : (this.config.qrcode_bg_color || '#ffffff')
                },
                width: 300,
                margin: 2
            };
            return await QRCode.toDataURL(url, opts);
        } catch (e) {
            return "";
        }
    }

    _calculateSpamScore(html) {
        let score = 0;
        const spamWords = ['buy', 'free', 'money', 'crypto', 'win', 'cash', 'prize'];
        spamWords.forEach(w => {
            const regex = new RegExp(`\\b${w}\\b`, 'gi');
            const matches = html.match(regex);
            if (matches) score += matches.length * 1.5;
        });
        if (html.length < 500) score += 5;
        return score;
    }

    async _processRecipient(recipient, callback, overrideSender = null) {
        if (this.config.military_features?.bounce_handler?.enabled && this.bounces.has(recipient)) {
            if (callback) callback(recipient, false, "Bounce Handler: Previously bounced email", "N/A", "N/A", "N/A");
            return;
        }

        const domain = recipient.split('@')[1];

        // Engagement Scoring / Filter
        if (this.config.military_features?.engagement_filter?.enabled || this.config.engagement_scoring?.enabled) {
            const eng = this.engagement[domain];
            if (eng && (eng.delivered + eng.failed) >= 5) {
                const rate = eng.delivered / (eng.delivered + eng.failed);
                if (rate < 0.05) { // 0% after 5+ attempts logic
                    if (callback) callback(recipient, false, `Engagement Scoring: Auto-skipping ${domain} (0% success)`, "N/A", "N/A", "N/A");
                    return;
                }
            }
        }

        if (!this._isClean(recipient)) {
            if (callback) callback(recipient, false, "List Hygiene: Flagged as invalid/trap", "N/A", "N/A", "N/A");
            return;
        }

        // Verification already handles MX lookup now
        if (!(await this._verifyEmail(recipient))) {
            if (callback) callback(recipient, false, "Verification Failed: Domain has no valid MX/A records", "N/A", "N/A", "N/A");
            return;
        }

        // Send Time Optimization
        if (this.config.military_features?.send_time_optimization?.enabled || this.config.send_time_optimizer?.enabled) {
            if (this.config.send_time_optimizer?.human_delay) {
                await new Promise(res => setTimeout(res, Math.random() * 3000));
            }
            const hour = new Date().getHours();
            // Simulate optimizing for recipient timezone (heuristic)
            if (hour < 7 || hour > 22) {
                await new Promise(res => setTimeout(res, 2000));
            }
        }

        const imageCidDir = path.join(__dirname, '../../imagecid');
        const inlineImages = [];
        if (fs.existsSync(imageCidDir)) {
            const files = fs.readdirSync(imageCidDir);
            files.forEach(f => {
                const ext = path.extname(f).toLowerCase();
                if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
                    inlineImages.push({
                        filename: f,
                        path: path.join(imageCidDir, f),
                        cid: f
                    });
                }
            });
        }

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

        // Optimization: Use cached MX records from verification step if possible, or re-resolve
        const mxHosts = await getMXRecords(domain);
        if (mxHosts.length === 0) {
            this.stats.failed++;
            if (callback) callback(recipient, false, "DNS Error: No MX/A records found for domain", "N/A", "N/A", "N/A");
            return;
        }

        let proxy = (this.data.proxies && this.data.proxies.length > 0) ? this.data.proxies[this.proxyIndex++ % this.data.proxies.length] : null;
        let rawSender = overrideSender || ((this.data.senders && this.data.senders.length > 0) ? this.data.senders[Math.floor(Math.random() * this.data.senders.length)] : (this.config.sender_emails ? this.config.sender_emails[0] : "admin@example.com"));
        let senderName = "";

        if (this.data.sendersNames && this.data.sendersNames.length > 0) {
            senderName = this.data.sendersNames[Math.floor(Math.random() * this.data.sendersNames.length)];
        } else if (this.config.sender_alias) {
            senderName = this.config.sender_alias;
        }

        if (senderName) {
            const alias = this._processPlaceholders(senderName, recipient, true);
            const sep = this.config.sender_alias_separator || " ";
            rawSender = `${alias}${sep}<${rawSender}>`;
        }

        const sender = this._processPlaceholders(rawSender, recipient, true);
        const subject = (this.data.subjects && this.data.subjects.length > 0) ? this.data.subjects[Math.floor(Math.random() * this.data.subjects.length)] : "Important Document";
        const [tName, tContent] = (this.data.templates && this.data.templates.length > 0) ? this.data.templates[Math.floor(Math.random() * this.data.templates.length)] : ["Default", "<html><body>[[RECIPIENT_EMAIL]]</body></html>"];

        let finalSubject = this._processPlaceholders(subject, recipient);
        let finalHtml = this._processPlaceholders(tContent, recipient);

        // Open Tracking Pixel
        if (this.config.tracking?.enabled && this.config.tracking.track_opens) {
            const encodedRecipient = Buffer.from(recipient).toString('base64').replace(/=/g, '');
            const sep = this.config.tracking.server_url.includes('?') ? '&' : '?';
            const pixelUrl = `${this.config.tracking.server_url}${sep}open=1&r=${encodedRecipient}&c=${this.config.tracking.campaign_name}`;
            finalHtml += `<img src="${pixelUrl}" width="1" height="1" style="display:none !important;" />`;
        }

        // Data URI Image conversion
        if (this.config.data_uri_images?.convert_local) {
            const imgRegex = /<img[^>]+src="([^">]+)"/g;
            let match;
            while ((match = imgRegex.exec(finalHtml)) !== null) {
                const imgSrc = match[1];
                if (!imgSrc.startsWith('http') && !imgSrc.startsWith('data:')) {
                    try {
                        const imgPath = path.join(__dirname, '../../templates/format', imgSrc);
                        if (fs.existsSync(imgPath)) {
                            const imgData = fs.readFileSync(imgPath);
                            if (imgData.length <= (this.config.data_uri_images.max_size || 500000)) {
                                const ext = path.extname(imgPath).slice(1);
                                const dataUri = `data:image/${ext};base64,${imgData.toString('base64')}`;
                                finalHtml = finalHtml.replace(imgSrc, dataUri);
                            }
                        }
                    } catch (e) {}
                }
            }
        }

        // QR Code injection
        if (this.config.use_qrcode) {
            const qrUrl = this.data.links[Math.floor(Math.random() * this.data.links.length)] || "http://example.com";
            const qrData = await this._generateQrCode(this._processPlaceholders(qrUrl, recipient));
            finalHtml = finalHtml.replace(/\[\[QRCODE\]\]/g, `<img src="${qrData}" alt="QR Code" style="max-width: 200px;">`);
        }

        // Zero-font injection
        if (this.config.military_features?.zero_font_injection?.enabled) {
            const zeroFont = `<span style="display:none !important; font-size:0px !important; color:transparent !important; mso-hide:all;">${crypto.randomBytes(16).toString('hex')}</span>`;
            finalHtml = finalHtml.replace(/<\/p>/g, () => `${zeroFont}</p>`);
            finalHtml = finalHtml.replace(/<\/div>/g, () => `${zeroFont}</div>`);
        }

        // Spam Content Scorer
        if (this.config.military_features?.content_spam_scorer?.enabled) {
            const score = this._calculateSpamScore(finalHtml);
            if (score > 15) {
                // Auto-optimize: remove some "spammy" words if high
                finalHtml = finalHtml.replace(/buy/gi, 'get').replace(/free/gi, 'no-cost');
            }
        }

        finalHtml = this._applyPolymorphism(finalHtml);
        finalHtml = this._injectBayesianPoison(finalHtml);

        let boundary = undefined;
        if (this.config.military_features?.mime_randomization?.enabled) {
            boundary = `----=_NextPart_${crypto.randomBytes(12).toString('hex')}`;
        }

        const messageId = `<${crypto.randomBytes(12).toString('hex')}@${sender.split('@')[1].replace('>', '')}>`;
        const priorityMap = { 'high': '1', 'normal': '3', 'low': '5' };
        const priority = priorityMap[this.config.email_priority] || '3';

        const msgOptions = {
            subject: finalSubject,
            html: finalHtml,
            replyTo: this.config.reply_to,
            messageId: messageId,
            headers: {
                'X-Mailer': 'MAGXXIC-VOT-3.0',
                'X-Priority': priority,
                'Message-ID': messageId
            },
            attachments: [
                ...inlineImages,
                ...(this.config.send_attachment ? await this._prepareAttachments(recipient, sender, finalSubject, finalHtml) : [])
            ],
            list: {
                unsubscribe: {
                    url: this.config.unsubscribe_base_url + '?email=' + Buffer.from(recipient).toString('base64'),
                    comment: 'Unsubscribe'
                }
            }
        };

        if (this.config.inbox_mode) {
            msgOptions.headers['X-Mailprotector-Decision'] = 'deliver';
            msgOptions.headers['X-Mailer'] = this.config.x_mailer || 'Microsoft Outlook 16.0';
            // In inbox mode, if user hasn't specified priority, we default to high (1)
            if (!this.config.email_priority || this.config.email_priority === 'normal') {
                msgOptions.headers['X-Priority'] = '1';
            }
        }

        // Microsoft Optimization
        if (this.config.microsoft_optimization?.enabled) {
            msgOptions.headers['X-MS-Exchange-Organization-AuthAs'] = 'Internal';
            msgOptions.headers['X-MS-Exchange-Organization-AuthSource'] = 'microsoft.com';
            msgOptions.headers['X-MS-Has-Attach'] = 'yes';
            msgOptions.headers['X-MS-Exchange-Organization-Network-Message-Id'] = crypto.randomUUID();
            msgOptions.headers['X-MS-Exchange-Organization-SCL'] = '-1'; // Bypass SCL
        }

        if (this.config.dkim_enabled && this.config.dkim_private_key_path) {
            const dkimKeyPath = path.join(__dirname, '../../', this.config.dkim_private_key_path);
            if (fs.existsSync(dkimKeyPath)) {
                msgOptions.dkim = {
                    domainName: sender.split('@')[1],
                    keySelector: this.config.dkim_selector || 'dkim',
                    privateKey: fs.readFileSync(dkimKeyPath, 'utf8')
                };
            }
        }

        let success = false;
        let lastErr = "";
        const maxMxAttempts = this.config.mx_max_attempts || 3;
        const mxRetryPerServer = this.config.mx_retry_per_server || 2;
        const proxyRetries = this.config.proxy_connection_retries || 3;
        const backoff = this.config.proxy_retry_backoff || 2;

        for (const mx of mxHosts.slice(0, maxMxAttempts)) {
            for (let retry = 0; retry < mxRetryPerServer; retry++) {
                let attempts = 0;
                while (attempts <= proxyRetries) {
                    if (attempts > 0) {
                        // Exponential backoff
                        await new Promise(r => setTimeout(r, Math.pow(backoff, attempts) * 1000));
                        // Swap proxy on timeout/connection error
                        proxy = this.data.proxies.length > 0 ? this.data.proxies[this.proxyIndex++ % this.data.proxies.length] : null;
                    }

                    const [ok, err] = await sendDirectEmail(
                        mx,
                        sender,
                        recipient,
                        msgOptions,
                        proxy,
                        this.config.ehlo_hostname,
                        false, // debug
                        this.config.mx_smtp_timeout || 20
                    );

                    success = ok;
                    lastErr = err;

                    if (success) break;

                    if (err.includes('timeout') || err.includes('ECONNREFUSED') || err.includes('EHOSTUNREACH')) {
                        attempts++;
                    } else {
                        break; // Likely a server-side rejection, move to next server or retry
                    }
                }
                if (success) break;
                if (retry < mxRetryPerServer - 1) {
                    await new Promise(r => setTimeout(r, (this.config.mx_breathing_delay || 2) * 1000));
                }
            }
            if (success) break;
        }

        if (success) {
            this.stats.delivered++;
            if (!this.stats.domainEngagement[domain]) this.stats.domainEngagement[domain] = { delivered: 0, failed: 0 };
            this.stats.domainEngagement[domain].delivered++;

            if (!this.engagement[domain]) this.engagement[domain] = { delivered: 0, failed: 0 };
            this.engagement[domain].delivered++;

            // Test Email logic
            if (this.config.test_email && this.config.test_email_interval > 0) {
                if (this.stats.delivered % this.config.test_email_interval === 0) {
                    const testDomain = this.config.test_email.split('@')[1];
                    const testMx = await getMXRecords(testDomain);
                    if (testMx.length > 0) {
                        sendDirectEmail(testMx[0], sender, this.config.test_email, msgOptions, proxy, this.config.ehlo_hostname).catch(()=>{});
                    }
                }
            }
        } else {
            this.stats.failed++;
            if (!this.stats.domainEngagement[domain]) this.stats.domainEngagement[domain] = { delivered: 0, failed: 0 };
            this.stats.domainEngagement[domain].failed++;

            if (!this.engagement[domain]) this.engagement[domain] = { delivered: 0, failed: 0 };
            this.engagement[domain].failed++;
            if (lastErr.includes('550') || lastErr.includes('blocked')) {
                this.bounces.add(recipient);
            }
        }
        if (callback) callback(recipient, success, lastErr, finalSubject, tName, sender);
    }

    async scanFromEmails(callback) {
        this.stats.startTime = Date.now();
        this.stats.delivered = 0;
        this.stats.failed = 0;
        this.stats.total = this.data.senders.length;

        const testEmail = this.config.test_email || "test@example.com";
        const results = [];

        for (let i = 0; i < this.data.senders.length; i++) {
            const sender = this.data.senders[i];
            await this._processRecipient(testEmail, (rec, ok, err, sub, temp, snd) => {
                results.push({ sender, ok });
                if (callback) callback(sender, ok, err, i + 1, this.data.senders.length);
            }, sender);
        }

        this.stats.endTime = Date.now();
        return results;
    }
}

module.exports = { CampaignEngine };
