import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Time Travel Design Brand Monochromatic Palette
        brand: {
          black: "#09090B",
          dark: "#121212",
          charcoal: "#18181B",
          zinc: "#27272A",
          muted: "#71717A",
          light: "#F4F4F5",
          paper: "#FAFAFA",
          white: "#FFFFFF",
        },
        primary: {
          DEFAULT: "#09090B",
          50: "#FAFAFA",
          100: "#F4F4F5",
          200: "#E4E4E7",
          300: "#D4D4D8",
          400: "#A1A1AA",
          500: "#71717A",
          600: "#52525B",
          700: "#3F3F46",
          800: "#27272A",
          900: "#18181B",
          950: "#09090B",
        },
        // Surface colors
        surface: {
          DEFAULT: "#FFFFFF",
          secondary: "#FAFAFA",
          tertiary: "#F4F4F5",
        },
        // Restrained Financial Status Indicators
        status: {
          success: "#10B981",
          warning: "#F59E0B",
          error: "#F43F5E",
          info: "#0284C7",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        "dashboard-card": "var(--dashboard-radius-card)",
        "dashboard-control": "var(--dashboard-radius-control)",
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        card: "0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.03)",
        elevated: "0 10px 25px -5px rgb(0 0 0 / 0.06), 0 8px 10px -6px rgb(0 0 0 / 0.04)",
        "dashboard-card": "var(--dashboard-shadow-card)",
        "dashboard-hover": "var(--dashboard-shadow-hover)",
      },
      transitionTimingFunction: {
        premium: "var(--dashboard-ease)",
      },
      transitionDuration: {
        premium: "var(--dashboard-duration)",
      },
    },
  },
  plugins: [],
};

export default config;
