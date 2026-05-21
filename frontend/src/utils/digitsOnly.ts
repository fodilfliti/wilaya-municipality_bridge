/** Keep only ASCII digits (0–9); optional max length. */
export function filterDigits(value: string, maxLength?: number): string {
  const digits = value.replace(/\D/g, '')
  return maxLength != null ? digits.slice(0, maxLength) : digits
}
