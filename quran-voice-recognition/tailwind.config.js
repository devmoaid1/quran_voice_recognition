/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#51AC82', // Define your primary color here
        'primary-hover': '#51AC82', // Define hover color
      },
    },
  },
  plugins: [],
}
