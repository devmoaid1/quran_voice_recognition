/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#234F54', // Define your primary color here
        'primary-hover': '#193A3D', // Define hover color
        'social-media-hover': '#406769',
      },
    },
  },
  plugins: [],
}
