import random
import threading
import logging
import os
import time
import base64
import binascii
import re
import string
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from fpdf import FPDF
from magxxic.core.resolver import get_mx_records
from magxxic.core.smtp_client import send_direct_email
from magxxic.core.signer import sign_message

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class CampaignEngine:
    def __init__(self, config):
        self.subjects = config.get('subjects', [])
        self.templates = config.get('templates', [])
        self.attachment_templates = config.get('attachment_templates', [])
        self.recipients = config.get('recipients', [])
        self.proxies = config.get('proxies', [])
        self.links = config.get('links', [])
        self.senders = config.get('senders', ["info@example.com"])
        self.dkim_config = config.get('dkim', {})

        self.max_workers = config.get('threads', 10)
        self.ehlo_host = config.get('ehlo_host', 'example.com')

        # flow control settings
        self.delay_min = config.get('delay_min', 0)
        self.delay_max = config.get('delay_max', 0)
        self.batch_size = config.get('batch_size', 10)
        self.batch_pause_seconds = config.get('batch_pause_seconds', 0)

        # PDF settings
        self.attach_pdf = config.get('attach_pdf', False)
        self.attachment_probability = config.get('attachment_probability', 100)
        self.pdf_filename_format = config.get('pdf_filename_format', 'Document.pdf')

        # Special Email settings
        self.special_email = config.get('special_email', "")
        self.special_email_interval = config.get('special_email_interval', 0)

        self.stats = {
            'delivered': 0,
            'failed': 0,
            'total': len(self.recipients)
        }
        self.sent_total_counter = 0
        self.lock = threading.Lock()

    def _process_placeholders(self, content, recipient):
        """
        Replace placeholders with dynamic content and obfuscated/encrypted content.
        """
        # --- Dynamic Tags ---
        now = datetime.now()
        content = content.replace("[[TIME]]", now.strftime("%H:%M:%S"))
        content = content.replace("[[DATE]]", now.strftime("%Y-%m-%d"))

        try:
            user_parts = recipient.split('@')
            if len(user_parts) == 2:
                user_name, user_domain = user_parts
                content = content.replace("[[USER_NAME]]", user_name)
                content = content.replace("[[USER_DOMAIN]]", user_domain)

                # Auto Logo Grab
                logo_url = f"https://logo.clearbit.com/{user_domain}"
                logo_tag = f'<img src="{logo_url}" alt="{user_domain} logo" style="max-height: 100px;">'
                content = content.replace("[[logo]]", logo_tag)
        except Exception:
            pass

        devices = ["iPhone", "Android Phone", "Windows PC", "MacBook", "iPad", "Linux Desktop"]
        content = content.replace("[[DEVICE]]", random.choice(devices))

        oss = ["iOS 16", "Android 13", "Windows 11", "macOS Ventura", "Ubuntu 22.04"]
        content = content.replace("[[OS]]", random.choice(oss))

        # Random string: [[RANDOM_STR:12]]
        def rand_str_repl(match):
            length_str = match.group(1)
            length = int(length_str) if length_str else 8
            return ''.join(random.choices(string.ascii_letters + string.digits, k=length))
        content = re.sub(r"\[\[RANDOM_STR:?(\d*)\]\]", rand_str_repl, content)

        # Random Link: [[RANDOM_LINK]]
        if "[[RANDOM_LINK]]" in content:
            link = random.choice(self.links) if self.links else "http://example.com"
            content = content.replace("[[RANDOM_LINK]]", link)

        # Random Query: [[RAND_QUERY]] -> ?id=abc123
        def rand_query_repl(match):
            param = ''.join(random.choices(string.ascii_lowercase, k=2))
            val = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
            return f"?{param}={val}"
        content = re.sub(r"\[\[RAND_QUERY\]\]", rand_query_repl, content)

        # --- Obfuscation/Encryption ---
        content = content.replace("[[EMAIL]]", recipient)

        email_b64 = base64.b64encode(recipient.encode()).decode()
        content = content.replace("[[EMAIL_BASE64]]", email_b64)

        email_hex = binascii.hexlify(recipient.encode()).decode()
        content = content.replace("[[EMAIL_HEX]]", email_hex)

        # Dynamic obfuscation placeholders
        def b64_repl(match):
            return base64.b64encode(match.group(1).encode()).decode()
        content = re.sub(r"\[\[BASE64:(.*?)\]\]", b64_repl, content)

        def hex_repl(match):
            return binascii.hexlify(match.group(1).encode()).decode()
        content = re.sub(r"\[\[HEX:(.*?)\]\]", hex_repl, content)

        return content

    def _html_to_pdf(self, html_content):
        """
        Convert HTML content to PDF bytes using fpdf2.
        Note: fpdf2's write_html is basic.
        """
        try:
            pdf = FPDF()
            pdf.add_page()
            # Basic HTML support in fpdf2
            pdf.write_html(html_content)
            return pdf.output()
        except Exception as e:
            logging.error(f"PDF conversion error: {e}")
            return None

    def _prepare_message(self, recipient, subject, template_content, attachment_template_content=None):
        # Apply placeholders to subject and template
        final_subject = self._process_placeholders(subject, recipient)
        final_template = self._process_placeholders(template_content, recipient)

        msg = MIMEMultipart()
        msg['Subject'] = final_subject
        msg['From'] = random.choice(self.senders)
        msg['To'] = recipient

        # Attach HTML body
        part_html = MIMEText(final_template, 'html')
        msg.attach(part_html)

        # Optionally attach PDF (from a separate attachment template)
        if self.attach_pdf and attachment_template_content:
            # Check probability for optional attachment
            if random.random() * 100 <= self.attachment_probability:
                final_attachment_html = self._process_placeholders(attachment_template_content, recipient)
                pdf_bytes = self._html_to_pdf(final_attachment_html)
                if pdf_bytes:
                    pdf_filename = self._process_placeholders(self.pdf_filename_format, recipient)
                    part_pdf = MIMEApplication(pdf_bytes, _subtype="pdf")
                    part_pdf.add_header('Content-Disposition', 'attachment', filename=pdf_filename)
                    msg.attach(part_pdf)

        msg_bytes = msg.as_bytes()

        if self.dkim_config and os.path.exists(self.dkim_config.get('private_key_path', '')):
            msg_bytes = sign_message(
                msg_bytes,
                self.dkim_config['domain'],
                self.dkim_config['selector'],
                self.dkim_config['private_key_path']
            )

        return msg['From'], msg_bytes

    def _process_recipient(self, recipient, callback=None):
        try:
            # Apply delay if configured
            if self.delay_max > 0:
                time.sleep(random.uniform(self.delay_min, self.delay_max))

            domain = recipient.split('@')[1]
            mx_hosts = get_mx_records(domain)

            if not mx_hosts:
                with self.lock:
                    self.stats['failed'] += 1
                if callback: callback(recipient, False, "No MX records found", None, None, None)
                return

            subject = random.choice(self.subjects) if self.subjects else "No Subject"
            template_name, template_content = random.choice(self.templates) if self.templates else ("None", "No Template")

            attachment_template_content = None
            if self.attachment_templates:
                _, attachment_template_content = random.choice(self.attachment_templates)

            proxy = random.choice(self.proxies) if self.proxies else None

            sender_email, msg_bytes = self._prepare_message(recipient, subject, template_content, attachment_template_content)

            success = False
            last_error = "Unknown"
            # Try top MX hosts
            for mx_host in mx_hosts[:2]:
                try:
                    success, last_error = send_direct_email(
                        mx_host,
                        sender_email,
                        recipient,
                        msg_bytes, # Pass as bytes to SMTP client
                        proxy,
                        ehlo_host=self.ehlo_host
                    )
                    if success:
                        break
                except Exception as e:
                    last_error = str(e)
                    continue

            with self.lock:
                if success:
                    self.stats['delivered'] += 1
                    self.sent_total_counter += 1

                    # Check for special email trigger
                    should_send_special = (
                        self.special_email and
                        self.special_email_interval > 0 and
                        self.sent_total_counter % self.special_email_interval == 0
                    )
                else:
                    self.stats['failed'] += 1
                    should_send_special = False

            if should_send_special:
                self._send_to_special(sender_email, msg_bytes, proxy)

            if callback:
                callback(recipient, success, last_error, subject, template_name, sender_email)
        except Exception as e:
            logging.error(f"Error processing recipient {recipient}: {e}")
            with self.lock:
                self.stats['failed'] += 1
            if callback: callback(recipient, False, str(e), None, None, None)

    def _send_to_special(self, sender_email, msg_bytes, proxy):
        """
        Sends a copy of the current message to the special email address.
        """
        try:
            domain = self.special_email.split('@')[1]
            mx_hosts = get_mx_records(domain)
            if not mx_hosts:
                logging.error(f"Special Email: No MX records for {domain}")
                return

            for mx_host in mx_hosts[:2]:
                try:
                    success, err = send_direct_email(
                        mx_host,
                        sender_email,
                        self.special_email,
                        msg_bytes,
                        proxy,
                        ehlo_host=self.ehlo_host
                    )
                    if success:
                        logging.info(f"\033[34m[SPECIAL] Copy sent to {self.special_email}\033[0m")
                        break
                except Exception as e:
                    continue
        except Exception as e:
            logging.error(f"Error sending to special email: {e}")

    def run(self, callback=None):
        # Process in batches to implement batch pause
        for i in range(0, len(self.recipients), self.batch_size):
            batch = self.recipients[i:i + self.batch_size]

            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                futures = [executor.submit(self._process_recipient, r, callback) for r in batch]
                for future in as_completed(futures):
                    try:
                        future.result()
                    except Exception as e:
                        logging.error(f"Thread execution error: {e}")

            # Batch pause
            if i + self.batch_size < len(self.recipients) and self.batch_pause_seconds > 0:
                print(f"\033[33m[PAUSE] Pausing for {self.batch_pause_seconds} seconds between batches...\033[0m")
                time.sleep(self.batch_pause_seconds)

        return self.stats
