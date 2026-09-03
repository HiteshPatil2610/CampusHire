/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent:     { DEFAULT: '#D85A30', dark: '#712B13', light: '#FAECE7' },
        teal:       { DEFAULT: '#0F6E56', light: '#E1F5EE' },
        amber:      { DEFAULT: '#854F0B', light: '#FAEEDA' },
        danger:     { DEFAULT: '#A32D2D', light: '#FCEBEB' },
        purple:     { DEFAULT: '#534AB7', light: '#EEEDFE' },
        surface:    { 0: '#FAF9F5', 1: '#F1EFE7', 2: '#FFFFFF' },
        border:     { DEFAULT: '#E6E4DA', strong: '#D2D0C4' },
        text:       { primary: '#1C1C1A', secondary: '#6B6A63', muted: '#9B9A92' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
  plugins: [],
}
