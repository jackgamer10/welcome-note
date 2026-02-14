# Magxxic Direct-to-MX Email Sender

Magxxic is a high-performance, direct-to-MX email delivery tool designed for anonymity and reliability. It bypasses traditional SMTP relays by connecting directly to the recipient's mail server via SOCKS5 proxies.

## Features

- **Direct-to-MX Delivery**: Resolves MX records and connects directly to destination servers.
- **SOCKS5 Proxy Support**: Routes all traffic through a SOCKS5 chain to hide the sender's IP.
- **DKIM Signing**: Automatically signs outgoing messages to improve deliverability and trust.
- **Multi-threaded Engine**: Fast concurrent delivery using a thread pool.
- **Rotation Logic**: Rotates subjects, HTML templates, and sender addresses for every recipient.
- **Easy Configuration**: Manage all settings via a simple JSON configuration file.

## Prerequisites

- Python 3.6 or higher
- `pip` (Python package installer)

## Installation

1. Clone the repository or download the source code.
2. Install the required dependencies:

```bash
pip install -r requirements.txt
```

## Configuration

The tool's resources are located in the `magxxic/` directory:

- **`config.json`**: Main configuration for sender domain, DKIM selector, thread count, and EHLO host.
- **`subjects.txt`**: List of subject lines (one per line) to rotate.
- **`recipients.txt`**: List of recipient email addresses (one per line).
- **`proxies.txt`**: List of SOCKS5 proxies (e.g., `socks5://user:pass@host:port` or `host:port`).
- **`templates/format/`**: Directory for HTML email templates (`.html` files).

### DKIM Setup

To use DKIM signing, place your RSA private key in `magxxic/dkim_private.pem`. Ensure the `sender_domain` and `dkim_selector` in `config.json` match your DNS records.

Example to generate a key:
```bash
openssl genrsa -out magxxic/dkim_private.pem 1024
```

## Usage

To start a delivery campaign, run the main script:

```bash
python3 magxxic_sender.py
```

The tool will display a progress log in the terminal, showing the status of each delivery along with the selected subject and template.

## Statistics

Upon completion, Magxxic provides a summary of:
- Delivered emails
- Failed deliveries
- Total recipients processed
- Overall success rate

## Disclaimer

This software is for educational and authorized testing purposes only. The authors are not responsible for any misuse or damage caused by this tool. Ensure you have permission to send emails to your recipients and comply with all applicable anti-spam laws.
