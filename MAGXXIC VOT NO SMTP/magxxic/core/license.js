const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');

const SECRET = 'MAGXXIC-VOT-AUTH-2024';

function getHWID() {
    const data = [
        os.hostname(),
        os.arch(),
        os.platform(),
        os.cpus().length,
        os.totalmem()
    ].join('|');
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16).toUpperCase();
}

function generateToken(hwid) {
    return crypto.createHash('sha256').update(hwid + SECRET).digest('hex').slice(0, 16).toUpperCase();
}

function verifyToken(hwid, token) {
    return generateToken(hwid) === token;
}

function encrypt(text) {
    const cipher = crypto.createCipheriv('aes-256-cbc', crypto.createHash('sha256').update(SECRET).digest(), Buffer.alloc(16, 0));
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decrypt(text) {
    try {
        const decipher = crypto.createDecipheriv('aes-256-cbc', crypto.createHash('sha256').update(SECRET).digest(), Buffer.alloc(16, 0));
        let decrypted = decipher.update(text, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        return null;
    }
}

function checkActivation() {
    const licensePath = path.join(__dirname, '../.magxxic_license.enc');
    if (!fs.existsSync(licensePath)) return false;
    try {
        const encryptedData = fs.readFileSync(licensePath, 'utf8');
        const decryptedData = decrypt(encryptedData);
        if (!decryptedData) return false;
        const { hwid, token } = JSON.parse(decryptedData);
        return hwid === getHWID() && verifyToken(hwid, token);
    } catch (e) {
        return false;
    }
}

function saveActivation(hwid, token) {
    const licensePath = path.join(__dirname, '../.magxxic_license.enc');
    const data = JSON.stringify({ hwid, token, date: new Date().toISOString() });
    fs.writeFileSync(licensePath, encrypt(data));
}

module.exports = { getHWID, generateToken, verifyToken, checkActivation, saveActivation };
