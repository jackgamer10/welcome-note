import smtplib
import socks
import socket
from urllib.parse import urlparse

class SOCKS5SMTP(smtplib.SMTP):
    """
    SMTP client that routes through a SOCKS5 proxy.
    """
    def __init__(self, host='', port=0, local_hostname=None, timeout=socket._GLOBAL_DEFAULT_TIMEOUT,
                 proxy_host=None, proxy_port=None, proxy_user=None, proxy_pass=None):
        self.proxy_host = proxy_host
        self.proxy_port = proxy_port
        self.proxy_user = proxy_user
        self.proxy_pass = proxy_pass
        super().__init__(host, port, local_hostname, timeout)

    def _get_socket(self, host, port, timeout):
        if self.proxy_host and self.proxy_port:
            s = socks.socksocket()
            s.set_proxy(
                proxy_type=socks.SOCKS5,
                addr=self.proxy_host,
                port=self.proxy_port,
                username=self.proxy_user,
                password=self.proxy_pass
            )
            s.settimeout(timeout)
            try:
                s.connect((host, port))
            except Exception as e:
                raise ConnectionError(f"Proxy connection failed: {e}")
            return s
        else:
            return socket.create_connection((host, port), timeout)

def send_direct_email(mx_host, sender_email, recipient_email, msg_data, proxy=None, ehlo_host="example.com"):
    """
    Sends an email directly to an MX host, optionally via a proxy.
    msg_data can be string or bytes.
    """
    proxy_host = None
    proxy_port = None
    proxy_user = None
    proxy_pass = None

    if proxy:
        try:
            # Add scheme if missing for urlparse
            if not proxy.startswith("socks5://"):
                proxy_str = f"socks5://{proxy}"
            else:
                proxy_str = proxy

            parsed = urlparse(proxy_str)
            proxy_host = parsed.hostname
            proxy_port = parsed.port
            proxy_user = parsed.username
            proxy_pass = parsed.password
        except Exception:
            pass

    try:
        # Use port 25 for direct-to-MX
        with SOCKS5SMTP(host=mx_host, port=25, timeout=15,
                        proxy_host=proxy_host, proxy_port=proxy_port,
                        proxy_user=proxy_user, proxy_pass=proxy_pass) as server:
            server.set_debuglevel(0)
            server.ehlo(ehlo_host)
            # sendmail handles both string and bytes
            server.sendmail(sender_email, [recipient_email], msg_data)
        return True, "Delivered"
    except Exception as e:
        return False, str(e)
