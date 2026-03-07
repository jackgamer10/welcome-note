import hashlib
import platform
import os
import json
import uuid

def get_hwid():
    """
    Generate a unique Hardware ID based on system attributes.
    """
    system_info = f"{platform.node()}-{platform.processor()}-{platform.system()}-{uuid.getnode()}"
    return hashlib.sha256(system_info.encode()).hexdigest().upper()[:16]

def generate_token(hwid, secret="MAGXXIC-SECRET-2024"):
    """
    Generate a valid activation token for a given HWID.
    (This logic would normally reside on a license server).
    """
    token_source = f"{hwid}-{secret}"
    return hashlib.sha256(token_source.encode()).hexdigest().upper()[:24]

def check_license(base_dir):
    """
    Check for a valid license file and prompt for activation if missing or invalid.
    """
    license_path = os.path.join(base_dir, 'license.json')
    hwid = get_hwid()

    if os.path.exists(license_path):
        with open(license_path, 'r') as f:
            try:
                data = json.load(f)
                if data.get('hwid') == hwid and data.get('token') == generate_token(hwid):
                    return True
            except:
                pass

    print("\033[31m" + "="*85 + "\033[0m")
    print(f"\033[31m[LICENSE] SOFTWARE NOT ACTIVATED\033[0m")
    print(f"YOUR HWID: \033[33m{hwid}\033[0m")
    print("\033[34mPlease provide your HWID to an administrator to receive an activation token.\033[0m")
    print("\033[31m" + "="*85 + "\033[0m")

    token = input("\nEnter Activation Token: ").strip()

    if token == generate_token(hwid):
        with open(license_path, 'w') as f:
            json.dump({'hwid': hwid, 'token': token}, f)
        print("\033[32m[SUCCESS] Magxxic Activated Successfully!\033[0m")
        return True
    else:
        print("\033[31m[ERROR] Invalid Activation Token. Access Denied.\033[0m")
        return False
