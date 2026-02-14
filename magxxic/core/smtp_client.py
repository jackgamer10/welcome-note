import smtplib
import socks
import socket

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

def send_direct_email(mx_host, sender_email, recipient_email, msg_string, proxy=None):
    """
    Sends an email directly to an MX host, optionally via a proxy.
    """
    proxy_host = None
    proxy_port = None
    proxy_user = None
    proxy_pass = None

    if proxy:
        try:
            temp_proxy = proxy
            if "://" in temp_proxy:
                temp_proxy = temp_proxy.split("://")[1]

            if "@" in temp_proxy:
                user_pass, host_port = temp_proxy.split("@")
                proxy_host, proxy_port = host_port.split(":")
                proxy_user, proxy_pass = user_pass.split(":")
            else:
                proxy_host, proxy_port = temp_proxy.split(":")

            proxy_port = int(proxy_port)
        except Exception:
            pass # Use as-is or default to no proxy if parsing fails

    try:
        # Use port 25 for direct-to-MX
        with SOCKS5SMTP(host=mx_host, port=25, timeout=15,
                        proxy_host=proxy_host, proxy_port=proxy_port,
                        proxy_user=proxy_user, proxy_pass=proxy_pass) as server:
            server.set_debuglevel(0)
            server.helo("backstage.co.jp")
            server.sendmail(sender_email, [recipient_email], msg_string)
        return True, "Delivered"
    except Exception as e:
        return False, str(e)
