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
        background: "var(--background)",
        foreground: "var(--foreground)",
        indigo: {
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
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
export default config;
