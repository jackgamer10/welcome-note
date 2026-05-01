# Magxxic Direct-to-MX Email Sender

Magxxic is a high-performance, direct-to-MX email delivery tool designed for research and authorized security testing. It connects directly to the recipient's mail server via SOCKS5 proxies to explore direct delivery mechanics and deliverability.

## Features

- **Direct-to-MX Delivery**: Resolves MX records and connects directly to destination servers.
- **SOCKS5 Proxy Support**: Routes all traffic through a SOCKS5 chain using the `socks` library for full IP hiding.
- **Proxy Validation**: Automatically validates your SOCKS5 proxies at startup to ensure maximum delivery rates.
- **DKIM Signing**: Automatically signs outgoing messages for trust verification.
- **Multi-threaded Engine**: Fast concurrent delivery using a thread pool.
- **Rotation Logic**: Rotates subjects, HTML templates, and sender addresses for every recipient.
- **Delay & Pause**: Configurable random delay between emails and pause between batches to avoid rate limiting.
- **Dynamic Tags**: Support for dynamic placeholders like `[[TIME]]`, `[[DATE]]`, `[[DEVICE]]`, etc.
- **URL/Email Encryption**: Built-in support for obfuscating URLs and recipient emails (Base64/Hex) in templates.
- **Interactive Dashboard**: Configure and toggle all settings (DKIM, IP-Hiding, PDF, etc.) through an easy-to-use menu before starting.
- **Military Grade Headers**: Optional enhanced MIME headers for "High-Tech" delivery security.
- **Link Rotator**: Rotate through URLs from `links.txt` for unique links per recipient.
- **HTML to PDF Attachment**: Automatically convert separate HTML attachment templates into PDF attachments.
- **Licensing & Activation**: Secure HWID-based activation system for new users.
- **Easy Configuration**: Manage all settings via a JSON configuration file.

## Activation

Upon the first run, Magxxic will generate a unique **Hardware ID (HWID)** for your system. To activate the software, you must provide this HWID to an administrator to receive an **Activation Token**. Once activated, a `license.json` file will be created in the `magxxic/` directory to store your credentials locally.

## Prerequisites

- Python 3.6 or higher
- `pip` (Python package installer)

## Installation

1. Clone the repository or download the source code.
2. Install the required dependencies:

### Linux/macOS
```bash
pip install -r requirements.txt
```

### Windows
Double-click `setup.bat` or run:
```cmd
setup.bat
```

## Configuration

The tool's resources are located in the `magxxic/` directory:

- **`config.json`**: Main configuration for sender domain, DKIM selector, DKIM enable/disable, thread count, EHLO host, and flow control (delay/pause).
- **`subjects.txt`**: List of subject lines (one per line) to rotate.
- **`recipients.txt`**: List of recipient email addresses (one per line).
- **`proxies.txt`**: List of SOCKS5 proxies (e.g., `socks5://user:pass@host:port` or `host:port`).
- **`links.txt`**: List of URLs (one per line) for randomization.
- **`local_ips.txt`**: List of local source IP addresses to rotate (one per line).
- **`templates/format/`**: Directory for HTML email templates (`.html` files) used as the email body.
- **`templates/attachments/`**: Directory for HTML files that will be converted into PDF attachments.

### DKIM Setup

To use DKIM signing, you need to configure three main settings in `magxxic/config.json`:

1.  **`sender_domain`**: The domain you are sending from (e.g., `example.com`).
2.  **`dkim_selector`**: The selector used in your DKIM DNS record (default is `default`).
3.  **`dkim_private_key_path`**: The filename or full path to your RSA private key (default is `dkim_private.pem`).

Place your private key file in the `magxxic/` directory.

### Direct-to-MX Connectivity Setup

Direct-to-MX delivery requires a connection to the recipient's mail server on **Port 25**. Many ISPs and Cloud Providers (AWS, Azure, DigitalOcean, etc.) block outbound traffic on port 25 by default.

To successfully set up the MX connection:
1.  **Using SOCKS5 Proxies (Recommended)**:
    - **No Local Port 25 Required**: If you route through a SOCKS5 proxy, your local system (or RDP) does **NOT** need port 25 open. The connection to the recipient is handled by the proxy server.
    - **Proxy Port 25 Support Required**: **Crucially, your proxies must support outbound connections to any IP on port 25.** Standard "residential" or "web" SOCKS5 proxies often block port 25. You need specialized "SMTP-enabled" proxies.
2.  **Direct Connection (No Proxy)**:
    - **Local Port 25 MUST be open**: If you are not using a proxy (or if `hide_ip` is disabled), your local IP address (or RDP server IP) must have port 25 open for outbound traffic. Many VPS providers block this by default.
    - **Check Port 25**: You can test this by running `telnet smtp.google.com 25` from your system. If it times out, port 25 is blocked.
3.  **Enable Port 25 Test**: In `config.json`, set `"test_connection_before_send": true`. The tool will then verify if the proxy can actually reach the destination MX server before attempting to send the email.

**Generating a DKIM Key:**
If you have OpenSSL installed, you can generate a 1024-bit RSA private key with the following command:
```bash
openssl genrsa -out magxxic/dkim_private.pem 1024
```
Make sure the `sender_domain` and `dkim_selector` in `config.json` match the DKIM TXT record on your domain's DNS.

## Advanced Features

### Delay and Pause
In `config.json`, you can configure the following flow control settings:
- `test_connection_before_send`: If `true`, the tool will test connectivity to the recipient's MX server on port 25 (through the proxy if enabled) before attempting to send.
- `delay_min` and `delay_max`: Set a random delay (in seconds) between each email delivery.
- `hide_ip`: Boolean to ensure your real IP is hidden by requiring SOCKS5 proxy usage.
- `dkim_enabled`: Boolean to enable or disable DKIM signing.
- `dkim_sign_mime`: Boolean to enable/disable signing of MIME headers (`MIME-Version`, `Content-Type`).
- `batch_size`: Number of emails to send before a mandatory pause.
- `batch_pause_seconds`: Length of the pause (in seconds) after each batch.
- `attach_pdf`: Boolean to enable/disable HTML to PDF attachment conversion.
- `attachment_probability`: Percentage (0-100) of emails that will include an attachment when enabled.
- `pdf_filename_format`: Template for the attached PDF filename (supports tags).
- `special_email`: An email address to receive periodic copies of sent emails (e.g., for inbox monitoring).
- `special_email_interval`: The frequency (every X successful sends) to trigger the special email.
- `validate_proxies`: Boolean to enable/disable automated proxy validation at startup.
- `tracking_url`: URL of your tracking service.
- `x_mailer`: Custom `X-Mailer` header value.
- `custom_headers`: Dictionary of extra MIME headers to include.
- `rotate_local_ips`: If `true`, the tool will rotate through local source IP addresses from `magxxic/local_ips.txt` for outbound connections. Requires multiple network interfaces.
- `forge_relay_headers`: If `true`, the tool will prepend a forged `Received` header using a random proxy IP to hide your real local IP from the recipient's mail headers.
- `auto_ehlo`: If `true`, the tool will attempt to resolve the Reverse DNS (PTR) of the SOCKS5 proxy to use as the EHLO/HELO domain. Falls back to `ehlo_host` or `example.com`.
- `smtp_debug`: If `true`, the full SMTP transaction will be printed to the console, allowing verification of the HELO command.

### Proxy Validation
At startup, Magxxic can automatically test each SOCKS5 proxy in your `proxies.txt` to ensure it is functional and capable of reaching the internet. Functional proxies are kept in the pool, while broken ones are discarded for the current run. This ensures that your delivery campaign isn't stalled by dead proxies.

### HTML to PDF Conversion
This feature is **disabled by default**.

To enable it, set `"attach_pdf": true` in `magxxic/config.json` or use the `--attach` command-line argument.

When enabled, Magxxic picks a random HTML file from `magxxic/templates/attachments/`, processes all dynamic tags within it, converts it into a PDF file, and attaches it to the email. The original email body (from `templates/format/`) remains as HTML in the message.

#### Probability Setting
You can control what percentage of your emails include the attachment using the `attachment_probability` setting (0-100). For example, a setting of `50` means only half of the recipients (on average) will receive the PDF attachment.

### Special Email Notification
If `special_email` is configured with a valid address and `special_email_interval` is greater than 0, Magxxic will automatically send a copy of the outgoing email to the special address every time the specified number of successful deliveries is reached. This is useful for monitoring campaign progress and checking inbox placement in real-time.

### Link Tracking
If `tracking_url` is set, you can use the `[[TRACK:url]]` tag in your templates. Magxxic will replace it with:
`{tracking_url}?u={base64_url}&r={recipient_b64}`
This allows you to track clicks and link them back to specific recipients.

### Spam Filter Evasion
Magxxic includes several features to help bypass spam filters:
- **`[[NOISE]]`**: Inserts a random invisible HTML comment (e.g., `<!-- aB12x -->`) into the template to vary the content and confuse Bayesian filters.
- **Custom Headers**: Add headers like `List-Unsubscribe`, `X-Priority`, or custom headers in `config.json`.
- **Standard Headers**: Automatically generates `Message-ID` and `Date` headers that follow RFC standards.

### Dynamic Tags and Encryption
Magxxic supports various placeholders in your HTML templates, subjects, and PDF filenames that are automatically replaced for each recipient:

#### Dynamic Information
- `[[TIME]]`: Current time (HH:MM:S).
- `[[DATE]]`: Current date (YYYY-MM-DD).
- `[[DEVICE]]`: Randomly selected device name (e.g., iPhone, Windows PC).
- `[[OS]]`: Randomly selected operating system (e.g., iOS 16, Windows 11).
- `[[USER_NAME]]`: Local part of the recipient's email address.
- `[[USER_DOMAIN]]`: Domain part of the recipient's email address.
- `[[logo]]`: Automatically inserts an HTML `<img>` tag pointing to the recipient domain's logo.
- `[[RANDOM_LINK]]`: Selects a random URL from `links.txt`.
- `[[RAND_QUERY]]`: Generates a random query string (e.g., `?id=abc123`).
- `[[RANDOM_STR:length]]`: Generates a random alphanumeric string of the specified length (default is 8).

#### High-Tech Encryption and Obfuscation
- `[[EMAIL]]`: Recipient's email address.
- `[[EMAIL_BASE64]]`: Recipient's email address in Base64.
- `[[EMAIL_HEX]]`: Recipient's email address in Hex.
- `[[BASE64:your_text]]`: Encodes "your_text" into Base64.
- `[[HEX:your_text]]`: Encodes "your_text" into Hex.
- `[[ENCRYPT:your_text]]`: High-tech grade XOR encryption with a dynamic per-email key (output as hex).
- `[[B64_ENCRYPT:your_text]]`: High-tech grade XOR encryption with a dynamic key (output as Base64).

Example use in a template:
`<a href="http://example.com/login?u=[[EMAIL_BASE64]]">Click here</a>`

## Usage

To start a delivery campaign, run the main script:

### Linux/macOS
```bash
python3 magxxic_sender.py
```

#### Command-line Options
You can override configuration settings directly from the command line:
- `-a`, `--attach`: Force enable PDF attachments for this run.
- `-n`, `--no-attach`: Force disable PDF attachments for this run.
- `-p PROB`, `--prob PROB`: Set the attachment probability (0-100).
- `--dkim`: Force enable DKIM signing.
- `--no-dkim`: Force disable DKIM signing.
- `--dkim-key PATH`: Specify a custom path to your DKIM private key file.
- `--hide-ip`: Force enable IP hiding (requires at least one proxy in `proxies.txt`).
- `--show-ip`: Force disable IP hiding (allows direct connection from your IP if no proxy is available).
- `--dkim-mime`: Force enable signing of MIME headers.
- `--no-dkim-mime`: Force disable signing of MIME headers.

Example:
```bash
python3 magxxic_sender.py --attach --prob 25
```

### Windows
Double-click `start_sending.bat` or run:
```cmd
start_sending.bat
```

The tool will display a progress log in the terminal, showing the status of each delivery along with the selected subject and template.

> **Note for Windows/RDP Users:** If colors are not displaying correctly, ensure you are using the provided `start_sending.bat` script, which enables ANSI color support.

## Statistics

Upon completion, Magxxic provides a summary of:
- Delivered emails
- Failed deliveries
- Total recipients processed
- Overall success rate

## Legal Disclaimer

**IMPORTANT: READ CAREFULLY**

This software is strictly for **educational purposes and authorized security research only**.

Using this tool to send unsolicited emails (spam), phish for credentials, or engage in any form of unauthorized communication is a violation of international laws (such as the CAN-SPAM Act, GDPR, etc.) and is strictly prohibited.

The authors and contributors of this project:
1. Do not condone or support any illegal use of this software.
2. Are not responsible for any misuse, damage, or legal consequences arising from the use of this tool.
3. Provide this "as-is" without any warranties.

By using this software, you agree to comply with all applicable local and international laws and regulations.

## Stealth Local Mode

If you prefer to send from your local IP (or RDP) while still hiding your identity from the recipient:
1.  **Rotate Local IPs**: In `config.json`, set `"rotate_local_ips": true` and add your available local IPs to `magxxic/local_ips.txt`. The tool will bind each connection to a different local interface.
2.  **Forge Relay Headers**: Set `"forge_relay_headers": true`. Magxxic will add fake `Received` headers to your emails that point to random proxies, making it appear to the recipient (and some filters) as if the email was relayed through those proxies.
3.  **Dynamic EHLO**: Enable `"auto_ehlo": true`. When sending locally, the tool will pick a random proxy from your list and use its identity for the `EHLO` command, ensuring consistency between the connection handshake and the forged headers.

### Stealth RDP Configuration

If you are using an RDP server with **Port 25 open**, you can achieve maximum performance while staying hidden:
-   **Step 1**: Load your proxy list into `magxxic/proxies.txt`. These don't need port 25 open, as they are only used for their **identity**.
-   **Step 2**: Toggle **Stealth Local Mode** to **[ON]** in the dashboard.
-   **Step 3**: Magxxic will now use your fast RDP connection to send mail directly, but it will use your proxy IPs for the `EHLO` hostname and the `Received` headers. The recipient's mail server will see a connection from your RDP IP, but the *email metadata* will point to the proxy, providing a layer of obfuscation.

## Verification & Troubleshooting

### Verifying HELO/EHLO
To ensure the HELO command is being sent correctly:
1.  **Enable SMTP Debugging**: In the configuration dashboard, toggle `SMTP Debug Logs` to **[ON]**.
2.  **Monitor Traffic**: Use a packet sniffer like **Wireshark**. Filter for `tcp.port == 25` to see the plaintext SMTP handshake and verify the domain sent after the `EHLO` command.

### Troubleshooting MX Connections
If you see "Connection Timed Out" or "Access Denied" errors:
- **Provider Blocks**: Check if your VPS provider blocks port 25.
- **Proxy Issues**: Ensure your SOCKS5 proxy is functional and supports outbound port 25.
- **PTR Failure**: If `auto_ehlo` is enabled but the lookup fails, the tool will gracefully fall back to `example.com` to ensure delivery continues.
