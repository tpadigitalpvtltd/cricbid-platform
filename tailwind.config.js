/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cricket: {
          dark: '#080d1a',
          card: '#0f172a',
          cardBorder: '#1e293b',
          gold: '#f59e0b',
          goldLight: '#fbbf24',
          neon: '#10e87b',
          neonHover: '#05c765',
          navy: '#0a1128',
          accent: '#1e3a8a',
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-rajdhani)', 'sans-serif'],
      },
      boxShadow: {
        'neon-glow': '0 0 25px -5px rgba(16, 232, 123, 0.4)',
        'gold-glow': '0 0 25px -5px rgba(245, 158, 11, 0.4)',
        'card-glow': '0 10px 30px -10px rgba(0, 0, 0, 0.7)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      }
    },
  },
  plugins: [],
};
