/** Contact deep-links (WhatsApp / phone) shared across the portal. */

/** Digits-only phone (wa.me requires no +, spaces, or dashes). */
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

/** A `wa.me` deep link to a phone number with an optional pre-filled message. */
export function waLink(phone: string, message?: string): string {
  const num = normalizePhone(phone);
  const base = `https://wa.me/${num}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** A `tel:` link for click-to-call. */
export function telLink(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
