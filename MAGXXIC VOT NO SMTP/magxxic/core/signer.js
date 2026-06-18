const fs = require('fs');

function getDkimOptions(domain, selector, privateKeyPath) {
    if (!fs.existsSync(privateKeyPath)) return null;
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    return {
        domainName: domain,
        keySelector: selector,
        privateKey: privateKey
    };
}

module.exports = { getDkimOptions };
