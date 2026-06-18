# Environmental Features Used in Test

The MAGXXIC VOT NO SMTP project utilizes the following environmental and technical features to ensure high deliverability and anti-detection:

### 🛡️ Stealth & Anti-Detection
1. **HTML Polymorphism**: Automatically randomizes the HTML structure (CSS, class names, and layout) of every email while maintaining the same visual output. This prevents fingerprinting by spam filters.
2. **Bayesian Filter Poisoning**: Injects invisible, legitimate snippets of text from professional sources into the email body to confuse machine-learning based spam filters.
3. **MIME Boundary Randomization**: Generates unique, standard-compliant MIME boundaries for every message, breaking pattern detection in email headers.
4. **RFC-Compliant Message-ID**: Automatically generates unique, authenticated-style `Message-ID` headers to bypass strict Gmail and Outlook "RFC-Non-Compliant" filters.
5. **Zero-Font Injection**: Injects invisible, unique hexadecimal strings into paragraphs and divs at `0px` font size to differentiate email content hashes.
6. **Timing Jitter**: Implements a Gaussian-randomized delay (2s to 7s) between email attempts to simulate human sending patterns and avoid bulk-sending triggers.

### ⚙️ Delivery Orchestration
1. **Direct-to-MX Routing**: Bypasses traditional SMTP relays by resolving recipient MX records directly and establishing an SMTP session with the target server.
2. **Advanced DNS Resolver**: Includes multi-layer fallback (MX -> A -> AAAA) and domain existence validation to maximize connection success.
3. **ISP-Specific Throttling**: Limits the sending rate based on the recipient's domain (e.g., 100/hr for Gmail, 50/hr for others) to protect sender reputation.
4. **Round-Robin Proxy Rotation**: Distributes outbound traffic across a pool of 64 SOCKS5 proxies to obfuscate the sender's origin IP.
5. **Integrated List Hygiene**: Automatically filters malformed emails and definitive spam traps while allowing legitimate role accounts (admin, support).

### 📎 Attachment Technology
1. **Dynamic PDF Generation**: Converts HTML templates into sharp PDF documents on-the-fly.
2. **Encrypted & Fingerprinted ZIPs**: Wraps attachments in unique, password-protected ZIP files with randomized metadata and manifest files to ensure every recipient receives a unique file hash.
3. **Embedded Image CIDs**: Automatically processes and embeds inline images from the `imagecid/` folder, ensuring they display correctly in Outlook and Webmail.
