/** The public domain a shop slug resolves to. */
const STOREFRONT_HOST =
  (import.meta.env.VITE_STOREFRONT_HOST as string | undefined) ??
  "frostique.in";

/** A shop's public storefront address. */
export function storefrontUrl(slug: string): string {
  return `https://${STOREFRONT_HOST}/${slug}`;
}

/**
 * A `wa.me` link that opens WhatsApp with the shop's link already typed.
 *
 * Sharing is the step between "my catalogue is ready" and "I got an order",
 * and it is the one that gets skipped — copying a URL out of an admin panel
 * and into WhatsApp is four fiddly steps on a phone. This makes it one tap.
 *
 * No recipient is set on purpose: WhatsApp then opens its own contact picker,
 * so the owner can send it to a customer, a group, or their own status without
 * us needing a number.
 */
export function whatsappShareUrl(shopName: string, slug: string): string {
  const text = `${shopName} is now taking orders online 🎂\n\nBrowse the menu and order here:\n${storefrontUrl(slug)}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
