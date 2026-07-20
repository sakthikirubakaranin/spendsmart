/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#07070f',
        surface: '#0e0e1a',
        card: '#13131f',
        border: '#1e1e30',
        accent: {
          purple: '#8b5cf6',
          cyan: '#06b6d4',
          green: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
