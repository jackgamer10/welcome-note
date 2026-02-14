import random
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from magxxic.core.resolver import get_mx_records
from magxxic.core.smtp_client import send_direct_email
from magxxic.core.signer import sign_message

class CampaignEngine:
    def __init__(self, config):
        self.subjects = config.get('subjects', [])
        self.templates = config.get('templates', [])
        self.recipients = config.get('recipients', [])
        self.proxies = config.get('proxies', [])
        self.senders = config.get('senders', ["info@backstage.co.jp"])
        self.dkim_config = config.get('dkim', {})

        self.max_workers = config.get('threads', 10)

        self.stats = {
            'delivered': 0,
            'failed': 0,
            'total': len(self.recipients)
        }
        self.lock = threading.Lock()

    def _prepare_message(self, recipient, subject, template_content):
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = random.choice(self.senders)
        msg['To'] = recipient

        part = MIMEText(template_content, 'html')
        msg.attach(part)

        msg_bytes = msg.as_bytes()

        if self.dkim_config:
            msg_bytes = sign_message(
                msg_bytes,
                self.dkim_config['domain'],
                self.dkim_config['selector'],
                self.dkim_config['private_key_path']
            )

        return msg['From'], msg_bytes

    def _process_recipient(self, recipient, callback=None):
        domain = recipient.split('@')[1]
        mx_hosts = get_mx_records(domain)

        if not mx_hosts:
            with self.lock:
                self.stats['failed'] += 1
            if callback: callback(recipient, False, "No MX records found", None, None, None)
            return

        subject = random.choice(self.subjects) if self.subjects else "No Subject"
        template_name, template_content = random.choice(self.templates) if self.templates else ("None", "No Template")
        proxy = random.choice(self.proxies) if self.proxies else None

        sender_email, msg_bytes = self._prepare_message(recipient, subject, template_content)

        success = False
        last_error = "Unknown"
        # Try top MX hosts
        for mx_host in mx_hosts[:2]:
            success, last_error = send_direct_email(mx_host, sender_email, recipient, msg_bytes.decode('utf-8', errors='ignore'), proxy)
            if success:
                break

        with self.lock:
            if success:
                self.stats['delivered'] += 1
            else:
                self.stats['failed'] += 1

        if callback:
            callback(recipient, success, last_error, subject, template_name, sender_email)

    def run(self, callback=None):
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(self._process_recipient, r, callback) for r in self.recipients]
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    # Individual recipient processing errors should be handled in _process_recipient,
                    # but we catch unexpected exceptions here.
                    pass

        return self.stats
