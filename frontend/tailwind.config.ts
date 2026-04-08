import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50:  '#EBF7FB',
          100: '#C7E7F0',
          200: '#87CDE0',
          300: '#48B6D3',
          400: '#249EBD',
          500: '#1D86A4',
          600: '#19708C',
          700: '#14546C',
          800: '#0E3C4E',
          900: '#082530',
          950: '#041318',
        },
        surface: '#F7F8FA',
        'surface-alt': '#FAFBFC',
      },
      boxShadow: {
        'card': '0 1px 4px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.06)',
        'glow': '0 2px 8px rgba(25, 112, 140, 0.2)',
        'glow-lg': '0 8px 24px rgba(25, 112, 140, 0.2)',
      },
      borderRadius: {
        'radius-sm': '5px',
        'radius-md': '10px',
        'radius-lg': '12px',
        'radius-xl': '14px',
        'radius-2xl': '16px',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
export default config;
