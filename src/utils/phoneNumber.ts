/** Match call log ↔ lead sheet using the last 8 digits */
const MATCH_DIGIT_COUNT = 8;

export function normalizePhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (digits.length <= MATCH_DIGIT_COUNT) {
    return digits;
  }

  return digits.slice(-MATCH_DIGIT_COUNT);
}

export function phonesMatch(a: string, b: string): boolean {
  const left = normalizePhoneNumber(a);
  const right = normalizePhoneNumber(b);

  if (!left || !right) {
    return false;
  }

  if (left.length < MATCH_DIGIT_COUNT || right.length < MATCH_DIGIT_COUNT) {
    return false;
  }

  return left === right;
}
