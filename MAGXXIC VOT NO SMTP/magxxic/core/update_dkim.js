const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');

async function updateDkimKey() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log(chalk.cyan("\n--- DKIM PRIVATE KEY UPDATE ---"));
    console.log(chalk.yellow("Paste your DKIM private key below."));
    console.log(chalk.yellow("When finished, press Enter and then Ctrl+D (Unix) or Ctrl+Z (Windows) to save.\n"));

    const lines = [];
    rl.on('line', (line) => {
        lines.push(line);
    });

    return new Promise((resolve) => {
        rl.on('close', () => {
            const content = lines.join('\n').trim();
            if (content.length > 0) {
                const dkimPath = path.join(__dirname, '../dkim/dkim_private.pem');
                fs.writeFileSync(dkimPath, content);
                console.log(chalk.green(`\n[SUCCESS] DKIM key updated successfully at ${dkimPath}`));
            } else {
                console.log(chalk.red("\n[ABORTED] No content provided. DKIM key not updated."));
            }
            resolve();
        });
    });
}

module.exports = { updateDkimKey };
