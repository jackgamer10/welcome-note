const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { CampaignEngine } = require('./magxxic/core/engine');
const { validateProxies } = require('./magxxic/core/proxy_validator');
const { decryptProxies } = require('./magxxic/core/proxy_loader');

function printBanner() {
    console.log(chalk.cyan(`
  __  __   _    ____ _  __ _  __ ___ ____   __   _____ _____
 |  \\/  | / \\  / ___| \\/ /| |/ /|_ _/ ___|  \\ \\ / / _ \\_   _|
 | |\\/| |/ _ \\| |  _ \\  / | ' /  | | |       \\ V / | | || |
 | |  | / ___ | |_| |/  \ | . \\  | | |___     | || |_| || |
 |_|  |/_/   \\_\\____/_/\\_\\|_|\\_\\|___\\____|    |_| \\___/ |_|
    `));
    console.log(chalk.bold.white("  MAGXXIC VOT NO SMTP - Advanced Direct-to-MX Delivery System"));
    console.log(chalk.green("  [ULTIMATE COMBO] [MILITARY GRADE] [STEALTH EDITION]\n"));
}

function printStatusTable(config) {
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
    console.log(chalk.blue("╚════════════════════════════════════════════════════════════════════════════════════════╝"));
}

async function main() {
    printBanner();
    const configPath = path.join(__dirname, 'magxxic/config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    const dataDir = path.join(__dirname, 'data');
    const load = (f) => fs.existsSync(path.join(dataDir, f)) ? fs.readFileSync(path.join(dataDir, f), 'utf8').split('\n').filter(l => l.trim()) : [];

    const recipients = load('recipients.txt');

    // Proxy Loading logic
    let proxies = load('proxies.txt');
    const encPath = path.join(__dirname, 'magxxic/proxy.enc');
    if (fs.existsSync(encPath)) {
        console.log(chalk.blue("[PROXY POOL] ") + "Loading proxies from encrypted config...");
        const encData = fs.readFileSync(encPath, 'utf8');
        const decrypted = decryptProxies(encData);
        if (decrypted.length > 0) {
            proxies = decrypted;
            console.log(chalk.blue("[PROXY POOL] ") + `${proxies.length} proxies loaded from encrypted config`);
            console.log(chalk.blue("[PROXY POOL] ") + "Rotation: Round-robin (each email = different proxy IP)");
            console.log(chalk.blue("[PROXY POOL] ") + `Range: ${proxies[0].split('//')[1]} to ${proxies[proxies.length-1].split('//')[1].split(':').pop()}`);
        }
    }

    const senders = load('fromEmail.txt').length > 0 ? load('fromEmail.txt') : config.sender_emails;
    const subjects = load('subject.txt');
    const links = load('link.txt');

    const templatesDir = path.join(__dirname, 'templates/format');
    const templates = fs.readdirSync(templatesDir).map(f => [f, fs.readFileSync(path.join(templatesDir, f), 'utf8')]);

    const attTemplatesDir = path.join(__dirname, 'templates/attachments');
    const attachmentTemplates = fs.existsSync(attTemplatesDir) ? fs.readdirSync(attTemplatesDir).map(f => [f, fs.readFileSync(path.join(attTemplatesDir, f), 'utf8')]) : [];

    printStatusTable(config);

    const engine = new CampaignEngine(config, {
        recipients, proxies, senders, subjects, links, templates, attachmentTemplates
    });

    console.log(chalk.green("\n[INIT] Starting campaign..."));

    await engine.run((rec, ok, err, sub, temp, snd) => {
        const status = ok ? chalk.green("DELIVERED") : chalk.red("FAILED");
        console.log(`[${new Date().toLocaleTimeString()}] ${status} | ${rec.padEnd(30)} | ${snd}`);
        if (!ok) console.log(chalk.gray(`      Reason: ${err}`));
    });

    console.log(chalk.bold.green("\nCampaign Complete."));
}

main().catch(console.error);
