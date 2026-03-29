import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
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
