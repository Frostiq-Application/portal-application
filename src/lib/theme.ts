/**
 * Per-brand accent theming. A brand account carries a `themeColor` (hex); when
 * one of its admins (account_super_admin / shop_admin) is signed in we override
 * the portal's primary-accent CSS variables so buttons, the active nav item,
 * links, focus rings and switches take the brand's colour. Backgrounds and text
 * stay neutral, so contrast never depends on the chosen colour.
 *
 * The base palette is HSL-triple CSS vars (see index.css), so we convert the
 * hex to an `H S% L%` triple and derive a readable foreground from its
 * luminance. Applied to `:root`, it wins over both the light and `.dark` blocks.
 */

/** Curated on-brand presets offered in the create-shop form. */
export const THEME_PRESETS: { name: string; hex: string }[] = [
  { name: "Frosting pink", hex: "#E91E63" },
  { name: "Grape", hex: "#7C3AED" },
  { name: "Ocean", hex: "#2563EB" },
  { name: "Teal", hex: "#0D9488" },
  { name: "Forest", hex: "#16A34A" },
  { name: "Amber", hex: "#D97706" },
  { name: "Cherry", hex: "#DC2626" },
  { name: "Slate", hex: "#475569" },
];

/** The primary-accent family we recolour. Everything else stays as the base theme. */
const PRIMARY_VARS = [
  "--primary",
  "--ring",
  "--sidebar-primary",
  "--sidebar-ring",
] as const;
const PRIMARY_FOREGROUND_VARS = [
  "--primary-foreground",
  "--sidebar-primary-foreground",
] as const;

/** Parse `#RGB` / `#RRGGBB` → [r,g,b] 0-255, or null if malformed. */
function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** A hex colour as the `H S% L%` string Tailwind's `hsl(var(--x))` expects. */
function hexToHslTriple(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** WCAG relative luminance (0 dark → 1 light) for foreground contrast picking. */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/**
 * Override the primary-accent CSS vars on `:root` for the brand colour, or clear
 * the override when `hex` is null/invalid (falls back to the base palette).
 * Idempotent — safe to call on every render / brand change.
 */
export function applyBrandTheme(hex: string | null | undefined): void {
  const root = document.documentElement;
  const triple = hex ? hexToHslTriple(hex) : null;
  const rgb = hex ? parseHex(hex) : null;

  if (!triple || !rgb) {
    [...PRIMARY_VARS, ...PRIMARY_FOREGROUND_VARS].forEach((v) =>
      root.style.removeProperty(v),
    );
    return;
  }

  // Dark colours get a near-white foreground, light colours a near-black one.
  const fg = luminance(rgb) > 0.5 ? "240 10% 12%" : "0 0% 100%";
  PRIMARY_VARS.forEach((v) => root.style.setProperty(v, triple));
  PRIMARY_FOREGROUND_VARS.forEach((v) => root.style.setProperty(v, fg));
}
