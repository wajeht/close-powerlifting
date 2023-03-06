/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');
module.exports = {
  content: ['./src/views/**/*.{html,js}'],
  important: true,
  theme: {
    screens: {
      xs: '475px',
      ...defaultTheme.screens,
    },
    extend: {},
  },
  plugins: [
    {
      tailwindcss: {},
      autoprefixer: {},
    },
  ],
};
