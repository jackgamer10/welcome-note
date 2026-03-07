import hashlib
import sys

def generate_token(hwid, secret="MAGXXIC-SECRET-2024"):
    """
    Generate a valid activation token for a given HWID.
    Must match the logic in magxxic/core/licensing.py
    """
    token_source = f"{hwid}-{secret}"
    return hashlib.sha256(token_source.encode()).hexdigest().upper()[:24]

def main():
    print("\033[32m" + "="*50)
    print(" MAGXXIC ADMIN TOKEN GENERATOR")
    print("="*50 + "\033[0m")

    if len(sys.argv) > 1:
        hwid = sys.argv[1].strip()
    else:
        hwid = input("Enter User's HWID: ").strip()

    if not hwid:
        print("\033[31m[ERROR] HWID is required.\033[0m")
        return

    token = generate_token(hwid)

    print(f"\nHWID:  \033[33m{hwid}\033[0m")
    print(f"TOKEN: \033[32m{token}\033[0m")
    print("\n\033[34mProvide this token to the user to activate their software.\033[0m")
    print("\033[32m" + "="*50 + "\033[0m")

if __name__ == "__main__":
    main()
