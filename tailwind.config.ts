import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        doings: {
          purple:      '#6b2d82',
          'purple-dark': '#1e0e2e',
          'purple-mid':  '#3d1a47',
          'purple-light': '#e8d9f0',
          'purple-pale':  '#f0eaf5',
          bg:          '#f5f4f8',
          text:        '#0a0a0f',
          muted:       '#606070',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.5s cubic-bezier(0.4,0,0.6,1) infinite',
        'wave': 'wave 1s ease-in-out infinite alternate',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%':       { transform: 'scale(1.15)', opacity: '0.4' },
        },
        wave: {
          '0%':   { transform: 'scaleY(0.3)' },
          '100%': { transform: 'scaleY(1)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
