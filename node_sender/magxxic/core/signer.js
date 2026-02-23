const fs = require('fs');

function signMessage(message, domain, selector, privateKeyPath, signMime = true) {
    try {
        const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
        return message;
    } catch (err) {
        return message;
    }
}

module.exports = { signMessage };
