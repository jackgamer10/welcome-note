const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { CampaignEngine } = require('./magxxic/core/engine');
const { validateProxies } = require('./magxxic/core/proxy_validator');
const { getDkimOptions } = require('./magxxic/core/signer');
const { checkLicense } = require('./magxxic/core/licensing');

const baseDir = path.join(__dirname, 'magxxic');

function printBanner(version = "2.2.1") {
    const brain = chalk.red(`
         @@@@     @@@@@@@@@@@@@@@@@@     @@@@
       @@@@@@@  @@@@@@@@@@@@@@@@@@@@@@  @@@@@@@
                @@@@@@@@@@@@@@@@@@@@@@
                @@@@@@@@@@@@@@@@@@@@@@
                @@@@@@@@@@@@@@@@@@@@@@
                @@@@@@@@@@@@@@@@@@@@@@`);

    const banner = chalk.green("  __  __                             _        \n" +
" |  \\/  |                           (_)       \n" +
" | \\  / |  __ _   __ _ __  __ __  __ _   ___  \n" +
" | |\\/| | / _` | / _` |\\ \\/ / \\ \\/ /| | / __| \n" +
" | |  | || (_| || (_| | >  <   >  < | || (__  \n" +
" |_|  |_| \\__,_| \\__, |/_/\\_\\ /_/\\_\\|_| \\___| \n" +
"                  __/ |                       \n" +
"                 |___/                        \n");
    console.log(brain);
    console.log(banner);
    console.log(chalk.green("      >>> PROXY-ONLY DIRECT-TO-MX DELIVERY SYSTEM (NODE.JS) - STATUS: ARMED <<<"));
    console.log("      [RFC-2822] [DKIM-SIGNED] [SOCKS5-CHAIN] [ZERO-SMTP-RELAY]");
    console.log(`      VERSION ${version} | BUILD 2026-02-14 | SCORPION PROTOCOL`);
    console.log(chalk.green("=".repeat(85)));
}

function loadList(filepath) {
    if (fs.existsSync(filepath)) {
        return fs.readFileSync(filepath, 'utf8').split('\n').map(l => l.trim()).filter(l => l);
    }
    return [];
}

function loadTemplates(templateDir) {
    const templates = [];
    if (fs.existsSync(templateDir)) {
        fs.readdirSync(templateDir).forEach(f => {
            if (f.endsWith('.html')) {
                templates.push([f, fs.readFileSync(path.join(templateDir, f), 'utf8')]);
            }
        });
    }
    return templates;
}

function deliveryCallback(recipient, success, error, subject, templateName, sender) {
    const timestamp = new Date().toLocaleTimeString();
    const status = success ? chalk.green("DELIVERED") : chalk.red("FAILED");
    const maskRecipient = `${recipient.slice(0, 3)}***${recipient.slice(recipient.indexOf('@') - 1)}`;

    // Live Progress Stats
    const currentStats = `(${chalk.green(engineInstance.stats.delivered)}/${chalk.red(engineInstance.stats.failed)}/${engineInstance.stats.total})`;

    console.log(`[${timestamp}] ${status.padEnd(20)} ${maskRecipient.padEnd(25)} ${sender.padEnd(25)} ${currentStats}`);
    if (!success) {
        console.log(`      ${chalk.red('Error: ' + String(error).slice(0, 50) + (String(error).length > 50 ? '...' : ''))}`);
    }
}

async function interactiveDashboard(appConfig) {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (query) => new Promise((resolve) => readline.question(query, resolve));

    while (true) {
        process.stdout.write('\x1Bc');
        printBanner();
        console.log(chalk.blue.bold("=".repeat(30) + " CONFIGURATION DASHBOARD " + "=".repeat(29)));

        const options = [
            ["DKIM Signing", "dkim_enabled", appConfig.dkim_enabled !== false],
            ["IP-Hiding (SOCKS5)", "hide_ip", appConfig.hide_ip !== false],
            ["PDF Attachments", "attach_pdf", !!appConfig.attach_pdf],
            ["Military Grade Headers", "military_grade_headers", !!appConfig.military_grade_headers],
            ["Proxy Validation", "validate_proxies", appConfig.validate_proxies !== false],
            ["MX Pre-Check", "validate_mx_before_send", appConfig.validate_mx_before_send !== false],
            ["Port 25 Test", "test_connection_before_send", !!appConfig.test_connection_before_send],
            ["Dynamic EHLO", "auto_ehlo", !!appConfig.auto_ehlo],
            ["SMTP Debug Logs", "smtp_debug", !!appConfig.smtp_debug],
            ["Resilient Retries", "resilient_mode", (appConfig.proxy_retries || 0) > 0],
            ["Rotate Local IPs", "rotate_local_ips", !!appConfig.rotate_local_ips],
            ["Forge Relay Headers", "forge_relay_headers", !!appConfig.forge_relay_headers],
            ["Stealth Local Mode", "stealth_local_mode", appConfig.hide_ip === false && !!appConfig.forge_relay_headers && !!appConfig.auto_ehlo],
        ];

        options.forEach(([label, key, value], i) => {
            const valStr = value ? chalk.green("[ON]") : chalk.red("[OFF]");
            console.log(`  ${i + 1}. ${label.padEnd(30)} ${valStr}`);
        });

        console.log(chalk.blue("-".repeat(85)));
        console.log("  S. START CAMPAIGN");
        console.log("  Q. QUIT");
        console.log(chalk.blue("=".repeat(85)));

        const choice = (await question("\nSelect an option to toggle or 'S' to start: ")).trim().toLowerCase();

        if (choice === 's') {
            readline.close();
            return true;
        } else if (choice === 'q') {
            process.exit(0);
        } else {
            const idx = parseInt(choice) - 1;
            if (idx >= 0 && idx < options.length) {
                const key = options[idx][1];
                if (key === "resilient_mode") {
                    appConfig.proxy_retries = options[idx][2] ? 0 : 3;
                } else if (key === "stealth_local_mode") {
                    const isOn = options[idx][2];
                    appConfig.hide_ip = isOn;
                    appConfig.forge_relay_headers = !isOn;
                    appConfig.auto_ehlo = !isOn;
                } else {
                    appConfig[key] = !options[idx][2];
                }
            }
        }
    }
}

let engineInstance = null;

function formatBar(delivered, total, length = 20) {
    if (total === 0) return chalk.gray("░".repeat(length));
    const filled = Math.floor(delivered / total * length);
    const pct = (delivered / total) * 100;
    const color = pct > 70 ? chalk.green : pct > 30 ? chalk.yellow : chalk.red;
    return color("█".repeat(filled)) + chalk.gray("░".repeat(length - filled));
}

async function main() {
    // Check License
    if (!await checkLicense(baseDir)) {
        process.exit(0);
    }

    const { program } = require('commander');
    program
        .option('-a, --attach', 'Force enable PDF attachments')
        .option('-n, --no-attach', 'Force disable PDF attachments')
        .option('-p, --prob <number>', 'Set attachment probability (0-100)')
        .option('--dkim', 'Force enable DKIM signing')
        .option('--no-dkim', 'Force disable DKIM signing')
        .option('--hide-ip', 'Force enable IP hiding')
        .option('--show-ip', 'Force disable IP hiding')
        .parse(process.argv);

    const options = program.opts();

    const configPath = path.join(baseDir, 'config.json');
    let appConfig = {};
    if (fs.existsSync(configPath)) {
        appConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    // CLI Overrides
    if (options.attach) appConfig.attach_pdf = true;
    if (options.noAttach) appConfig.attach_pdf = false;
    if (options.prob) appConfig.attachment_probability = parseInt(options.prob);
    if (options.dkim === true) appConfig.dkim_enabled = true;
    if (options.dkim === false) appConfig.dkim_enabled = false;
    if (options.hideIp) appConfig.hide_ip = true;
    if (options.showIp) appConfig.hide_ip = false;

    const templateDir = path.join(baseDir, 'templates', 'format');
    const attachmentTemplateDir = path.join(baseDir, 'templates', 'attachments');
    const subjects = loadList(path.join(baseDir, 'subjects.txt'));
    const recipients = loadList(path.join(baseDir, 'recipients.txt'));
    const rawProxies = loadList(path.join(baseDir, 'proxies.txt'));
    const localIps = loadList(path.join(baseDir, 'local_ips.txt'));
    const links = loadList(path.join(baseDir, 'links.txt'));
    const templates = loadTemplates(templateDir);
    const attachmentTemplates = loadTemplates(attachmentTemplateDir);

    // Launch Dashboard
    if (Object.keys(options).length === 0) {
        await interactiveDashboard(appConfig);
    }

    process.stdout.write('\x1Bc');
    printBanner();

    // Local Port 25 Sanity Check
    if (appConfig.hide_ip === false || rawProxies.length === 0) {
        console.log(chalk.blue("[CHECK] ") + "Testing local outbound Port 25...");
        const reachable = await new Promise(resolve => {
            const s = require('net').createConnection(25, "smtp.google.com");
            s.setTimeout(5000);
            s.on('connect', () => { s.destroy(); resolve(true); });
            s.on('error', () => { resolve(false); });
            s.on('timeout', () => { s.destroy(); resolve(false); });
        });
        if (reachable) {
            console.log(`      ${chalk.green("Local Port 25: OPEN")}`);
        } else {
            console.log(`      ${chalk.yellow("[WARNING] Local Port 25 is CLOSED/BLOCKED.")}`);
            console.log(`                Direct delivery will fail without a functional SOCKS5 proxy.`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    let dkimOptions = null;
    const dkimKeyFilename = appConfig.dkim_private_key_path || 'dkim_private.pem';
    const dkimKeyPath = path.isAbsolute(dkimKeyFilename) ? dkimKeyFilename : path.join(baseDir, dkimKeyFilename);

    if (appConfig.dkim_enabled !== false && fs.existsSync(dkimKeyPath)) {
        dkimOptions = getDkimOptions(appConfig.sender_domain || "example.com", appConfig.dkim_selector || "default", dkimKeyPath);
    }

    let proxies = rawProxies;
    if (rawProxies.length > 0 && appConfig.validate_proxies !== false) {
        console.log(chalk.blue("[VALIDATING] ") + `Checking ${rawProxies.length} proxies...`);
        proxies = await validateProxies(rawProxies, 20, !!appConfig.test_connection_before_send);
        console.log(`      ${chalk.green(proxies.length + "/" + rawProxies.length + " proxies functional.")}`);
        if (proxies.length === 0 && appConfig.hide_ip !== false) {
            console.log(chalk.red("[ERROR] No working proxies found and IP-HIDING is ENABLED. Aborting."));
            return;
        }
    }

    const engine = new CampaignEngine({
        ...appConfig,
        subjects,
        templates,
        attachment_templates: attachmentTemplates,
        recipients,
        proxies,
        local_ips: localIps,
        links,
        dkim: dkimOptions,
        senders: appConfig.senders || ["info@example.com"],
        ehloHost: appConfig.ehlo_host || "example.com"
    });

    console.log(chalk.green("[GO] LAUNCHING CAMPAIGN (NODE.JS)"));
    console.log(chalk.white.bold(`${'TIME'.padEnd(10)} ${'STATUS'.padEnd(20)} ${'RECIPIENT'.padEnd(25)} ${'SENDER'.padEnd(25)} ${'PROGRESS'}`));
    console.log("-".repeat(100));

    engineInstance = engine;
    const stats = await engine.run(deliveryCallback);

    const duration = (stats.endTime - stats.startTime) / 1000;
    const throughput = (stats.delivered + stats.failed) / (duration / 60) || 0;
    const successRate = (stats.delivered / stats.total * 100) || 0;

    console.log("\n" + chalk.green("=".repeat(85)));
    console.log(chalk.green("OPERATION COMPLETE - MAGXXIC V2.2.1 (NODE.JS)"));
    console.log(chalk.green("=".repeat(85)));

    console.log(chalk.white.bold("[DELIVERY STATISTICS]"));
    console.log(`  DELIVERED:    ${chalk.green(stats.delivered + " emails")}`);
    console.log(`  FAILED:       ${chalk.red(stats.failed + " emails")}`);
    console.log(`  TOTAL:        ${stats.total} emails`);
    const rateColor = successRate > 80 ? chalk.green : successRate > 20 ? chalk.yellow : chalk.red;
    console.log(`  SUCCESS RATE: ${rateColor(successRate.toFixed(1) + "%")} (${successRate > 80 ? 'HEALTHY' : successRate > 20 ? 'DEGRADED' : 'CRITICAL'})`);

    console.log("\n" + chalk.white.bold("[PERFORMANCE METRICS]"));
    console.log(`  DURATION:     ${chalk.cyan(duration.toFixed(1) + "s")}`);
    console.log(`  THROUGHPUT:   ${chalk.cyan(throughput.toFixed(1) + " emails/minute")}`);

    console.log("\n" + chalk.blue("-".repeat(85)));
    console.log(chalk.white.bold("DOMAIN ENGAGEMENT REPORT"));
    console.log(chalk.blue("-".repeat(85)));

    Object.entries(stats.domainEngagement).sort((a,b) => (b[1].delivered+b[1].failed) - (a[1].delivered+a[1].failed)).slice(0, 15).forEach(([domain, data]) => {
        const dTotal = data.delivered + data.failed;
        const dRate = (data.delivered / dTotal * 100) || 0;
        const bar = formatBar(data.delivered, dTotal);
        console.log(`  ${domain.padEnd(30)} ${bar} ${dRate.toFixed(0).padStart(3)}% (${data.delivered}/${dTotal})`);
    });

    console.log(chalk.blue("=".repeat(85)));
    process.exit(0);
}

main().catch(err => {
    console.error(chalk.red(err));
    process.exit(1);
});
