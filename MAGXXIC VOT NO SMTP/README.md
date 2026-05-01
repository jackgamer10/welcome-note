# MAGXXIC VOT NO SMTP - Advanced Direct-to-MX Delivery System

## 🚀 Overview
MAGXXIC VOT NO SMTP is a high-performance, professional-grade email delivery system designed for maximum deliverability and stealth. It bypasses traditional SMTP relays by connecting directly to recipient MX servers through a secure proxy orchestration layer.

## 🛠️ Key Features
- **Direct-to-MX Delivery**: No SMTP relay required.
- **Inbox Mode**: Clean, standard Node.js patterns for maximum inboxing.
- **Military-Grade Stealth**:
  - Polymorphic HTML Engine
  - Bayesian Filter Poisoning
  - MIME Boundary Randomization
  - Timing Jitter Injection
  - Zero-font content injection
- **Advanced Attachment System**:
  - HTML-to-PDF Conversion
  - EML (Forwarded Message) generation
  - ICS (Calendar Invite) generation
  - RTF Document generation
  - Encrypted & Fingerprinted ZIP wrappers
- **Intelligent Orchestration**:
  - Domain Throttling (ISP-specific rates)
  - List Hygiene & Email Verification
  - Round-robin Proxy Rotation
  - Interactive Configuration Dashboard

## 📁 Project Structure
- `magxxic/`: Core application logic and configuration.
  - `core/`: Engine, signer, and delivery modules.
  - `config.json`: Master configuration.
  - `proxy.enc`: Encrypted proxy pool.
- `data/`: Dynamic campaign data.
  - `fromEmail.txt`: Sender rotation list with placeholder support.
  - `recipients.txt`: Target email list.
  - `subject.txt`: Subject rotation list.
  - `link.txt`: URL rotation list.
- `templates/`:
  - `format/`: HTML email body templates.
  - `attachments/`: HTML templates for PDF conversion.
- `magxxic_vot_attachment/`: Folder for direct file attachments.
- `imagecid/`: Folder for inline images (CID embedding).
- `placeholder/`: Reference guide for the tag system.

## 🏷️ Placeholder System
The system supports over 96 dynamic tags using the `[[TAG_NAME]]` syntax.
- **Recipient Tags**: `[[RECIPIENT_EMAIL]]`, `[[RECIPIENT_FIRST]]`, `[[RECIPIENT_DOMAIN]]`, etc.
- **Randomization**: `[[RANDOM_STR(8)]]`, `[[RANDOM_NUM(6)]]`, `[[RANDOM_UUID]]`, etc.
- **Faker Data**: `[[RANDOM_FULLNAME]]`, `[[RANDOM_COMPANY]]`, `[[RANDOM_CITY]]`, etc.
- **Temporal**: `[[CURRENT_DATE_LONG]]`, `[[TIMESTAMP]]`, `[[FUTURE_DATE(7)]]`, etc.
- **Formatting**: `[[UPPERCASE(text)]]`, `[[BASE64_ENCODE(text)]]`, etc.

*See `placeholder/placeholder.txt` for the full reference.*

## ⚙️ Installation
1. Ensure Node.js (v16+) is installed.
2. Navigate to the project directory:
   ```bash
   cd "MAGXXIC VOT NO SMTP"
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

## 🛡️ Activation
This system requires HWID activation.
1. Run `node magxxic_sender.js` for the first time.
2. Copy your unique **HWID** shown on the screen.
3. Contact the administrator to receive your **Activation Token**.
4. Enter the token to unlock the system. The license is stored securely and encrypted.

## 🚀 Usage
1. Configure your settings in `magxxic/config.json`.
2. Use the interactive menu to add your **DKIM Private Key**.
3. Populate the files in the `data/` folder.
4. Start the delivery engine:
   ```bash
   node magxxic_sender.js
   ```

## 🛡️ Security & Compliance
Ensure all campaigns comply with local laws (CAN-SPAM, GDPR). The tool includes built-in fields for physical address and unsubscribe headers to facilitate compliance.

---
**Created by MAGXXIC TEAM**
