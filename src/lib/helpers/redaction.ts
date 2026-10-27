export function redactForLogs(value: string): string {
  return (
    value
      .replace(
        /\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/=\-]+/gi,
        "$1 [redacted-token]",
      )
      .replace(/(postgres(?:ql)?:\/\/)[^@\s/]+@/gi, "$1[redacted-credentials]@")
      .replace(
        /((?:token|secret|api[_-]?key|password|authorization|cookie|encrypted[_-]?pin)["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;}]+)/gi,
        "$1[redacted-secret]",
      )
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
      .replace(/\+\d(?:[\s().-]?\d){7,14}(?!\d)/g, "[redacted-phone]")
      .replace(/(?<!\d)(?:\d{3}[ .]?){2}\d{3}(?!\d)/g, "[redacted-phone]")
      // Query/HTTP errors may echo an email body or a Nuki request parameter.
      .replace(
        /(?<![A-Za-z0-9])\d{3}[ .-]?\d{3}(?![A-Za-z0-9])/g,
        "[redacted-pin]",
      )
      .replace(
        /\b(?:eyJ[a-zA-Z0-9_-]+\.){2}[a-zA-Z0-9_-]+\b/g,
        "[redacted-token]",
      )
      .slice(0, 500)
  );
}

/** Incident details may originate in provider exceptions; credentials stay private. */
export function redactIncidentDetail(value: string): string {
  return redactForLogs(value);
}
