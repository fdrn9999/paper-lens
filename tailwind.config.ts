import type { Config } from 'tailwindcss';

/**
 * Neutral + accent-tint colors are aliased to CSS variables (defined in globals.css)
 * so the whole UI adapts to dark mode via the `.dark` class (D-01/D-03). The light
 * values equal Tailwind's original palette, so light mode is unchanged. Only shades
 * with a single visual role are aliased: the gray ramp, `surface` (replaces bg-white),
 * and accent 50/100 (used only as tinted backgrounds/borders). Accent 500-700 stay
 * on Tailwind defaults because they double as button fills where white text must read.
 */
const withVar = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: withVar('--surface'),
        gray: {
          50: withVar('--gray-50'),
          100: withVar('--gray-100'),
          200: withVar('--gray-200'),
          300: withVar('--gray-300'),
          400: withVar('--gray-400'),
          500: withVar('--gray-500'),
          600: withVar('--gray-600'),
          700: withVar('--gray-700'),
          800: withVar('--gray-800'),
          900: withVar('--gray-900'),
        },
        blue: { 50: withVar('--blue-50'), 100: withVar('--blue-100') },
        purple: { 50: withVar('--purple-50'), 100: withVar('--purple-100') },
        emerald: { 50: withVar('--emerald-50'), 100: withVar('--emerald-100') },
        red: { 50: withVar('--red-50'), 100: withVar('--red-100') },
        amber: { 50: withVar('--amber-50') },
        indigo: { 50: withVar('--indigo-50') },
        highlight: {
          DEFAULT: 'rgba(255, 213, 0, 0.4)',
          current: 'rgba(255, 100, 0, 0.5)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
