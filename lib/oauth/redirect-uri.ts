/**
 * Convert a glob pattern to a RegExp.
 * `*` matches one or more characters that are not `/` or `:`.
 */
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regexStr = escaped.replace(/\*/g, "[^/:]+");
  return new RegExp(`^${regexStr}$`);
}

/**
 * Check if a redirect URI matches any of the allowed patterns.
 *
 * Patterns without `*` use exact string comparison (backward compatible).
 * Patterns with `*` use glob matching where `*` matches one or more
 * characters excluding `/` and `:` (safe for hostname wildcards).
 *
 * Examples:
 * - `https://*.abc.com/callback` matches `https://app.abc.com/callback`
 * - `https://*abc.com/callback` matches `https://myabc.com/callback`
 */
export function matchRedirectUri(uri: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (!pattern.includes("*")) {
      if (pattern === uri) return true;
    } else {
      if (patternToRegex(pattern).test(uri)) return true;
    }
  }
  return false;
}
