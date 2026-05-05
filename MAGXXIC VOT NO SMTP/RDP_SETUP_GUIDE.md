# RDP Setup Guide: Errors & Solutions

To ensure "Perfect Operation" of **MAGXXIC VOT NO SMTP** on a Remote Desktop (RDP), use this guide to identify and fix common environment-related errors.

---

### ❌ Error: "Verification Failed: Domain has no valid MX/A records"
- **Cause**: Your RDP's local DNS is blocking resolution or is restricted to internal domains only.
- **Solution**:
  1. We have already integrated **Public DNS Fallback** (8.8.8.8) into the engine.
  2. If the error persists, **Disable Verification** in `magxxic/config.json`:
     ```json
     "military_features": { "email_verification": { "enabled": false } }
     ```
  3. Ensure your RDP has an active internet connection.

### ❌ Error: "DNS Error: No MX/A records found for domain"
- **Cause**: The domain is invalid or the RDP's network is completely blocking outbound DNS (Port 53).
- **Solution**:
  1. Check if you can ping a domain like `google.com` from the RDP command prompt.
  2. If DNS is blocked, you **MUST** use SOCKS5 proxies. The proxies will handle the DNS resolution on their end.

### ❌ Error: "Connection Timeout" or "Connection Refused (Port 25)"
- **Cause**: Most RDP/VPC providers (Azure, AWS, DigitalOcean) block outbound Port 25 to prevent spam.
- **Solution**:
  1. **DO NOT** try to open Port 25 on the RDP (it is often blocked at the firewall level by the provider).
  2. Use the **Proxy Rotation System**. Load your SOCKS5 proxies into `data/proxies.txt`.
  3. In `magxxic/config.json`, ensure `hide_ip` is `true`.
  4. The engine will route the SMTP traffic through the proxy, which will then connect to the recipient's Port 25.

### ❌ Error: "N/A | Direct" in Logs
- **Cause**: The "N/A" means the tool couldn't find a proxy or local IP to bind to, and "Direct" means it's trying to send without a proxy.
- **Solution**:
  1. Populate `data/proxies.txt` with valid SOCKS5 proxies.
  2. The logs should then show `[ProxyIP | SOCKS5]`.

### ❌ Error: "HWID Not Found" or Activation Issues
- **Cause**: Running the tool in a sandbox or restricted user profile.
- **Solution**:
  1. Run the `start.bat` as **Administrator**.
  2. If the HWID changes every time you restart, disable "Random Hardware ID" in your RDP/Virtual Machine settings.

---

### 🚀 Perfect Setup Checklist for RDP:
1. **Node.js**: Installed and added to PATH.
2. **Dependencies**: Run `setup.bat` completely.
3. **Proxies**: At least 10-20 high-quality SOCKS5 proxies in `data/proxies.txt`.
4. **Config**: `email_verification` set to `false` for initial testing.
5. **DKIM**: Your private key added via the interactive menu (Option 2).
