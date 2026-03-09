const nodemailer = require('nodemailer');
const { SocksProxyAgent } = require('socks-proxy-agent');

async function sendDirectEmail(mxHost, senderEmail, recipientEmail, msgOptions, proxy = null, ehloHost = "example.com", debug = false, timeout = 15000, localAddress = null) {
    let agent = null;
    if (proxy) {
        let proxyUrl = proxy;
        if (!proxy.startsWith("socks5://")) {
            proxyUrl = `socks5://${proxy}`;
        }
        agent = new SocksProxyAgent(proxyUrl);
    }

    const transporter = nodemailer.createTransport({
        host: mxHost,
        port: 25,
        secure: false,
        name: ehloHost,
        debug: debug,
        logger: debug,
        connectionTimeout: timeout * 1000,
        greetingTimeout: timeout * 1000,
        socketTimeout: timeout * 1000,
        localAddress: localAddress,
        proxy: agent ? agent.proxy.href : undefined,
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        await transporter.sendMail({
            from: senderEmail,
            to: recipientEmail,
            ...msgOptions
        });
        return [true, "Delivered"];
    } catch (err) {
        return [false, err.message];
    }
}

module.exports = { sendDirectEmail };
