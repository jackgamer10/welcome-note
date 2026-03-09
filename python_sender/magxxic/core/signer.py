import dkim
import time

def sign_message(message_bytes, domain, selector, private_key_path, sign_mime=True):
    """
    Sign an email message with DKIM.
    """
    try:
        with open(private_key_path, 'rb') as f:
            private_key = f.read()

        headers = [b'To', b'From', b'Subject']
        if sign_mime:
            headers += [b'MIME-Version', b'Content-Type']

        # dkim.sign(message, selector, domain, privkey, ...)
        sig = dkim.sign(
            message_bytes,
            selector.encode(),
            domain.encode(),
            private_key,
            include_headers=headers
        )
        return sig + message_bytes
    except Exception as e:
        # print(f"DKIM signing error: {e}")
        return message_bytes
