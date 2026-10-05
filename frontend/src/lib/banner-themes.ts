/** Slider backgrounds an admin picks from; all keep white text readable. */
export const BANNER_THEMES = {
  NAVY: { label: "Tamnoplava", className: "bg-shop-navy", swatch: "#0e2a6b" },
  BLUE: { label: "Plava", className: "bg-shop-blue", swatch: "#1d4fd8" },
  SKY: { label: "Nebeskoplava", className: "bg-[#0b6fa8]", swatch: "#0b6fa8" },
  INK: { label: "Tamna", className: "bg-shop-ink", swatch: "#0b1b33" },
} as const;

export type BannerTheme = keyof typeof BANNER_THEMES;
