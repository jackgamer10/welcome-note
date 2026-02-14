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
