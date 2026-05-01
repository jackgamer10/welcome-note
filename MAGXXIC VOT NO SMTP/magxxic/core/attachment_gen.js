const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const crypto = require('crypto');

// Register encryption format for archiver
try {
    archiver.registerFormat('zip-encrypted', require('archiver-zip-encrypted'));
} catch (e) {
    // Already registered or error
}

async function generatePdf(htmlContent) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            resolve(Buffer.concat(buffers));
        });
        const text = htmlContent.replace(/<[^>]*>?/gm, '');
        doc.text(text);
        doc.end();
    });
}

function generateIcs(icsConfig) {
    const { summary, description, location, duration_hours } = icsConfig;
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const end = new Date(Date.now() + (duration_hours || 1) * 3600000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MAGXXIC//VOT//EN
BEGIN:VEVENT
UID:${crypto.randomBytes(16).toString('hex')}
DTSTAMP:${now}
DTSTART:${now}
DTEND:${end}
SUMMARY:${summary}
DESCRIPTION:${description}
LOCATION:${location}
END:VEVENT
END:VCALENDAR`;
}

function generateRtf(content) {
    const text = content.replace(/<[^>]*>?/gm, '');
    return `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Arial;}} \\f0\\fs24 ${text}}`;
}

function generateEml(from, to, subject, body) {
    return `From: ${from}
To: ${to}
Subject: ${subject}
MIME-Version: 1.0
Content-Type: text/html; charset=utf-8

${body}`;
}

async function createZip(files, options = {}) {
    return new Promise((resolve, reject) => {
        const buffers = [];
        const archive = archiver.create('zip-encrypted', {
            zlib: { level: 8 },
            encryptionMethod: options.password ? (options.encryptionMethod || 'aes256') : undefined,
            password: options.password
        });

        archive.on('data', data => buffers.push(data));
        archive.on('end', () => resolve(Buffer.concat(buffers)));
        archive.on('error', err => reject(err));

        if (options.fingerprint) {
            archive.setComment(`MAGXXIC-VOT-FINGERPRINT-${crypto.randomBytes(8).toString('hex')}-${Date.now()}`);
            archive.append(crypto.randomBytes(32), { name: `.metadata_${crypto.randomBytes(4).toString('hex')}` });
        }

        files.forEach(file => {
            archive.append(file.content, {
                name: file.name,
                date: options.fingerprint ? new Date(Date.now() - Math.random() * 10000000) : undefined
            });
        });

        archive.finalize();
    });
}

module.exports = { generatePdf, generateIcs, generateRtf, generateEml, createZip };
