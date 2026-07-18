/**
 * Phone-number helpers. We store and transmit numbers in E.164 form
 * (e.g. +420777123456), which is what WhatsApp and GoSMS expect.
 */

const CZ_COUNTRY_CODE = "420";

/**
 * Normalise a user-entered Czech/international phone number to E.164.
 * Returns null when the input can't be interpreted as a valid number.
 *
 * Accepts: "+420 777 123 456", "777123456", "00420777123456".
 */
export function toE164(input: string, defaultCountryCode = CZ_COUNTRY_CODE): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Strip spaces, dashes, parentheses.
  let digits = trimmed.replace(/[\s\-()]/g, "");

  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.length === 9) {
    // Bare national number → prepend default country code.
    digits = defaultCountryCode + digits;
  }

  if (!/^\d{8,15}$/.test(digits)) return null;
  return `+${digits}`;
}

/** True when a string is already a valid E.164 number. */
export function isE164(value: string): boolean {
  return /^\+\d{8,15}$/.test(value);
}
