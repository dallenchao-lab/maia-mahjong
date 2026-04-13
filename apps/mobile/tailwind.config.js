/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        wood: '#8B5A2B',
        'wood-light': '#A0522D',
      }
    },
  },
  plugins: [],
}
