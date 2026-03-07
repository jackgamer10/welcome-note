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
import socket
from fpdf import FPDF
from magxxic.core.resolver import get_mx_records, get_ptr_record
from magxxic.core.smtp_client import send_direct_email
from magxxic.core.signer import sign_message
from magxxic.core.proxy_validator import check_proxy

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class CampaignEngine:
    def __init__(self, config):
        self.config = config
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
        self.auto_ehlo = config.get('auto_ehlo', False)
        self.smtp_debug = config.get('smtp_debug', False)
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

        # IP hiding
        self.hide_ip = config.get('hide_ip', True)

        # Pre-send checks
        self.validate_mx_before_send = config.get('validate_mx_before_send', True)
        self.test_connection_before_send = config.get('test_connection_before_send', False)

        # New Spam Filter & Tracking settings
        self.tracking_url = config.get('tracking_url', "")
        self.custom_headers = config.get('custom_headers', {})
        self.x_mailer = config.get('x_mailer', "Magxxic-V2")

        self.stats = {
            'delivered': 0,
            'failed': 0,
            'total': len(self.recipients),
            'start_time': None,
            'end_time': None,
            'bounces': {
                'hard': 0,
                'soft': 0,
                'block': 0
            },
            'retried': 0,
            'retry_successes': 0,
            'domains_flagged': 0,
            'domain_engagement': {} # {domain: {'delivered': 0, 'failed': 0, 'errors': {}}}
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

        # --- High-Tech Encryption ---
        def encrypt_repl(match):
            text = match.group(1)
            key = random.randint(1, 255)
            encrypted = bytes([b ^ key for b in text.encode()])
            return f"{key:02x}{binascii.hexlify(encrypted).decode()}"
        content = re.sub(r"\[\[ENCRYPT:(.*?)\]\]", encrypt_repl, content)

        def b64_encrypt_repl(match):
            text = match.group(1)
            key = random.randint(1, 255)
            encrypted = bytes([b ^ key for b in text.encode()])
            return base64.b64encode(bytes([key]) + encrypted).decode()
        content = re.sub(r"\[\[B64_ENCRYPT:(.*?)\]\]", b64_encrypt_repl, content)

        # --- Link Tracking ---
        def track_repl(match):
            url = match.group(1)
            if self.tracking_url:
                encoded_url = base64.urlsafe_b64encode(url.encode()).decode().strip('=')
                recipient_b64 = base64.urlsafe_b64encode(recipient.encode()).decode().strip('=')
                separator = "&" if "?" in self.tracking_url else "?"
                return f"{self.tracking_url}{separator}u={encoded_url}&r={recipient_b64}"
            return url
        content = re.sub(r"\[\[TRACK:(.*?)\]\]", track_repl, content)

        # --- Spam Filter Evasion (Noise) ---
        def noise_repl(match):
            noise = ''.join(random.choices(string.ascii_letters + string.digits, k=random.randint(4, 10)))
            return f"<!-- {noise} -->"
        content = re.sub(r"\[\[NOISE\]\]", noise_repl, content)

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
        sender = random.choice(self.senders)
        msg['From'] = sender
        msg['To'] = recipient

        # Standard Anti-Spam Headers
        msg['Message-ID'] = f"<{datetime.now().strftime('%Y%m%d%H%M%S')}.{random.randint(1000,9999)}@{sender.split('@')[-1]}>"
        msg['X-Mailer'] = self.x_mailer
        msg['Date'] = datetime.now().strftime("%a, %d %b %Y %H:%M:%S +0000")

        # Military Grade Headers if enabled
        if self.config.get('military_grade_headers', False):
            msg['X-Security-Level'] = 'Classified'
            msg['X-Transmission-Encryption'] = 'AES-256-GCM'
            msg['X-Originating-IP-Hiding'] = 'Enabled'
            msg['X-Protocol-Type'] = 'Scorpion-Secure'
            msg['X-Content-Signature'] = f"sha256:{''.join(random.choices(string.hexdigits.lower(), k=32))}"

        # Custom Headers
        for key, value in self.custom_headers.items():
            if key not in msg: # Don't overwrite standard ones if already set
                msg[key] = self._process_placeholders(value, recipient)

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
                self.dkim_config['private_key_path'],
                sign_mime=self.dkim_config.get('sign_mime', True)
            )

        return msg['From'], msg_bytes

    def _classify_error(self, error_msg):
        """Classify SMTP error message into Hard, Soft, or Block."""
        msg = str(error_msg).lower()
        code = 0
        match = re.search(r'(\d{3})', msg)
        if match:
            code = int(match.group(1))

        if any(keyword in msg for keyword in ['spam', 'block', 'blacklisted', 'rbl', 'denied']):
            return 'block', code
        if 500 <= code < 600:
            return 'hard', code
        if 400 <= code < 500:
            return 'soft', code
        return 'hard', code # Default to hard if unknown

    def _process_recipient(self, recipient, callback=None):
        try:
            # Apply delay if configured
            if self.delay_max > 0:
                time.sleep(random.uniform(self.delay_min, self.delay_max))

            domain = recipient.split('@')[1]

            # Initial MX Check if enabled
            if self.validate_mx_before_send:
                mx_hosts = get_mx_records(domain)
                if not mx_hosts:
                    with self.lock:
                        self.stats['failed'] += 1
                        if domain not in self.stats['domain_engagement']:
                            self.stats['domain_engagement'][domain] = {'delivered': 0, 'failed': 0, 'errors': {}}
                        self.stats['domain_engagement'][domain]['failed'] += 1
                        self.stats['domain_engagement'][domain]['errors'][0] = self.stats['domain_engagement'][domain]['errors'].get(0, 0) + 1
                    if callback: callback(recipient, False, "No MX records found", None, None, None)
                    return
            else:
                # We still need MX to send, so if not pre-validated, resolve here
                mx_hosts = get_mx_records(domain)

            subject = random.choice(self.subjects) if self.subjects else "No Subject"
            template_name, template_content = random.choice(self.templates) if self.templates else ("None", "No Template")

            attachment_template_content = None
            if self.attachment_templates:
                _, attachment_template_content = random.choice(self.attachment_templates)

            proxy = random.choice(self.proxies) if self.proxies else None

            # Enforce IP hiding
            if self.hide_ip and not proxy:
                with self.lock:
                    self.stats['failed'] += 1
                if callback: callback(recipient, False, "IP-Hiding enabled but no proxy available", subject, template_name, None)
                return

            sender_email, msg_bytes = self._prepare_message(recipient, subject, template_content, attachment_template_content)

            success = False
            last_error = "Unknown"
            smtp_code = 0

            # Try top MX hosts
            for mx_host in mx_hosts[:2]:
                try:
                    # Connection test if enabled
                    if self.test_connection_before_send:
                        if proxy:
                            if not check_proxy(proxy, test_host=mx_host, test_port=25, timeout=5):
                                last_error = f"Connection test failed (Proxy cannot reach {mx_host}:25)"
                                continue
                        else:
                            try:
                                with socket.create_connection((mx_host, 25), timeout=5):
                                    pass
                            except Exception:
                                last_error = f"Connection test failed (Direct IP cannot reach {mx_host}:25)"
                                continue

                    # Dynamic EHLO if enabled
                    current_ehlo = self.ehlo_host
                    if self.auto_ehlo and proxy:
                        # Attempt to resolve proxy IP's PTR for EHLO
                        try:
                            # Extract IP from proxy string
                            proxy_parts = urlparse(proxy if proxy.startswith('socks') else f'socks5://{proxy}')
                            if proxy_parts.hostname:
                                current_ehlo = get_ptr_record(proxy_parts.hostname, fallback=self.ehlo_host)
                        except:
                            pass

                    success, last_error = send_direct_email(
                        mx_host,
                        sender_email,
                        recipient,
                        msg_bytes, # Pass as bytes to SMTP client
                        proxy,
                        ehlo_host=current_ehlo,
                        debug=self.smtp_debug
                    )
                    if success:
                        break
                    else:
                        # track retried count if we have more hosts
                        if mx_host == mx_hosts[0] and len(mx_hosts) > 1:
                            with self.lock:
                                self.stats['retried'] += 1
                except Exception as e:
                    last_error = str(e)
                    continue

            with self.lock:
                if domain not in self.stats['domain_engagement']:
                    self.stats['domain_engagement'][domain] = {'delivered': 0, 'failed': 0, 'errors': {}}

                if success:
                    self.stats['delivered'] += 1
                    self.sent_total_counter += 1
                    self.stats['domain_engagement'][domain]['delivered'] += 1

                    # Check for special email trigger
                    should_send_special = (
                        self.special_email and
                        self.special_email_interval > 0 and
                        self.sent_total_counter % self.special_email_interval == 0
                    )

                    # If this was a retry success
                    if last_error == "Delivered" and any(h in str(last_error) for h in mx_hosts[1:]):
                         self.stats['retry_successes'] += 1
                else:
                    self.stats['failed'] += 1
                    should_send_special = False
                    self.stats['domain_engagement'][domain]['failed'] += 1

                    bounce_type, smtp_code = self._classify_error(last_error)
                    self.stats['bounces'][bounce_type] += 1
                    self.stats['domain_engagement'][domain]['errors'][smtp_code] = self.stats['domain_engagement'][domain]['errors'].get(smtp_code, 0) + 1

                    if bounce_type == 'block':
                        self.stats['domains_flagged'] += 1

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
        self.stats['start_time'] = time.time()
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

        self.stats['end_time'] = time.time()
        return self.stats
