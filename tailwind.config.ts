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
        // Standard Tailwind-compatible color names
        background: "var(--surface-0)",
        foreground: "var(--text-primary)",
        
        // Surface hierarchy
        surface: {
          0: "var(--surface-0)", // Page background
          1: "var(--surface-1)", // Sunken/recessed areas
          2: "var(--surface-2)", // Elevated surfaces (cards, modals)
        },
        
        // Text hierarchy
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        
        // Brand accent (terracotta)
        accent: {
          DEFAULT: "var(--accent)",
          dark: "var(--accent-dark)",
          light: "var(--accent-light)",
          foreground: "#FFFFFF",
        },
        
        // Semantic status colors
        teal: {
          DEFAULT: "var(--teal)",
          light: "var(--teal-light)",
        },
        amber: {
          DEFAULT: "var(--amber)",
          light: "var(--amber-light)",
        },
        red: {
          DEFAULT: "var(--red)",
          light: "var(--red-light)",
        },
        purple: {
          DEFAULT: "var(--purple)",
          light: "var(--purple-light)",
        },
        
        // Green for success states (not in tokens.css but used in UI)
        green: {
          DEFAULT: "#0F6E56", // Same as teal
          light: "#E1F5EE",
        },
        
        // Borders
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        
        // Standard Tailwind semantic colors
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
        destructive: {
          DEFAULT: "var(--red)",
          foreground: "#FFFFFF",
        },
        input: "var(--border)",
        ring: "var(--accent)",
      },
      
      borderRadius: {
        DEFAULT: "var(--radius)", // 8px
        sm: "var(--radius-sm)", // 4px
        md: "var(--radius-md)", // 10px
        lg: "var(--radius-lg)", // 12px
        xl: "var(--radius-xl)", // 14px
        "2xl": "var(--radius-2xl)", // 16px
        full: "var(--radius-pill)", // 9999px
      },
      
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      
      transitionTimingFunction: {
        "admin": "var(--ease-admin)", // cubic-bezier(0.22, 1, 0.36, 1)
        "student": "var(--ease-student)", // cubic-bezier(0.34, 1.56, 0.64, 1)
      },
      
      spacing: {
        "sidebar": "var(--sidebar-width)", // 220px
      },
    },
  },
  plugins: [],
};

export default config;
