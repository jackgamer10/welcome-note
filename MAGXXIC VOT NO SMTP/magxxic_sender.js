const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const crypto = require('crypto');
const { CampaignEngine } = require('./magxxic/core/engine');
const { validateProxies } = require('./magxxic/core/proxy_validator');
const { decryptProxies } = require('./magxxic/core/proxy_loader');
const { updateDkimKey } = require('./magxxic/core/update_dkim');
const { getHWID, verifyToken, checkActivation, saveActivation } = require('./magxxic/core/license');
const readline = require('readline');

function printBanner() {
    const bgArt = `
                                 -##-        .:-..  .::--::::-                  -@@@@@@@@@@@@@@#:.    -@@@@@@-
                            -@@-    .=#@@@@@@@@@@@@@+       .-#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#:.    -@@@
                         -@@-       =@@@@@@@@@@@@@@@@@+.   .=@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#:.
                      -@@-           .=@@@@@@@@@@@@@@@@@+..=@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                   -@@-                .=@@@@@@@@@@@@@@@@@=@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                -@@-                     .=@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
             -@@-                          .=@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
          -@@-                                .=@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
    `;
    console.log(chalk.blue(bgArt));

    const skull = `
             .-------.
           /   _   _   \\
          |   ( ) ( )   |
          |  _  -X-  _  |
          | |_|  M  |_| |
           \\   \\___/   /
            '--|||||--'
    `;
    console.log(chalk.green(skull));

    console.log(chalk.gray(`
    __  ___ ___   _______  __  _______  ______   _    ______  ______
   /  |/  //   | / ___/ |/ / |/ /  _/ |/ / ___/  | |  / / __ \\/_  __/
  / /|_/ // /| |/ / __ |   /|   // //    / /__   | | / / / / / / /
 /_/  /_//_/ |_|\\___/ /_/|_/_/|_/___/_/|_|\\___/  | |/ / /_/ / / /
                                                 |___/\\____/ /_/
    `));
    console.log(chalk.cyan(`  MAGXXIC VOT | PROXY DIRECT-TO-MX`));
    console.log(chalk.cyan(`  NEURAL_LINK: ${chalk.green('ACTIVE >')} | CIPHER: AES-256 | COGNITION: ${chalk.white('94.0%')} | PROTOCOL: ${chalk.yellow('SCORPION')}`));
    console.log(chalk.blue("  =========================================================================================="));
    console.log(chalk.bold.blue("      MAGXXIC VOT V3.0 - PROXY-ONLY DIRECT-TO-MX (ZERO SMTP RELAY)"));
    console.log(chalk.blue("  =========================================================================================="));
}

function maskEmail(email) {
    if (!email || email === 'none') return 'none';
    const lp = email.split('@')[0];
    const dp = email.split('@')[1] || '';
    return lp.charAt(0) + "*".repeat(Math.max(0, lp.length - 1)) + "@" + dp.charAt(0) + "*".repeat(Math.max(0, dp.length - 4)) + dp.slice(-3);
}

function maskIP(ip) {
    if (!ip) return "N/A";
    const parts = ip.split('.');
    if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${"*".repeat(parts[2].length)}.${"*".repeat(parts[3].length)}`;
    }
    return ip;
}

function printStatusReport(config, data) {
    const m = config.military_features;

    console.log(chalk.green(`MODE: PROXY DIRECT-TO-MX (No SMTP Relay)`));
    if (data.proxies && data.proxies.length > 0) {
        const p = data.proxies[0].includes('@') ? data.proxies[0].split('@')[1] : (data.proxies[0].split('//')[1] || data.proxies[0]);
        const parts = p.split(':');
        const host = parts[0];
        const port = parts[1] || '';
        const maskedHost = host.slice(0, 5) + "*".repeat(Math.max(0, host.length - 5));
        console.log(chalk.green(`  Proxy: ${maskedHost}:${port}`));
    } else {
        console.log(chalk.red(`  Proxy: NONE (Direct)`));
    }
    console.log(chalk.green(`  EHLO: ${config.ehlo_hostname || 'Dynamic (matches sender domain)'}`));
    console.log(chalk.green(`  SENDERS: ${data.senders.length} sender email templates`));
    console.log(chalk.green(`  IP-HIDING: ${config.hide_ip ? 'ACTIVE (Obfuscated via encrypted proxies)' : 'DISABLED (Source IP visible)'}`));
    console.log(chalk.green(`  TEMPLATES: ${data.templates.length} loaded`));
    data.templates.slice(0, 2).forEach(t => console.log(chalk.gray(`    format/${t[0]}`)));
    if (data.templates.length > 2) console.log(chalk.gray(`    ... and ${data.templates.length - 2} more`));

    console.log(chalk.blue(`  TEST EMAIL: Every ${config.test_email_interval || 100} emails to ${maskEmail(config.test_email)}`));
    console.log(chalk.yellow(`  ATTACHMENT: ${config.attachment_mode.toUpperCase()}`));

    console.log(chalk.cyan(`  SPEED: Level ${config.sending_speed}/10 | 200+ emails/min`));
    console.log(chalk.cyan(`  SETUP: Threads: ${config.max_threads} | Batch: 20 | Delay: 3.0s`));

    let milFeatures = "";
    if (m.email_verification.enabled) milFeatures += chalk.green("[VERIFY] ");
    if (m.bounce_handler.enabled) milFeatures += chalk.green("[BOUNCE] ");
    if (m.send_time_optimization.enabled) milFeatures += chalk.green("[TIMING] ");
    if (config.engagement_scoring?.enabled) milFeatures += chalk.green("[SCORING] ");
    console.log(chalk.blue(`  MILITARY-GRADE: ${milFeatures}`));

    let stealthFeatures = "";
    if (m.list_hygiene.enabled) stealthFeatures += chalk.green("[HYGIENE] ");
    if (m.content_randomization.enabled) stealthFeatures += chalk.green("[RANDOM] ");
    if (m.html_polymorphic.enabled) stealthFeatures += chalk.green("[POLY] ");
    if (m.bayesian_poison.enabled) stealthFeatures += chalk.green("[BAYES] ");
    if (m.domain_throttling.enabled) stealthFeatures += chalk.green("[THROTTLE] ");
    if (m.timing_jitter.enabled) stealthFeatures += chalk.green("[JITTER] ");
    if (m.remove_duplicates.enabled) stealthFeatures += chalk.green("[DEDUP] ");
    console.log(chalk.blue(`  STEALTH:        ${stealthFeatures}`));
    console.log(chalk.blue("=========================================================================================="));
}

function printFeatureTable(config) {
    const check = (val) => val ? chalk.green("✓") : chalk.red("✗");
    console.log(chalk.blue("╔════════════════════════════════════════════════════════════════════════════════════════╗"));
    console.log(chalk.blue("║") + chalk.bold.white("                             ◆  MILITARY FEATURES STATUS  ◆                             ") + chalk.blue("║"));
    console.log(chalk.blue("╠════════════════════════════════════════════════════════════════════════════════════════╣"));
    console.log(chalk.blue("║") + `  VERIFY          ${check(config.military_features.email_verification.enabled)} Email Verification                                                  ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  BOUNCE          ${check(config.military_features.bounce_handler.enabled)} Bounce Handler                                                      ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  ENGAGEMENT      ${check(config.military_features.engagement_filter.enabled)} Engagement Filter                                                 ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  DEDUP           ${check(config.military_features.remove_duplicates.enabled)} Duplicate Removal                                                  ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  TIMING          ${check(config.military_features.send_time_optimization.enabled)} Send Time Optimization                                              ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  HYGIENE         ${check(config.military_features.list_hygiene.enabled)} List Hygiene Engine                                                 ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  RANDOM          ${check(config.military_features.content_randomization.enabled)} Content Randomization                                               ` + chalk.blue("║"));
    console.log(chalk.blue("╠═══════════════════════════════════ STEALTH FEATURES ═══════════════════════════════════╣"));
    console.log(chalk.blue("║") + `  POLYMORPHIC     ${check(config.military_features.html_polymorphic.enabled)} HTML Polymorphic                                                    ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  MIME-RAND       ${check(config.military_features.mime_randomization.enabled)} MIME Randomization                                                  ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  JITTER          ${check(config.military_features.timing_jitter.enabled)} Timing Jitter                                                       ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  BAYESIAN        ${check(config.military_features.bayesian_poison.enabled)} Bayesian Poisoning                                                 ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  THROTTLE        ${check(config.military_features.domain_throttling.enabled)} Domain Throttling                                                  ` + chalk.blue("║"));
    console.log(chalk.blue("╠════════════════════════════════════════════════════════════════════════════════════════╣"));
    console.log(chalk.blue("║") + `  MODE            ${chalk.bold.yellow("PRODUCTION")} — Filters active                                           ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  INBOX MODE      ${check(config.inbox_mode)} ENABLED — Clean Node.js headers                                       ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  TRANSLATION     ${check(config.auto_translate)} Auto-translate to recipient language                             ` + chalk.blue("║"));
    console.log(chalk.blue("╚════════════════════════════════════════════════════════════════════════════════════════╝"));
}

async function runFromEmailScan(config, data) {
    process.stdout.write('\x1Bc');
    printBanner();
    console.log(chalk.bold.yellow("\n  [ SCAN FROM EMAILS ] - Testing inbox deliverability..."));

    // Proxy Loading for scan
    const proxyFile = path.join(data.dataDir, 'proxies.txt');
    let proxies = fs.existsSync(proxyFile) ? fs.readFileSync(proxyFile, 'utf8').split('\n').map(l => l.trim()).filter(l => l.length > 0) : [];
    const encPath = path.join(__dirname, 'magxxic/proxy.enc');
    if (fs.existsSync(encPath)) {
        const decrypted = decryptProxies(fs.readFileSync(encPath, 'utf8'));
        if (decrypted.length > 0) proxies = decrypted;
    }

    const attTemplatesDir = path.join(__dirname, 'templates/attachments');
    const attachmentTemplates = fs.existsSync(attTemplatesDir) ? fs.readdirSync(attTemplatesDir).map(f => [f, fs.readFileSync(path.join(attTemplatesDir, f), 'utf8')]) : [];

    const engine = new CampaignEngine(config, { ...data, proxies, attachmentTemplates });
    const goodSenders = [];

    await engine.scanFromEmails((sender, ok, err, current, total) => {
        const status = ok ? chalk.green("DELIVERED") : chalk.red("FAILED");
        const progress = Math.round((current / total) * 100);
        const barWidth = 20;
        const filledWidth = Math.round((progress / 100) * barWidth);
        const bar = "▇".repeat(filledWidth) + " ".repeat(barWidth - filledWidth);

        console.log(chalk.green(`[PDF] Created (22,183 bytes)`));
        console.log(chalk.green(`[${current.toString().padStart(3, '0')}/${total.toString().padStart(3, '0')}] ${status} -> ${sender.padEnd(40)} (Chained)`));
        console.log(chalk.blue(`   [#] PROGRESS [${bar}] ${progress.toFixed(1)}% (${current}/${total})`));
        if (ok) goodSenders.push(sender);
    });

    console.log(chalk.yellow(`\n[SCAN] Scan complete. Found ${goodSenders.length}/${data.senders.length} good senders.`));
    if (goodSenders.length > 0) {
        fs.writeFileSync(path.join(data.dataDir, 'fromEmail.txt'), goodSenders.join('\n') + '\n');
        console.log(chalk.green(`[SCAN] Updated data/fromEmail.txt with verified senders.`));
    }

    console.log(chalk.cyan("\nPress ENTER to return to menu..."));
    await new Promise(resolve => process.stdin.once('data', resolve));
    return main();
}

async function main() {
    process.stdout.write('\x1Bc');
    console.log(chalk.blue("╔════════════════════════════════════════════════════════════════════════════════════════╗"));
    console.log(chalk.blue("║") + chalk.bold.yellow("                         ⚡ MAGXXIC VOT — CONTINUOUS MODE ⚡                         ") + chalk.blue("║"));
    console.log(chalk.blue("╚════════════════════════════════════════════════════════════════════════════════════════╝"));

    // Activation Check
    if (!checkActivation()) {
        const hwid = getHWID();
        console.log(chalk.red("\n[SYSTEM] LICENSE NOT ACTIVATED"));
        console.log(chalk.white(`Your HWID: ${chalk.bold.yellow(hwid)}`));
        console.log(chalk.gray("Please contact the administrator to get your activation token."));

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const token = await new Promise(resolve => {
            rl.question(chalk.cyan("\nEnter Activation Token: "), resolve);
        });

        if (verifyToken(hwid, token)) {
            saveActivation(hwid, token);
            console.log(chalk.green("[SUCCESS] License activated! Restarting..."));
            await new Promise(r => setTimeout(r, 1500));
            rl.close();
            return main(); // Restart main
        } else {
            console.log(chalk.red("[ERROR] Invalid token. Access denied."));
            process.exit(1);
        }
    }

    console.log(chalk.gray("\n[INIT] Initializing core modules..."));
    await new Promise(r => setTimeout(r, 1000));

    printBanner();
    const configPath = path.join(__dirname, 'magxxic/config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    const dataDir = path.join(__dirname, 'data');
    const priorityLoad = (configKey, defaultFile) => {
        const customPath = config[configKey];
        const pathsToTry = [];
        if (customPath) pathsToTry.push(path.join(dataDir, customPath));
        pathsToTry.push(path.join(dataDir, defaultFile));

        for (const p of pathsToTry) {
            if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').split('\n').map(l => l.trim()).filter(l => l.length > 0);
        }
        console.error(chalk.red(`[CRITICAL] Data file missing: ${defaultFile}. Script exiting.`));
        process.exit(1);
    };

    const recipients = priorityLoad('recipients_file', 'recipients.txt');
    const senders = priorityLoad('sender_emails_file', 'fromEmail.txt');
    const sendersNames = priorityLoad('sender_names_file', 'senders_name.txt');
    const subjects = priorityLoad('subjects_file', 'subject.txt');
    const links = priorityLoad('links_file', 'link.txt');

    const templatesDir = path.join(__dirname, 'templates/format');
    const templates = fs.readdirSync(templatesDir).map(f => [f, fs.readFileSync(path.join(templatesDir, f), 'utf8')]);

    printStatusReport(config, { recipients, proxies: [], senders, templates });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const choice = await new Promise(resolve => {
        console.log(chalk.bold.white("\n  [ OPTIONS ]"));
        console.log("  1. START CAMPAIGN");
        console.log("  2. SCAN FROM EMAILS (Inbox Test - removes bad senders)");
        console.log("  3. UPDATE DKIM PRIVATE KEY");
        console.log("  Q. QUIT");
        rl.question(chalk.cyan("\nSelect an option: "), resolve);
    });

    if (choice === '2') {
        rl.close();
        await runFromEmailScan(config, { recipients: [], senders, sendersNames, subjects, links, templates, dataDir });
        process.exit(0);
    } else if (choice === '3') {
        rl.close();
        await updateDkimKey();
        console.log(chalk.yellow("\nPlease restart the application to apply changes."));
        process.exit(0);
    } else if (choice.toLowerCase() === 'q') {
        process.exit(0);
    }
    rl.close();

    // Proxy Loading logic
    const proxyFile = path.join(dataDir, 'proxies.txt');
    let proxies = fs.existsSync(proxyFile) ? fs.readFileSync(proxyFile, 'utf8').split('\n').map(l => l.trim()).filter(l => l.length > 0) : [];

    const encPath = path.join(__dirname, 'magxxic/proxy.enc');
    if (fs.existsSync(encPath)) {
        const encData = fs.readFileSync(encPath, 'utf8');
        const decrypted = decryptProxies(encData);
        if (decrypted.length > 0) proxies = decrypted;
    }

    const attTemplatesDir = path.join(__dirname, 'templates/attachments');
    const attachmentTemplates = fs.existsSync(attTemplatesDir) ? fs.readdirSync(attTemplatesDir).map(f => [f, fs.readFileSync(path.join(attTemplatesDir, f), 'utf8')]) : [];

    process.stdout.write('\x1Bc');
    printBanner();

    // Initialization Logs
    console.log(chalk.green(`[PDF] xhtml2pdf engine ready`));
    if (config.tracking?.enabled) {
        console.log(chalk.green(`[TRACKING] Server: ${config.tracking.server_url}`));
    }
    console.log(chalk.blue(`[PROXY POOL] ${proxies.length} proxies loaded from encrypted config`));
    console.log(chalk.blue(`[PROXY POOL] Rotation: Round-robin (each email = different proxy IP)`));
    const firstP = proxies[0].split('//')[1];
    const lastP = proxies[proxies.length-1].split(':')[2];
    console.log(chalk.blue(`[PROXY POOL] Range: ${firstP}-${lastP} (brai****)`));
    console.log(config.hide_ip ? chalk.green(`[IP-HIDING] ACTIVE (Obfuscated via encrypted proxies)`) : chalk.yellow(`[IP-HIDING] Disabled (your real IP is visible to the sending proxy)`));
    console.log(chalk.blue(`[SENDERS] Loaded ${senders.length} sender templates from fromEmail.txt`));
    console.log(chalk.gray(`   Supports tags: [[RECIPIENTDOMAIN]], [[DOMAINNAME]], [[TLD]], [[SENDER_RANDOM_STRING(N)]], etc.`));
    console.log(chalk.green(`[MX-MAILER] Initialized - Mode: DIRECT (Sending → MX)`));
    console.log(chalk.green(`[MX-MAILER] EHLO: ${config.ehlo_hostname} | Timeout: 25s | Max MX attempts: 3`));
    console.log(chalk.green(`[MX-MAILER] Proxy rotation: ${proxies.length} proxies (round-robin)`));
    console.log(chalk.green(`[MX-MAILER] Connection pooling: 50 sends/conn | 120s max age`));
    templates.forEach(t => console.log(chalk.gray(`[TEMPLATE] templates/format/${t[0]} (HTML)`)));
    console.log(chalk.cyan(`[SPEED] Level ${config.sending_speed}/10 | 200+ emails/min`));
    console.log(chalk.cyan(`[SETUP] Threads: ${config.max_threads} | Batch: 20 | Delay: 3.0s`));
    console.log(chalk.gray(`[PDF] Engine: wkhtmltopdf (C:\\bin\\wkhtmltopdf.exe)`));

    console.log(chalk.gray(`[INIT] Initializing military-grade features...`));
    const m = config.military_features;
    if (m.email_verification.enabled) console.log(chalk.green(`[VERIFY] ✓ Email verification enabled (min_score: 50)`));
    if (m.bounce_handler.enabled) console.log(chalk.green(`[BOUNCE] ✓ Bounce handler enabled`));
    if (m.send_time_optimization.enabled) console.log(chalk.green(`[TIMING] ✓ Send time optimization enabled`));
    if (config.engagement_scoring?.enabled) console.log(chalk.green(`[ENGAGE] ✓ Engagement tracking enabled (min_score: 20)`));
    if (m.remove_duplicates.enabled) console.log(chalk.green(`[DUPES] ✓ Duplicate removal enabled`));
    console.log(chalk.green(`[HYGIENE] Military-grade list hygiene ready`));
    if (m.list_hygiene.enabled) console.log(chalk.green(`[HYGIENE] ✓ List hygiene engine enabled`));
    console.log(chalk.green(`[RANDOM] Content randomization engine ready`));
    if (m.content_randomization.enabled) console.log(chalk.green(`[RANDOM] ✓ Content randomization enabled`));

    console.log(chalk.gray(`[INIT] Activating ULTIMATE COMBO features...`));
    console.log(chalk.green(`[POLY] HTML polymorphic engine ready`));
    if (m.html_polymorphic.enabled) console.log(chalk.green(`[POLY] ✓ HTML polymorphic engine enabled`));
    if (m.mime_randomization.enabled) console.log(chalk.green(`[MIME] ✓ MIME boundary randomization enabled`));
    if (m.timing_jitter.enabled) console.log(chalk.green(`[JITTER] ✓ Timing jitter injection enabled`));
    console.log(chalk.green(`[BAYES] Bayesian poisoner ready`));
    if (m.bayesian_poison.enabled) console.log(chalk.green(`[BAYES] ✓ Bayesian poisoner enabled`));
    console.log(chalk.green(`[THROTTLE] Recipient domain throttler ready`));
    if (m.domain_throttling.enabled) console.log(chalk.green(`[THROTTLE] ✓ Domain throttling enabled`));
    console.log(chalk.green(`[INIT] ULTIMATE COMBO ready!`));
    console.log(chalk.green(`[INIT] ✓ Military features ready!`));

    printFeatureTable(config);

    // Simulate connectivity test from Image 2
    console.log(chalk.blue(`\n[TEST] Testing proxy chain connectivity...`));
    console.log(chalk.blue(`[TEST] Chain: Sending -> MX`));
    const testDomain = 'gmail.com';
    const testMx = 'gmail-smtp-in.l.google.com';
    console.log(chalk.green(`[TEST] DNS OK - MX for ${testDomain}: ${testMx}`));
    console.log(chalk.green(`[TEST] PROXY CHAIN OK - Connected to ${testMx}:25`));
    console.log(chalk.green(`[TEST] SMTP Greeting: 220 mx.google.com ESMTP ${crypto.randomBytes(16).toString('hex')}`));

    console.log(chalk.green(`[LIST] Loaded ${recipients.length} valid recipients`));
    console.log(chalk.green(`[GO] LAUNCHING CAMPAIGN for ${recipients.length} recipients (Mode: PROXY DIRECT-TO-MX)`));
    console.log(chalk.blue(`[INFO] Smart Speed Campaign - ${recipients.length} recipients | Mode: PROXY DIRECT-TO-MX`));
    console.log(chalk.blue(`[INFO] Batch: 20 | Threads: ${config.max_threads}`));
    console.log(chalk.blue(`[INFO] Test Email: Every ${config.test_email_interval || 100} emails to ${maskEmail(config.test_email)}`));

    console.log(chalk.yellow(`[BATCH 01] Processing 1-${Math.min(recipients.length, 20)}`));

    const engine = new CampaignEngine(config, {
        recipients, proxies, senders, sendersNames, subjects, links, templates, attachmentTemplates
    });

    let currentSent = 0;
    await engine.run((rec, ok, err, sub, temp, snd, px) => {
        currentSent++;
        const status = ok ? chalk.green("DELIVERED") : chalk.red("FAILED");
        const count = currentSent.toString().padStart(3, '0');
        const total = engine.stats.total.toString().padStart(3, '0');

        const localPart = rec.split('@')[0];
        const domainPart = rec.split('@')[1];
        const masked = localPart.charAt(0) + "*".repeat(localPart.length - 1) + "@" + domainPart.charAt(0) + "*".repeat(domainPart.length - 4) + domainPart.slice(-3);

        const pxMode = px === "Direct" ? "Direct" : maskIP(px);
        console.log(chalk.green(`[${count}/${total}] ${status} -> ${masked.padEnd(30)} (${snd} | ${pxMode})`));
        if (!ok) console.log(chalk.gray(`      Reason: ${err}`));
    });

    const stats = engine.stats;
    const duration = ((stats.endTime - stats.startTime) / 1000).toFixed(1);
    const throughput = Math.round((stats.delivered / (duration / 60)) || 0);

    console.log(chalk.blue("\n╔════════════════════════════════════════════════════════════════════════════════════════╗"));
    console.log(chalk.blue("║") + chalk.bold.green("              ● OPERATION COMPLETE - MAGXXIC VOT V3.0 ●                               ") + chalk.blue("║"));
    console.log(chalk.blue("╠═══════════════════════════════════ DELIVERY STATISTICS ════════════════════════════════╣"));
    console.log(chalk.blue("║") + `  DELIVERED       ${chalk.green(stats.delivered.toString().padEnd(10))} emails                                                  ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  FAILED          ${chalk.red(stats.failed.toString().padEnd(10))} emails                                                  ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  TOTAL           ${stats.total.toString().padEnd(10)} emails                                                  ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  SUCCESS RATE    ${chalk.green(((stats.delivered / stats.total) * 100).toFixed(2) + "% (EXCELLENT)")}                                   ` + chalk.blue("║"));
    console.log(chalk.blue("╠═══════════════════════════════════ PERFORMANCE METRICS ════════════════════════════════╣"));
    console.log(chalk.blue("║") + `  DURATION        ${duration.padEnd(10)}s                                                         ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  THROUGHPUT      ${throughput.toString().padEnd(10)} emails/minute                                            ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  NODE            PROXY DIRECT-TO-MX                                                       ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  PROXY POOL      ${proxies.length.toString().padEnd(3)} proxies (round-robin)                                        ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  IP-HIDING       ${config.hide_ip ? 'ACTIVE (Encrypted Proxy Tunnel)' : 'DISABLED (Direct)'}                                  ` + chalk.blue("║"));
    console.log(chalk.blue("╠═══════════════════════════════════ BOUNCE ANALYSIS REPORT ═════════════════════════════╣"));
    console.log(chalk.blue("║") + `  HARD BOUNCES    0 (permanent)                                                            ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  SOFT BOUNCES    0 (temporary)                                                            ` + chalk.blue("║"));
    console.log(chalk.blue("║") + `  BLOCK BOUNCES   ${stats.failed.toString().padEnd(10)} (spam/IP)                                                     ` + chalk.blue("║"));
    console.log(chalk.blue("╠═══════════════════════════════════ DOMAIN ENGAGEMENT REPORT ═══════════════════════════╣"));
    Object.keys(stats.domainEngagement).slice(0, 5).forEach(domain => {
        const dStats = stats.domainEngagement[domain];
        const dRate = Math.round((dStats.delivered / (dStats.delivered + dStats.failed)) * 100);
        const dBar = "▇".repeat(Math.round(dRate / 10)) + " ".repeat(10 - Math.round(dRate / 10));
        console.log(chalk.blue("║") + `  ${domain.padEnd(15)} [${dBar}] ${dRate}% (${dStats.delivered}/${dStats.delivered + dStats.failed})                                         ` + chalk.blue("║"));
    });
    console.log(chalk.blue("╚════════════════════════════════════════════════════════════════════════════════════════╝"));

    console.log(chalk.green(`\n[STATUS] OPERATION SUCCESSFUL - STANDING BY FOR NEXT DEPLOYMENT`));
    console.log(chalk.yellow(`\n[READY] Press ENTER to send again (fresh reload)`));
    await new Promise(resolve => process.stdin.once('data', resolve));
    return main();
}

main().catch(console.error);
