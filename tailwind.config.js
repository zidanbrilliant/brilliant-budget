/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
        },
        cute: {
          bg: '#fff5f7',
          card: '#ffffff',
          border: '#ffe4e6',
          primary: '#fb7185',
          accent: '#f43f5e',
          text: '#37131d',
          muted: '#884b5c',
        },
        surface: {
          light: '#f8fafc',
          card: '#ffffff',
          dark: '#0b0f19',
          darkCard: '#151e2e',
        }
      },
      borderRadius: {
        'ios-sheet': '28px',
        'ios-card': '20px',
        'ios-inner': '14px',
        'ios-pill': '9999px',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Rounded"',
          '"SF Pro Text"',
          '"Outfit"',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      }
    },
  },
  plugins: [],
};
