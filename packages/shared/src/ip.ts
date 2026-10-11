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

/**
 * One spelling per address (D-73), so duplicates are found and matching is simple:
 * - an IPv4 address written as IPv6 (`::ffff:41.33.10.7`, also how servers often report IPv4
 *   visitors) becomes plain `41.33.10.7`; a range `::ffff:41.33.10.0/120` becomes `41.33.10.0/24`
 * - other IPv6 addresses get their short form: `2001:DB8:0:0::1` → `2001:db8::1`
 * Call it only on a value isIpOrRange accepted.
 */
export function normalizeIp(raw: string): string {
  const [address, prefix] = raw.trim().toLowerCase().split('/');
  if (isIPv4(address))
    return prefix === undefined ? address : `${address}/${prefix}`;

  // The URL parser writes every IPv6 address in its short form, e.g. [::ffff:2921:a07]
  const short = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(short);
  const bits = prefix === undefined ? undefined : Number(prefix);
  if (mapped && (bits === undefined || bits >= 96)) {
    // The last 32 bits are the IPv4 address: 2921 a07 → 41.33 10.7
    const high = parseInt(mapped[1], 16);
    const low = parseInt(mapped[2], 16);
    const v4 = [high >> 8, high & 255, low >> 8, low & 255].join('.');
    return bits === undefined ? v4 : `${v4}/${bits - 96}`;
  }
  return prefix === undefined ? short : `${short}/${prefix}`;
}
