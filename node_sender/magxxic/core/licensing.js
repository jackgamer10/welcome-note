const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

function getHwid() {
    const systemInfo = `${os.hostname()}-${os.arch()}-${os.platform()}-${os.totalmem()}`;
    return crypto.createHash('sha256').update(systemInfo).digest('hex').toUpperCase().slice(0, 16);
}

function generateToken(hwid, secret = "MAGXXIC-SECRET-2024") {
    const tokenSource = `${hwid}-${secret}`;
    return crypto.createHash('sha256').update(tokenSource).digest('hex').toUpperCase().slice(0, 24);
}

async function checkLicense(baseDir) {
    const licensePath = path.join(baseDir, 'license.json');
    const hwid = getHwid();

    if (fs.existsSync(licensePath)) {
        try {
            const data = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
            if (data.hwid === hwid && data.token === generateToken(hwid)) {
                return true;
            }
        } catch (err) {}
    }

    console.log(chalk.red("=".repeat(85)));
    console.log(chalk.red("[LICENSE] SOFTWARE NOT ACTIVATED"));
    console.log(`YOUR HWID: ${chalk.yellow(hwid)}`);
    console.log(chalk.blue("Please provide your HWID to an administrator to receive an activation token."));
    console.log(chalk.red("=".repeat(85)));

    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const token = await new Promise((resolve) => {
        readline.question("\nEnter Activation Token: ", (answer) => {
            readline.close();
            resolve(answer.trim());
        });
    });

    if (token === generateToken(hwid)) {
        fs.writeFileSync(licensePath, JSON.stringify({ hwid, token }, null, 2));
        console.log(chalk.green("[SUCCESS] Magxxic Activated Successfully!"));
        return true;
    } else {
        console.log(chalk.red("[ERROR] Invalid Activation Token. Access Denied."));
        return false;
    }
}

module.exports = { checkLicense };
