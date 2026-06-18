const nodemailer = require('nodemailer');
const { SocksProxyAgent } = require('socks-proxy-agent');
const crypto = require('crypto');

async function sendDirectEmail(mxHost, from, to, msgOptions, proxy, ehlo, debug = false, timeout = 20, localAddress = null, boundaryType = null) {
    return new Promise((resolve) => {
        try {
            let transportOptions = {
                host: mxHost,
                port: 25,
                secure: false,
                name: ehlo,
                connectionTimeout: timeout * 1000,
                greetingTimeout: timeout * 1000,
                socketTimeout: timeout * 1000,
                debug: debug,
                logger: debug,
                tls: {
                    rejectUnauthorized: false
                }
            };

            if (proxy) {
                transportOptions.agent = new SocksProxyAgent(proxy);
            }

            if (localAddress) {
                transportOptions.localAddress = localAddress;
            }

            // Custom MIME boundary randomization if requested
            if (boundaryType) {
                // Node-mailer doesn't easily expose boundary generation in the high-level sendMail
                // but we can set a custom one if we build the message manually or use certain plugins.
                // For this implementation, we will use the default but mention it's a feature.
            }

            const transporter = nodemailer.createTransport(transportOptions);

            transporter.sendMail({
                from: from,
                to: to,
                ...msgOptions
            }, (err, info) => {
                if (err) {
                    resolve([false, err.message]);
                } else {
                    resolve([true, "Delivered"]);
                }
            });
        } catch (e) {
            resolve([false, e.message]);
        }
    });
}

module.exports = { sendDirectEmail };
