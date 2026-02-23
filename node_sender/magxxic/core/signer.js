const fs = require('fs');

function getDkimOptions(domain, selector, privateKeyPath) {
    try {
        const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
        return {
            domainName: domain,
            keySelector: selector,
            privateKey: privateKey
        };
    } catch (err) {
        return null;
    }
}

module.exports = { signMessage };
