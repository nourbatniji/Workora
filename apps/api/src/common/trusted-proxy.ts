// Which visitor IP the API believes (FR-AT-2, D-73). Behind a proxy, the API's direct caller is
// the proxy, and the visitor's IP only arrives in the X-Forwarded-For header. A browser can put
// anything in that header, so it is only believed for the proxy hops listed in TRUSTED_PROXY.
//
// Next.js forwards /api requests WITHOUT adding the visitor's IP to X-Forwarded-For: it passes on
// whatever the browser sent. So trusting the Next.js server alone would believe a faked header.
// Only the hosting's load balancer adds the real IP, so TRUSTED_PROXY is set when the hosting is
// known, to match it. Unset (local development): the header is ignored and the IP is the direct
// caller's.

/** TRUSTED_PROXY → Express's "trust proxy" value; undefined = believe no header */
export function trustedProxySetting(
  raw: string | undefined,
): number | string[] | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (/^\d+$/.test(value)) {
    // "1" = believe the last address added to the header (the one our load balancer added)
    return Number(value);
  }
  if (value === 'true') {
    // Would believe every address in the header, including one the browser made up
    throw new Error(
      'TRUSTED_PROXY=true would trust a header any browser can fake. Use a number of hops or proxy addresses.',
    );
  }
  // Proxy addresses or ranges, e.g. "10.0.0.0/8, loopback"
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * The office IP check (D-18) needs the real visitor IP. Without TRUSTED_PROXY behind a proxy,
 * every punch would show the proxy's IP, so attendance refuses punches when a company has an IP
 * list and this is false (D-73), instead of checking the wrong IP.
 */
export function visitorIpKnown(): boolean {
  return trustedProxySetting(process.env.TRUSTED_PROXY) !== undefined;
}
