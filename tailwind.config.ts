import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--surface-0)",
        foreground: "var(--text-primary)",
        card: {
          DEFAULT: "var(--surface-2)",
          foreground: "var(--text-primary)",
        },
        popover: {
          DEFAULT: "var(--surface-2)",
          foreground: "var(--text-primary)",
        },
        primary: {
          DEFAULT: "var(--accent)",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "var(--surface-1)",
          foreground: "var(--text-secondary)",
        },
        muted: {
          DEFAULT: "var(--surface-1)",
          foreground: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "var(--red)",
          foreground: "#FFFFFF",
        },
        border: "var(--border)",
        input: "var(--border)",
        ring: "var(--accent)",
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "6px",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
