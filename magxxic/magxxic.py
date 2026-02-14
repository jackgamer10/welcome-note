import sys
import time
import random
import os

# NOTE: This script is a simulation based on the "Magxxic" direct-to-MX delivery system
# terminal output provided in the task description image.

def print_banner():
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
    print("      VERSION 2.1.1 | BUILD 2026-02-14 | SCORPION PROTOCOL")
    print("\033[32m" + "="*85 + "\033[0m")

def load_list(filepath):
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            return [line.strip() for line in f if line.strip()]
    return []

def main():
    try:
        # Load resources
        base_dir = os.path.dirname(os.path.abspath(__file__))
        template_dir = os.path.join(base_dir, 'templates', 'format')

        subjects = load_list(os.path.join(base_dir, 'subjects.txt'))
        recipients = load_list(os.path.join(base_dir, 'recipients.txt'))
        proxies = load_list(os.path.join(base_dir, 'proxies.txt'))

        if not recipients:
            print("\033[31m[ERROR] No recipients loaded from recipients.txt\033[0m")
            return

        templates = []
        if os.path.exists(template_dir):
            templates = [f for f in os.listdir(template_dir) if f.endswith('.html')]

        print_banner()

        current_proxy = random.choice(proxies) if proxies else "47.***.***.***"

        print(f"\033[32m{' Magxxic V2.1 - PROXY-ONLY DIRECT-TO-MX (ADVANCED) ':=^85}\033[0m")
        print("\033[32mMODE: PROXY DIRECT-TO-MX (No SMTP Relay)\033[0m")
        print(f"  Proxy: {current_proxy}")
        print("  EHLO: backstage.co.jp")
        print(f"SENDERS: {len(subjects)} subjects loaded")
        print("\033[33mIP-HIDING: DISABLED (your IP visible to sending proxy)\033[0m")
        print(f"TEMPLATES: {len(templates)} loaded")
        for t in templates[:2]:
            print(f"    format/{t}")
        if len(templates) > 2:
            print(f"    ... and {len(templates) - 2} more")

        print(f"RECIPIENTS: {len(recipients)} loaded")
        print("TEST EMAIL: Every 100 emails to m********o@p***********o.jp")
        print("ROTATION: Enabled (Subject & Template)")
        print("\033[32m" + "="*85 + "\033[0m")

        time.sleep(0.5)
        print("\033[34m[TEST]\033[0m Testing proxy chain connectivity...")
        time.sleep(0.8)
        print("\033[34m[TEST]\033[0m Chain: Sending -> MX")
        time.sleep(0.6)
        print("\033[34m[TEST]\033[0m \033[32mDNS OK\033[0m - MX for gmail.com: gmail-smtp-in.l.google.com")
        time.sleep(0.7)
        print(f"\033[34m[TEST]\033[0m \033[32mPROXY CHAIN OK\033[0m - Connected to gmail-smtp-in.l.google.com:25 via {current_proxy}")
        time.sleep(0.5)
        print("\033[34m[TEST]\033[0m SMTP Greeting: 220 mx.google.com ESMTP d75a77b69052e-506393a0f28si117040171cf.345 - gsmtp")
        time.sleep(0.4)
        print(f"\033[34m[LIST]\033[0m Loaded {len(recipients)} valid recipients")

        time.sleep(1)
        print(f"\033[32m[GO] LAUNCHING CAMPAIGN for {len(recipients)} recipients (Mode: PROXY DIRECT-TO-MX)\033[0m")
        print(f"\033[34m[INFO]\033[0m Smart Speed Campaign - {len(recipients)} recipients | Mode: PROXY DIRECT-TO-MX")
        print("\033[34m[INFO]\033[0m Batch: 20 | Threads: 10")
        print("\033[34m[INFO]\033[0m Rotation: ACTIVE")

        time.sleep(0.5)
        print(f"\033[33m[BATCH 01] Processing 1-{len(recipients)}\033[0m")

        sender_domains = ["backstage.co.jp", "prairiedog.co.jp", "uanstudio.com"]

        success_count = 0
        for i, recipient in enumerate(recipients):
            subject = random.choice(subjects) if subjects else "No Subject"
            template = random.choice(templates) if templates else "No Template"
            sender = f"info@{random.choice(sender_domains)}"

            time.sleep(random.uniform(0.3, 1.0))
            print(f"\033[32m[{i+1:03}/{len(recipients):03}] DELIVERED -> {recipient[:3]}***{recipient[recipient.find('@')-1:]} ({sender} | Direct)\033[0m")
            print(f"      \033[90mSubject: {subject} | Template: {template}\033[0m")
            success_count += 1

        time.sleep(0.5)
        print("\033[32m" + "="*85 + "\033[0m")
        print("\033[32mOPERATION COMPLETE - MAGXXIC V2.1 (PROXY DIRECT-TO-MX)\033[0m")
        print("\033[32m" + "="*85 + "\033[0m")
        print("    [DELIVERY STATISTICS]")
        print(f"      DELIVERED:    \033[32m{success_count} emails\033[0m")
        print("      FAILED:       \033[31m0 emails\033[0m")
        print(f"      TOTAL:        {len(recipients)} emails")

        rate = (success_count / len(recipients)) * 100 if recipients else 0
        print(f"      SUCCESS RATE: \033[32m{rate:.1f}% (EXCELLENT)\033[0m")
        print("\033[32m" + "="*85 + "\033[0m")
    except KeyboardInterrupt:
        print("\n\033[31m[!] Operation aborted by user.\033[0m")
        sys.exit(0)
    except Exception as e:
        print(f"\n\033[31m[ERROR] {e}\033[0m")
        sys.exit(1)

if __name__ == "__main__":
    main()
