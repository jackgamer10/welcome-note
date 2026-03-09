# Magxxic Direct-to-MX Email Sender (Node.js)

Magxxic is a high-performance, direct-to-MX email delivery tool designed for research and authorized security testing. It connects directly to the recipient's mail server via SOCKS5 proxies to explore direct delivery mechanics and deliverability.

## Features

- **Direct-to-MX Delivery**: Resolves MX records and connects directly to destination servers.
- **SOCKS5 Proxy Support**: Routes all traffic through a SOCKS5 chain using the `socks` library for full IP hiding.
- **Proxy Validation**: Automatically validates your SOCKS5 proxies at startup to ensure maximum delivery rates.
- **DKIM Signing**: Automatically signs outgoing messages for trust verification.
- **Multi-threaded Engine**: Fast concurrent delivery using a chunked promise pool.
- **Rotation Logic**: Rotates subjects, HTML templates, and sender addresses for every recipient.
- **Delay & Pause**: Configurable random delay between emails and pause between batches to avoid rate limiting.
- **Dynamic Tags**: Support for dynamic placeholders like `[[TIME]]`, `[[DATE]]`, `[[DEVICE]]`, etc.
- **URL/Email Encryption**: Built-in support for obfuscating URLs and recipient emails (Base64/Hex/XOR) in templates.
- **Interactive Dashboard**: Toggle settings (DKIM, PDF, IP-Hiding) through an interactive CLI menu.
- **Military Grade Headers**: Use advanced, tech-styled MIME headers for emails.
- **Link Rotator**: Rotate links from `links.txt` for maximum variety.
- **HTML to PDF Attachment**: Automatically convert separate HTML attachment templates into PDF attachments.
- **Licensing & Activation**: Secure HWID-based activation system for new users.
- **Easy Configuration**: Manage all settings via a JSON configuration file.

## Activation

Upon the first run, Magxxic will generate a unique **Hardware ID (HWID)** for your system. To activate the software, you must provide this HWID to an administrator to receive an **Activation Token**. Once activated, a `license.json` file will be created in the `magxxic/` directory to store your credentials locally.

## Prerequisites

- Node.js 14 or higher
- `npm` (Node package manager)

## Installation

1. Clone the repository or download the source code.
2. Install the required dependencies:

```bash
npm install
```

## Configuration

The tool's resources are located in the `magxxic/` directory:

- **`config.json`**: Main configuration for sender domain, DKIM settings, thread count, EHLO host, and flow control.
- **`subjects.txt`**: List of subject lines (one per line) to rotate.
- **`recipients.txt`**: List of recipient email addresses (one per line).
- **`proxies.txt`**: List of SOCKS5 proxies (e.g., `socks5://user:pass@host:port`).
- **`links.txt`**: List of URLs (one per line) for randomization.
- **`local_ips.txt`**: List of local source IP addresses to rotate (one per line).
- **`templates/format/`**: Directory for HTML email templates used as the email body.
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
- `special_email`: An email address to receive periodic copies of sent emails.
- `special_email_interval`: The frequency (every X successful sends) to trigger the special email.
- `validate_proxies`: Boolean to enable/disable automated proxy validation at startup.
- `tracking_url`: URL of your tracking service.
- `x_mailer`: Custom `X-Mailer` header value.
- `custom_headers`: Dictionary of extra MIME headers to include (supports tags).
- `rotate_local_ips`: If `true`, the tool will rotate through local source IP addresses from `magxxic/local_ips.txt` for outbound connections.
- `forge_relay_headers`: If `true`, the tool will prepend a forged `Received` header using a random proxy IP to hide your real local IP from the recipient's mail headers.
- `auto_ehlo`: If `true`, the tool will attempt to resolve the Reverse DNS (PTR) of the SOCKS5 proxy to use as the EHLO/HELO domain. Falls back to `ehlo_host` or `example.com`.
- `smtp_debug`: If `true`, the full SMTP transaction will be printed to the console, allowing verification of the HELO command.

### Proxy Validation
At startup, Magxxic can automatically test each SOCKS5 proxy in your `proxies.txt` to ensure it is functional.

### HTML to PDF Conversion
When enabled, Magxxic picks a random HTML file from `magxxic/templates/attachments/`, converts it into a PDF, and attaches it.

### Link Tracking
If `tracking_url` is set, you can use the `[[TRACK:url]]` tag in your templates.

### Spam Filter Evasion
Magxxic includes features to help bypass spam filters:
- **`[[NOISE]]`**: Inserts random invisible HTML comments.
- **Custom Headers**: Add professional headers in `config.json`.
- **Standard Headers**: Automatically generates standard headers.

### Dynamic Tags and Encryption
Magxxic supports various placeholders:

#### Dynamic Information
- `[[TIME]]`, `[[DATE]]`, `[[DEVICE]]`, `[[OS]]`, `[[USER_NAME]]`, `[[USER_DOMAIN]]`, `[[logo]]`, `[[RANDOM_LINK]]`, `[[RAND_QUERY]]`, `[[RANDOM_STR:length]]`.

#### High-Tech Encryption and Obfuscation
- `[[EMAIL]]`, `[[EMAIL_BASE64]]`, `[[EMAIL_HEX]]`, `[[BASE64:text]]`, `[[HEX:text]]`.
- `[[ENCRYPT:text]]`: XOR encryption with dynamic key (hex).
- `[[B64_ENCRYPT:text]]`: XOR encryption with dynamic key (Base64).

## Usage

```bash
node magxxic_sender.js
```

### Windows Users
On Windows, use the provided batch files for best results:
- Double-click `setup.bat` to install dependencies.
- Double-click `start_sending.bat` to run the tool with full color support.

## Statistics

Upon completion, Magxxic provides a visual dashboard with:
- Delivery Statistics
- Performance Metrics (Duration, Throughput)
- Bounce Analysis
- Domain Engagement Report with progress bars

## Legal Disclaimer

Strictly for **educational purposes and authorized security research only**.

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
