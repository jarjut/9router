// Custom Minimalist Blue & OLED Black palette for Endpoint Proxy
// Light theme: Crisp, clean minimalist whites & neutral slates
// Dark theme: Deep OLED true black with high-contrast surfaces

export const COLORS = {
  // Primary - Electric/Precision Blue (Minimalist, sharp, high accessibility)
  primary: {
    DEFAULT: "#2563EB", // Blue 600 - Vivid anchor
    hover: "#1D4ED8",   // Blue 700 - Clear active contrast
    light: "#60A5FA",   // Blue 400 - Optimized for dark mode accents
    dark: "#1E40AF",    // Blue 800 - Deep press state
  },

  // Light theme: Pure crisp white, cool grays, high-contrast typography
  light: {
    bg: "#FFFFFF",
    bgAlt: "#F8FAFC",                          // Slate 50
    surface: "#FFFFFF",
    sidebar: "rgba(248, 250, 252, 0.85)",     // Frosted clean surface
    border: "rgba(15, 23, 42, 0.08)",         // Subtle separation
    textMain: "#0F172A",                       // Slate 900 (15:1 contrast against white)
    textMuted: "#475569",                      // Slate 600 (WCAG AA compliant)
  },

  // Dark theme: Pure OLED Black with calibrated surface elevation
  dark: {
    bg: "#000000",                             // True OLED black
    bgAlt: "#0B0F17",                          // Subtle deep-slate elevation
    surface: "#111827",                        // Gray 900 surface for cards/panels
    sidebar: "rgba(11, 15, 23, 0.85)",        // Translucent dark dock/sidebar
    border: "rgba(255, 255, 255, 0.12)",      // Crisp divider lines
    textMain: "#F8FAFC",                       // Slate 50 (near pure white, anti-glare)
    textMuted: "#94A3B8",                      // Slate 400 (clean secondary data)
  },

  // Status colors: Calibrated standard indicators with clean saturations
  status: {
    success: "#10B981",       // Emerald
    successLight: "#D1FAE5",
    successDark: "#047857",
    warning: "#F59E0B",       // Amber
    warningLight: "#FEF3C7",
    warningDark: "#B45309",
    error: "#EF4444",         // Rose red
    errorLight: "#FEE2E2",
    errorDark: "#B91C1C",
    info: "#0EA5E9",          // Sky cyan (contrasts clearly with primary blue)
    infoLight: "#E0F2FE",
    infoDark: "#0369A1",
  },
};

// CSS Variables mapping for Tailwind
export const CSS_VARIABLES = {
  light: {
    "--color-primary": COLORS.primary.DEFAULT,
    "--color-primary-hover": COLORS.primary.hover,
    "--color-bg": COLORS.light.bg,
    "--color-bg-alt": COLORS.light.bgAlt,
    "--color-surface": COLORS.light.surface,
    "--color-sidebar": COLORS.light.sidebar,
    "--color-border": COLORS.light.border,
    "--color-text-main": COLORS.light.textMain,
    "--color-text-muted": COLORS.light.textMuted,
  },
  dark: {
    "--color-primary": COLORS.primary.light, // Uses lighter blue in dark mode for better visibility
    "--color-primary-hover": COLORS.primary.DEFAULT,
    "--color-bg": COLORS.dark.bg,
    "--color-bg-alt": COLORS.dark.bgAlt,
    "--color-surface": COLORS.dark.surface,
    "--color-sidebar": COLORS.dark.sidebar,
    "--color-border": COLORS.dark.border,
    "--color-text-main": COLORS.dark.textMain,
    "--color-text-muted": COLORS.dark.textMuted,
  },
};
