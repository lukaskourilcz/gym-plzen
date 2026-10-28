/** Next's fetch-based actions use long hexadecimal references, not "x"/"test". */
export function hasMalformedActionReference(
  request: Pick<Request, "method" | "headers">,
) {
  if (request.method !== "POST") return false;
  const reference = request.headers.get("next-action");
  // Native multipart forms and ordinary API requests have no such header.
  return reference !== null && !/^[a-f0-9]{40,128}$/i.test(reference);
}
