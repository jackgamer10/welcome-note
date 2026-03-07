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
- **Easy Configuration**: Manage all settings via a JSON configuration file.

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
- **`templates/format/`**: Directory for HTML email templates used as the email body.
- **`templates/attachments/`**: Directory for HTML files that will be converted into PDF attachments.

### DKIM Setup

To use DKIM signing, you need to configure three main settings in `magxxic/config.json`:

1.  **`sender_domain`**: The domain you are sending from (e.g., `example.com`).
2.  **`dkim_selector`**: The selector used in your DKIM DNS record (default is `default`).
3.  **`dkim_private_key_path`**: The filename or full path to your RSA private key (default is `dkim_private.pem`).

Place your private key file in the `magxxic/` directory.

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
