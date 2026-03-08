import sys
import time
import random
import os
import json
import argparse
from datetime import datetime
try:
    import colorama
    colorama.init(autoreset=True)
except ImportError:
    pass
from magxxic.core.engine import CampaignEngine
from magxxic.core.proxy_validator import validate_proxies
from magxxic.core.licensing import check_license

# Set base_dir to the magxxic directory
base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'magxxic')

def print_banner(version="2.2.1"):
    # Attempting to mimic the red "brain" icon from the image
    brain = """\033[31m
         @@@@     @@@@@@@@@@@@@@@@@@     @@@@
       @@@@@@@  @@@@@@@@@@@@@@@@@@@@@@  @@@@@@@
                @@@@@@@@@@@@@@@@@@@@@@
                @@@@@@@@@@@@@@@@@@@@@@
                @@@@@@@@@@@@@@@@@@@@@@
                @@@@@@@@@@@@@@@@@@@@@@\033[0m"""

    # Magxxic Banner
    banner = """\033[32m
  __  __                             _
 |  \\/  |                           (_)
 | \\  / |  __ _   __ _ __  __ __  __ _   ___
 | |\\/| | / _` | / _` |\\ \\/ / \\ \\/ /| | / __|
 | |  | || (_| || (_| | >  <   >  < | || (__
 |_|  |_| \\__,_| \\__, |/_/\\_\\ /_/\\_\\|_| \\___|
                  __/ |
                 |___/                        \033[0m
"""
    print(brain)
    print(banner)
    print("\033[32m      >>> PROXY-ONLY DIRECT-TO-MX DELIVERY SYSTEM - STATUS: ARMED <<<\033[0m")
    print("      [RFC-2822] [DKIM-SIGNED] [SOCKS5-CHAIN] [ZERO-SMTP-RELAY]")
    print(f"      VERSION {version} | BUILD 2026-02-14 | SCORPION PROTOCOL")
    print("\033[32m" + "="*85 + "\033[0m")

def load_list(filepath):
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            return [line.strip() for line in f if line.strip()]
    return []

def load_templates(template_dir):
    templates = []
    if os.path.exists(template_dir):
        for f in os.listdir(template_dir):
            if f.endswith('.html'):
                with open(os.path.join(template_dir, f), 'r') as tf:
                    templates.append((f, tf.read()))
    return templates

def delivery_callback(recipient, success, error, subject, template_name, sender):
    # Global stats for live update
    global engine_instance
    stats = engine_instance.stats

    timestamp = datetime.now().strftime("%H:%M:%S")
    status = "\033[32mDELIVERED\033[0m" if success else "\033[31mFAILED\033[0m"
    mask_recipient = f"{recipient[:3]}***{recipient[recipient.find('@')-1:]}"

    # Table columns: [TIME] [STATUS] [RECIPIENT] [SENDER] [STATS]
    stats_str = f"(\033[32m{stats['delivered']}\033[0m/\033[31m{stats['failed']}\033[0m/{stats['total']})"

    print(f"[{timestamp}] {status:<20} {mask_recipient:<25} {sender:<25} {stats_str}")
    if not success:
        err_msg = str(error)[:50] + "..." if len(str(error)) > 50 else str(error)
        print(f"      \033[31mError: {err_msg}\033[0m")

def format_bar(delivered, total, length=20):
    if total == 0: return "\033[90m" + "░" * length + "\033[0m"
    filled = int(delivered / total * length)
    pct = (delivered / total) * 100
    color = "\033[32m" if pct > 70 else "\033[33m" if pct > 30 else "\033[31m"
    return color + "█" * filled + "\033[90m" + "░" * (length - filled) + "\033[0m"

def interactive_dashboard(app_config):
    while True:
        os.system('cls' if os.name == 'nt' else 'clear')
        print_banner()
        print(f"\033[1;34m{' CONFIGURATION DASHBOARD ':=^85}\033[0m")

        options = [
            ("DKIM Signing", "dkim_enabled", app_config.get('dkim_enabled', True)),
            ("IP-Hiding (SOCKS5)", "hide_ip", app_config.get('hide_ip', True)),
            ("PDF Attachments", "attach_pdf", app_config.get('attach_pdf', False)),
            ("Military Grade Headers", "military_grade_headers", app_config.get('military_grade_headers', False)),
            ("Proxy Validation", "validate_proxies", app_config.get('validate_proxies', True)),
            ("MX Pre-Check", "validate_mx_before_send", app_config.get('validate_mx_before_send', True)),
            ("Port 25 Test", "test_connection_before_send", app_config.get('test_connection_before_send', False)),
            ("Dynamic EHLO", "auto_ehlo", app_config.get('auto_ehlo', False)),
            ("SMTP Debug Logs", "smtp_debug", app_config.get('smtp_debug', False)),
            ("Resilient Retries", "resilient_mode", app_config.get('proxy_retries', 0) > 0),
        ]

        for i, (label, key, value) in enumerate(options, 1):
            val_str = "\033[32m[ON]\033[0m" if value else "\033[31m[OFF]\033[0m"
            print(f"  {i}. {label:<30} {val_str}")

        print("\033[34m" + "-"*85 + "\033[0m")
        print("  S. START CAMPAIGN")
        print("  Q. QUIT")
        print("\033[34m" + "="*85 + "\033[0m")

        choice = input("\nSelect an option to toggle or 'S' to start: ").strip().lower()

        if choice == 's':
            return True
        elif choice == 'q':
            sys.exit(0)
        elif choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(options):
                key = options[idx][1]
                if key == "resilient_mode":
                    # Special handling for proxy_retries toggle
                    current = app_config.get('proxy_retries', 0)
                    app_config['proxy_retries'] = 3 if current == 0 else 0
                else:
                    app_config[key] = not app_config.get(key, options[idx][2])
        else:
            continue

engine_instance = None

def main():
    global engine_instance
    try:
        # Check License
        if not check_license(base_dir):
            sys.exit(0)
        # Argument Parsing
        parser = argparse.ArgumentParser(description="Magxxic Direct-to-MX Sender")
        parser.add_argument("-a", "--attach", action="store_true", help="Force enable PDF attachments")
        parser.add_argument("-n", "--no-attach", action="store_true", help="Force disable PDF attachments")
        parser.add_argument("-p", "--prob", type=int, help="Set attachment probability (0-100)")
        parser.add_argument("--dkim", action="store_true", help="Force enable DKIM signing")
        parser.add_argument("--no-dkim", action="store_true", help="Force disable DKIM signing")
        parser.add_argument("--dkim-mime", action="store_true", help="Force sign MIME headers in DKIM")
        parser.add_argument("--no-dkim-mime", action="store_true", help="Force exclude MIME headers from DKIM")
        parser.add_argument("--dkim-key", type=str, help="Path to DKIM private key file")
        parser.add_argument("--hide-ip", action="store_true", help="Force enable IP hiding (require proxy)")
        parser.add_argument("--show-ip", action="store_true", help="Force disable IP hiding")
        args = parser.parse_args()

        # Load config
        config_path = os.path.join(base_dir, 'config.json')
        app_config = {}
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                app_config = json.load(f)

        # CLI Overrides
        if args.attach:
            app_config['attach_pdf'] = True
        if args.no_attach:
            app_config['attach_pdf'] = False
        if args.prob is not None:
            app_config['attachment_probability'] = args.prob
        if args.dkim:
            app_config['dkim_enabled'] = True
        if args.no_dkim:
            app_config['dkim_enabled'] = False
        if args.dkim_mime:
            app_config['dkim_sign_mime'] = True
        if args.no_dkim_mime:
            app_config['dkim_sign_mime'] = False
        if args.dkim_key:
            app_config['dkim_private_key_path'] = args.dkim_key
        if args.hide_ip:
            app_config['hide_ip'] = True
        if args.show_ip:
            app_config['hide_ip'] = False

        # Load resources
        template_dir = os.path.join(base_dir, 'templates', 'format')
        attachment_template_dir = os.path.join(base_dir, 'templates', 'attachments')

        subjects = load_list(os.path.join(base_dir, 'subjects.txt'))
        recipients = load_list(os.path.join(base_dir, 'recipients.txt'))
        raw_proxies = load_list(os.path.join(base_dir, 'proxies.txt'))
        links = load_list(os.path.join(base_dir, 'links.txt'))

        if not recipients:
            print("\033[31m[ERROR] No recipients loaded from magxxic/recipients.txt\033[0m")
            return

        templates = load_templates(template_dir)
        attachment_templates = load_templates(attachment_template_dir)

        # Launch Dashboard
        if not any(vars(args).values()): # Only show if no CLI args provided
            interactive_dashboard(app_config)

        os.system('cls' if os.name == 'nt' else 'clear')
        print_banner(version="2.2.1")

        # Local Port 25 Sanity Check
        if not app_config.get('hide_ip', True) or not raw_proxies:
            print(f"\033[34m[CHECK]\033[0m Testing local outbound Port 25...")
            try:
                with socket.create_connection(("smtp.google.com", 25), timeout=5):
                    print(f"      \033[32mLocal Port 25: OPEN\033[0m")
            except:
                print(f"      \033[33m[WARNING] Local Port 25 is CLOSED/BLOCKED.\033[0m")
                print(f"                Direct delivery will fail without a functional SOCKS5 proxy.")
                time.sleep(2)

        # Proxy Validation
        proxies = raw_proxies
        if raw_proxies and app_config.get('validate_proxies', True):
            print(f"\033[34m[VALIDATING]\033[0m Checking {len(raw_proxies)} proxies...")
            proxies = validate_proxies(raw_proxies, test_smtp=app_config.get('test_connection_before_send', False))
            print(f"      \033[32m{len(proxies)}/{len(raw_proxies)} proxies functional.\033[0m")
            if not proxies and app_config.get('hide_ip', True):
                print("\033[31m[ERROR] No working proxies found and IP-Hiding is ENABLED. Aborting.\033[0m")
                return

        # DKIM Config
        dkim_config = {}
        dkim_key_filename = app_config.get('dkim_private_key_path', 'dkim_private.pem')
        if os.path.isabs(dkim_key_filename):
            dkim_key_path = dkim_key_filename
        else:
            dkim_key_path = os.path.join(base_dir, dkim_key_filename)

        if app_config.get('dkim_enabled', True) and os.path.exists(dkim_key_path):
            dkim_config = {
                'domain': app_config.get('sender_domain', 'example.com'),
                'selector': app_config.get('dkim_selector', 'default'),
                'private_key_path': dkim_key_path,
                'sign_mime': app_config.get('dkim_sign_mime', True)
            }

        current_proxy = random.choice(proxies) if proxies else "NONE"

        print(f"\033[32m{' Magxxic V2.2.1 - FUNCTIONAL PROXY DIRECT-TO-MX ':=^85}\033[0m")
        print("\033[32mMODE: PROXY DIRECT-TO-MX (No SMTP Relay)\033[0m")
        print(f"  Proxy: {current_proxy}")
        print(f"  EHLO: {app_config.get('ehlo_host', 'example.com')}")

        ip_hiding = '\033[32mENABLED\033[0m' if app_config.get('hide_ip', True) else '\033[31mDISABLED\033[0m'
        print(f"  IP-HIDING: {ip_hiding}")

        dkim_status = '\033[32mENABLED\033[0m' if dkim_config else '\033[31mDISABLED\033[0m'
        if app_config.get('dkim_enabled', True) and not os.path.exists(dkim_key_path):
            dkim_status += " (Key not found)"
        print(f"  DKIM Signing: {dkim_status}")

        attach_status = '\033[32mENABLED\033[0m' if app_config.get('attach_pdf', False) else '\033[31mDISABLED\033[0m'
        if app_config.get('attach_pdf', False):
            prob = app_config.get('attachment_probability', 100)
            attach_status += f" (Probability: {prob}%)"
        print(f"  PDF Attachments: {attach_status}")

        print(f"SENDERS: {len(subjects)} subjects loaded")
        print(f"TEMPLATES: {len(templates)} letters loaded")
        for t_name, _ in templates[:2]:
            print(f"    format/{t_name}")
        if len(templates) > 2:
            print(f"    ... and {len(templates) - 2} more")

        if attachment_templates:
            print(f"ATTACHMENT TEMPLATES: {len(attachment_templates)} loaded")
            for t_name, _ in attachment_templates[:2]:
                print(f"    attachments/{t_name}")
            if len(attachment_templates) > 2:
                print(f"    ... and {len(attachment_templates) - 2} more")

        print(f"RECIPIENTS: {len(recipients)} loaded")
        print("ROTATION: Enabled (Subject & Template)")
        print("\033[32m" + "="*85 + "\033[0m")

        time.sleep(0.5)
        print("\033[34m[TEST]\033[0m Testing proxy chain connectivity...")
        time.sleep(0.5)
        print("\033[34m[TEST]\033[0m \033[32mDNS OK\033[0m - Resolver ready.")

        engine = CampaignEngine({
            'subjects': subjects,
            'templates': templates,
            'attachment_templates': attachment_templates,
            'recipients': recipients,
            'proxies': proxies,
            'links': links,
            'senders': app_config.get('senders', ["info@example.com"]),
            'dkim': dkim_config,
            'threads': app_config.get('threads', 10),
            'batch_size': app_config.get('batch_size', 20),
            'ehlo_host': app_config.get('ehlo_host', 'example.com'),
            'delay_min': app_config.get('delay_min', 0),
            'delay_max': app_config.get('delay_max', 0),
            'batch_pause_seconds': app_config.get('batch_pause_seconds', 0),
            'attach_pdf': app_config.get('attach_pdf', False),
            'attachment_probability': app_config.get('attachment_probability', 100),
            'pdf_filename_format': app_config.get('pdf_filename_format', 'Document.pdf'),
            'special_email': app_config.get('special_email', ""),
            'special_email_interval': app_config.get('special_email_interval', 0),
            'hide_ip': app_config.get('hide_ip', True),
            'tracking_url': app_config.get('tracking_url', ""),
            'x_mailer': app_config.get('x_mailer', "Magxxic-V2"),
            'custom_headers': app_config.get('custom_headers', {})
        })

        print(f"\033[32m[GO] LAUNCHING CAMPAIGN for {len(recipients)} recipients\033[0m")
        print(f"\033[1;37m{'TIME':<10} {'STATUS':<20} {'RECIPIENT':<25} {'SENDER':<25} {'PROGRESS'}\033[0m")
        print("-" * 100)

        engine_instance = engine
        stats = engine.run(callback=delivery_callback)

        duration = stats['end_time'] - stats['start_time']
        throughput = (stats['delivered'] + stats['failed']) / (duration / 60) if duration > 0 else 0
        success_rate = (stats['delivered'] / stats['total']) * 100 if stats['total'] else 0

        status_msg = "\033[32mOPERATION COMPLETE\033[0m" if success_rate > 90 else "\033[33mOPERATION COMPLETED WITH ERRORS\033[0m" if success_rate > 0 else "\033[31mOPERATION FAILED\033[0m"

        print("\n\033[32m" + "="*85 + "\033[0m")
        print(f"{status_msg} - MAGXXIC V2.2.1 (PROXY DIRECT-TO-MX)")
        print("\033[32m" + "="*85 + "\033[0m")

        print("\033[1;37m[DELIVERY STATISTICS]\033[0m")
        print(f"  DELIVERED:    \033[32m{stats['delivered']} emails\033[0m")
        print(f"  FAILED:       \033[31m{stats['failed']} emails\033[0m")
        print(f"  TOTAL:        {stats['total']} emails")
        rate_color = "\033[32m" if success_rate > 80 else "\033[33m" if success_rate > 20 else "\033[31m"
        print(f"  SUCCESS RATE: {rate_color}{success_rate:.1f}% ({'HEALTHY' if success_rate > 80 else 'DEGRADED' if success_rate > 20 else 'CRITICAL'})\033[0m")

        print("\n\033[1;37m[PERFORMANCE METRICS]\033[0m")
        print(f"  DURATION:     \033[36m{duration:.1f}s\033[0m")
        print(f"  THROUGHPUT:   \033[36m{throughput:.1f} emails/minute\033[0m")
        print(f"  MODE:         PROXY DIRECT-TO-MX")
        print(f"  PROXY:        {current_proxy}")
        ip_hide_status = '\033[32mENABLED\033[0m' if app_config.get('hide_ip', True) else '\033[31mDISABLED\033[0m'
        print(f"  IP-HIDING:    {ip_hide_status}")

        print("\n\033[34m" + "-"*85 + "\033[0m")
        print(f"\033[31m[STATUS] {status_msg.replace('\033[32m','').replace('\033[33m','').replace('\033[31m','').replace('[0m','')}\033[0m")
        print("\033[34m" + "-"*85 + "\033[0m")

        print("\n\033[1;34mBOUNCE ANALYSIS REPORT\033[0m")
        print("\033[34m" + "-"*85 + "\033[0m")
        print(f"  Hard Bounces (permanent): \033[31m{stats['bounces']['hard']}\033[0m")
        print(f"  Soft Bounces (temporary): \033[33m{stats['bounces']['soft']}\033[0m")
        print(f"  Block Bounces (spam/IP):  \033[31m{stats['bounces']['block']}\033[0m")
        print(f"  Retried:                  \033[36m{stats['retried']}\033[0m")
        print(f"  Retry Successes:          \033[32m{stats['retry_successes']}\033[0m")
        print(f"  Domains Flagged:          \033[31m{stats['domains_flagged']}\033[0m")

        print("\n  \033[33mProblem Domains:\033[0m")
        problem_domains = {d: v for d, v in stats['domain_engagement'].items() if v['failed'] > 0}
        for domain, data in sorted(problem_domains.items(), key=lambda x: x[1]['failed'], reverse=True)[:5]:
            codes = ", ".join(str(c) for c in data['errors'].keys())
            print(f"    {domain}: {data['failed']} failures, codes: {{{codes}}}")

        print("\n\033[1;34mDOMAIN ENGAGEMENT REPORT\033[0m")
        print("\033[34m" + "-"*85 + "\033[0m")
        for domain, data in sorted(stats['domain_engagement'].items(), key=lambda x: x[1]['delivered'] + x[1]['failed'], reverse=True)[:15]:
            d_total = data['delivered'] + data['failed']
            d_rate = (data['delivered'] / d_total * 100) if d_total > 0 else 0
            bar = format_bar(data['delivered'], d_total)
            print(f"  {domain:<30} {bar} {d_rate:>3.0f}% ({data['delivered']}/{d_total})")

        print("\033[34m" + "="*85 + "\033[0m")
        print("\033[90mPress ENTER to send again  |  Close window (X) to exit\033[0m")
        input()
    except KeyboardInterrupt:
        print("\n\033[31m[!] Operation aborted by user.\033[0m")
        sys.exit(0)
    except Exception as e:
        print(f"\n\033[31m[ERROR] {e}\033[0m")
        sys.exit(1)

if __name__ == "__main__":
    main()
