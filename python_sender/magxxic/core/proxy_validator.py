import socks
import socket
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor

def check_proxy(proxy_str, test_host="8.8.8.8", test_port=53, timeout=5):
    """
    Check if a SOCKS5 proxy is working by attempting a connection to a reliable host.
    """
    if not proxy_str:
        return False

    if not proxy_str.startswith("socks5://"):
        proxy_url = f"socks5://{proxy_str}"
    else:
        proxy_url = proxy_str

    try:
        parsed = urlparse(proxy_url)
        s = socks.socksocket()
        s.set_proxy(
            proxy_type=socks.SOCKS5,
            addr=parsed.hostname,
            port=parsed.port,
            username=parsed.username,
            password=parsed.password
        )
        s.settimeout(timeout)
        s.connect((test_host, test_port))
        s.close()
        return True
    except Exception:
        return False

def validate_proxies(proxies, max_workers=20, test_smtp=False):
    """
    Validate a list of proxies concurrently and return only the working ones.
    If test_smtp is True, it tests port 25 connectivity.
    """
    if not proxies:
        return []

    # Use port 25 for testing if requested, otherwise 53 (DNS)
    test_port = 25 if test_smtp else 53
    test_host = "smtp.google.com" if test_smtp else "8.8.8.8"

    working_proxies = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_proxy = {executor.submit(check_proxy, p, test_host=test_host, test_port=test_port): p for p in proxies}
        for future in future_to_proxy:
            proxy = future_to_proxy[future]
            try:
                if future.result():
                    working_proxies.append(proxy)
            except Exception:
                pass
    return working_proxies
