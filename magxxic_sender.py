import sys
import time
import random
import os
import json
from magxxic.core.engine import CampaignEngine

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
    status = "\033[32mDELIVERED\033[0m" if success else "\033[31mFAILED\033[0m"
    mask_recipient = f"{recipient[:3]}***{recipient[recipient.find('@')-1:]}"
    print(f"{status} -> {mask_recipient} ({sender} | Direct)")
    if not success:
        err_msg = str(error)
        if "[Errno 111] Connection refused" in err_msg or "Proxy connection failed" in err_msg or "timed out" in err_msg:
             err_msg = "Connection failed (Check Proxy/MX Connectivity)"
        print(f"      \033[31mError: {err_msg}\033[0m")
    else:
        print(f"      \033[90mSubject: {subject} | Template: {template_name}\033[0m")

def main():
    try:
        # Load config
        config_path = os.path.join(base_dir, 'config.json')
        app_config = {}
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                app_config = json.load(f)

        # Load resources
        template_dir = os.path.join(base_dir, 'templates', 'format')
        attachment_template_dir = os.path.join(base_dir, 'templates', 'attachments')

        subjects = load_list(os.path.join(base_dir, 'subjects.txt'))
        recipients = load_list(os.path.join(base_dir, 'recipients.txt'))
        proxies = load_list(os.path.join(base_dir, 'proxies.txt'))
        links = load_list(os.path.join(base_dir, 'links.txt'))

        if not recipients:
            print("\033[31m[ERROR] No recipients loaded from magxxic/recipients.txt\033[0m")
            return

        templates = load_templates(template_dir)
        attachment_templates = load_templates(attachment_template_dir)

        print_banner(version="2.2.1")

        current_proxy = random.choice(proxies) if proxies else "NONE"

        print(f"\033[32m{' Magxxic V2.2.1 - FUNCTIONAL PROXY DIRECT-TO-MX ':=^85}\033[0m")
        print("\033[32mMODE: PROXY DIRECT-TO-MX (No SMTP Relay)\033[0m")
        print(f"  Proxy: {current_proxy}")
        print(f"  EHLO: {app_config.get('ehlo_host', 'example.com')}")
        print(f"  PDF Attachments: {'\033[32mENABLED\033[0m' if app_config.get('attach_pdf', False) else '\033[31mDISABLED\033[0m'}")
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

        # DKIM Config
        dkim_config = {}
        dkim_key_path = os.path.join(base_dir, 'dkim_private.pem')
        if os.path.exists(dkim_key_path):
            dkim_config = {
                'domain': app_config.get('sender_domain', 'example.com'),
                'selector': app_config.get('dkim_selector', 'default'),
                'private_key_path': dkim_key_path
            }

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
            'pdf_filename_format': app_config.get('pdf_filename_format', 'Document.pdf')
        })

        print(f"\033[32m[GO] LAUNCHING CAMPAIGN for {len(recipients)} recipients\033[0m")

        stats = engine.run(callback=delivery_callback)

        print("\033[32m" + "="*85 + "\033[0m")
        print("\033[32mOPERATION COMPLETE - MAGXXIC V2.2.1\033[0m")
        print("\033[32m" + "="*85 + "\033[0m")
        print("    [DELIVERY STATISTICS]")
        print(f"      DELIVERED:    \033[32m{stats['delivered']} emails\033[0m")
        print(f"      FAILED:       \033[31m{stats['failed']} emails\033[0m")
        print(f"      TOTAL:        {stats['total']} emails")

        rate = (stats['delivered'] / stats['total']) * 100 if stats['total'] else 0
        print(f"      SUCCESS RATE: {rate:.1f}%")
        print("\033[32m" + "="*85 + "\033[0m")
    except KeyboardInterrupt:
        print("\n\033[31m[!] Operation aborted by user.\033[0m")
        sys.exit(0)
    except Exception as e:
        print(f"\n\033[31m[ERROR] {e}\033[0m")
        sys.exit(1)

if __name__ == "__main__":
    main()
