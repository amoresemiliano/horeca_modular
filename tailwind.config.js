/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'criollo-dark': '#1a1a1a',
        'criollo-gold': '#d4af37',
      }
    },
  },
  plugins: [],
}