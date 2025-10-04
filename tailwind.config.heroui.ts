import type { Config } from 'tailwindcss';
const {heroui} = require("@heroui/theme");

// Minimal config with ONLY HeroUI to test if it works
const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [heroui()],
};

export default config;