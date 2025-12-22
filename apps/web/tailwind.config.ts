import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        theme: {
          bg: {
            primary: 'var(--theme-bg-primary)',
            secondary: 'var(--theme-bg-secondary)',
          },
          text: {
            primary: 'var(--theme-text-primary)',
          },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
