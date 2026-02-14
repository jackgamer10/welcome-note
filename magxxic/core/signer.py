import dkim
import time

def sign_message(message_bytes, domain, selector, private_key_path):
    """
    Sign an email message with DKIM.
    """
    try:
        with open(private_key_path, 'rb') as f:
            private_key = f.read()

        # dkim.sign(message, selector, domain, privkey, ...)
        sig = dkim.sign(
            message_bytes,
            selector.encode(),
            domain.encode(),
            private_key,
            include_headers=[b'To', b'From', b'Subject']
        )
        return sig + message_bytes
    except Exception as e:
        # print(f"DKIM signing error: {e}")
        return message_bytes
