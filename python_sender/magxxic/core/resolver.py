import dns.resolver

def get_mx_records(domain):
    """
    Look up MX records for a given domain and return them sorted by preference.
    """
    try:
        answers = dns.resolver.resolve(domain, 'MX')
        # Sort by preference (lower number is higher priority)
        mx_records = sorted(answers, key=lambda r: r.preference)
        return [str(r.exchange).rstrip('.') for r in mx_records]
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.NoNameservers, Exception) as e:
        # print(f"Error resolving MX for {domain}: {e}")
        return []

def get_ptr_record(target_ip, fallback="example.com"):
    """
    Perform a reverse DNS lookup. If it fails, return the fallback domain.
    """
    try:
        # Resolve target to IP if it's a hostname (e.g. for proxy PTR check)
        # This is a bit simplified; real SOCKS5 IPs are needed.
        addr = dns.reversename.from_address(target_ip)
        answers = dns.resolver.resolve(addr, 'PTR')
        if answers:
            return str(answers[0]).rstrip('.')
        return fallback
    except Exception:
        return fallback
