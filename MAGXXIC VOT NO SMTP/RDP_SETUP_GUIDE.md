# RDP Compatibility & Setup Guide

To ensure "Perfect Operation" of **MAGXXIC VOT NO SMTP**, you must select the right RDP environment and configure it correctly.

---

### 🖥️ Recommended RDP Providers
The project is compatible with almost any Windows-based RDP, but your choice depends on whether you want to use **Proxies** or **Direct Sending**.

#### 1. Offshore / "Bulletproof" RDPs (BEST for Direct Sending)
- **Examples**: AlexHost, PQ.Hosting, VSYS, or providers in NL, MD, RO, UA.
- **Why**: They usually leave **Port 25 OPEN** by default or will open it upon request.
- **Result**: You can send emails directly without needing a proxy pool, which is faster.

#### 2. Mainstream Cloud RDPs (Requires PROXIES)
- **Examples**: AWS, Azure, Google Cloud (GCP), DigitalOcean, Linode.
- **Why**: These providers **STRICTLY BLOCK Port 25**. You will never be able to send emails directly from these servers.
- **Requirement**: You **MUST** use SOCKS5 proxies. The tool will route traffic through the proxy to bypass the RDP's block.
- **Result**: High deliverability, but depends on the quality of your proxies.

#### 3. Residential RDPs / RDP Shops
- **Examples**: Standard Windows 10/11 RDPs from private sellers.
- **Why**: These behave like a home PC. Port 25 may be open or blocked by the ISP.
- **Requirement**: Always check Port 25 status before starting.

---

### 🛠️ OS & Hardware Requirements
- **Operating System**: Windows Server 2016, 2019, or 2022 (Recommended). Also works on Windows 10/11.
- **RAM**: Minimum 2GB (4GB+ recommended for high-thread campaigns).
- **CPU**: 1 Core is enough, but 2-4 Cores allow for `max_threads: 20+` for ultra-fast sending.
- **Network**: Outbound Port 53 (DNS) and Port 443 (HTTPS for dependencies) must be open.

---

### ❌ Troubleshooting Common RDP Errors

#### Error: "Verification Failed: Domain has no valid MX/A records"
- **Cause**: RDP DNS is restricted or blocking resolution.
- **Solution**:
  1. We have integrated **Brute-Force DNS Fallback** (8.8.8.8, 1.1.1.1) and "Last Resort" logic into the engine.
  2. **Disable Verification** in `magxxic/config.json`: Set both `email_verification` and `email_verification_settings` to `false`.
  3. This ensures the engine skips the check and proceeds to attempt delivery.

#### Error: "Connection Timeout" or "Port 25 Blocked"
- **Solution**: This is environmental. Switch to using SOCKS5 proxies in `data/proxies.txt` and set `hide_ip: true` in config.

#### Error: "N/A | Direct" in Logs
- **Solution**: Populate `data/proxies.txt` with valid SOCKS5 proxies to avoid sending from the RDP's local IP.

---

### 🚀 Setup Checklist:
1. **Node.js**: Install v16+ and add to PATH.
2. **Setup**: Run `setup.bat` as Administrator.
3. **Proxies**: Load 20+ SOCKS5 proxies if using a Mainstream Cloud RDP.
4. **DKIM**: Add your private key via Option 2 in the menu.
5. **Launch**: Run `start.bat`.
