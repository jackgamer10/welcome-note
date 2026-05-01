const { generateToken } = require('./magxxic/core/license');
const readline = require('readline');
const chalk = require('chalk');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log(chalk.bold.yellow('\n--- MAGXXIC VOT ADMIN TOKEN GENERATOR ---'));

rl.question(chalk.cyan('Enter User HWID: '), (hwid) => {
    if (!hwid || hwid.length !== 16) {
        console.log(chalk.red('Invalid HWID format. Must be 16 characters.'));
        process.exit(1);
    }
    const token = generateToken(hwid);
    console.log(chalk.green('\nActivation Token: ') + chalk.bold.white(token));
    console.log(chalk.gray('\nProvide this token to the user to activate their license.'));
    rl.close();
});
