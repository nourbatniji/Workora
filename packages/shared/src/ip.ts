// Office IP addresses for check-in (FR-CS-7, D-18): a single address or a range (CIDR),
// IPv4 like 41.33.10.7 or 41.33.10.0/24, IPv6 like 2001:db8::1 or 2001:db8::/32.

function isIPv4(value: string): boolean {
  const parts = value.split('.');
  return (
    parts.length === 4 &&
    parts.every(
      (part) =>
        /^\d{1,3}$/.test(part) &&
        Number(part) <= 255 &&
        String(Number(part)) === part,
    )
  );
}

function isIPv6(value: string): boolean {
  if (!value.includes(':') || !/^[0-9a-f:.]+$/i.test(value)) return false;
  try {
    // The URL parser knows every valid IPv6 form (::, ::ffff:1.2.3.4, …), in Node and in browsers
    new URL(`http://[${value}]/`);
    return true;
  } catch {
    return false;
  }
}

/** "41.33.10.0/24" → { address: '41.33.10.0', prefix: 24 }; an address alone has no prefix */
export function isIpOrRange(raw: string): boolean {
  const [address, prefix, extra] = raw.split('/');
  if (extra !== undefined) return false;
  const v4 = isIPv4(address);
  const v6 = !v4 && isIPv6(address);
  if (!v4 && !v6) return false;
  if (prefix === undefined) return true;
  if (!/^\d{1,3}$/.test(prefix)) return false;
  return Number(prefix) <= (v4 ? 32 : 128);
}
