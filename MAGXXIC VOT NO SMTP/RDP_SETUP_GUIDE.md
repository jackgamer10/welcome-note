# RDP Setup Guide for MAGXXIC VOT NO SMTP

To ensure "Perfect Operation" when setting up the project on a Remote Desktop (RDP) environment, follow these steps:

### 1. Prerequisites
- **Node.js**: Install Node.js v16.0.0 or higher.
- **Proxies**: Ensure you have a valid pool of SOCKS5 proxies that allow outbound traffic on **Port 25**.
- **Admin Access**: Ensure you have permissions to run `.bat` files.

### 2. Initial Setup
1. Copy the `MAGXXIC VOT NO SMTP` folder to your RDP desktop.
2. Open the folder and double-click `setup.bat`. This will:
   - Verify your Node.js installation.
   - Install all required dependencies (nodemailer, pdfkit, socks-proxy-agent, etc.).
   - Verify the data folder structure.

### 3. Configuration
1. Open `magxxic/config.json`:
   - Set `max_threads` based on your RDP's CPU (recommended: 10-15).
   - Ensure `inbox_mode` is set to `true` if targeting Outlook/Hotmail.
   - Configure your compliance fields (physical address, support email).
2. Populate your campaign data:
   - `data/recipients.txt`: Your target list.
   - `data/fromEmail.txt`: Your sender email pool.
   - `data/subject.txt`: Your subjects.
   - `data/link.txt`: Your URLs.

### 4. Activation
1. Run `start.bat`.
2. On first run, the tool will display your **Hardware ID (HWID)**.
3. Provide this HWID to the MAGXXIC administrator to receive your **Activation Token**.
4. Paste the token into the terminal to unlock the system. The license is stored in an encrypted file and will persist.

### 5. DKIM Setup (Critical for Inboxing)
1. In the main menu, select **Option 2: UPDATE DKIM PRIVATE KEY**.
2. Paste your private RSA key (in PEM format).
3. The tool will save it securely to `magxxic/dkim/dkim_private.pem`.
4. Ensure your `dkim_selector` in `config.json` matches your DNS record.

### 6. Verification & Launch
1. Ensure your proxies are loaded in `magxxic/proxy.enc` or listed in `data/proxies.txt`.
2. Select **Option 1: START CAMPAIGN**.
3. Monitor the dashboard for the `[DELIVERED]` status.

### 💡 Troubleshooting RDP Port 25
- **Symptoms**: `Error: DNS Error: No MX/A records` or `Connection Timeout`.
- **Cause**: Many RDP/Cloud providers (Azure, AWS, GCP) block outbound Port 25 by default.
- **Fix**: Use the SOCKS5 proxy feature in `config.json`. When using proxies, the RDP itself does not need Port 25 open, as the connection is handled by the proxy server.
