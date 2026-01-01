/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");
module.exports = {
  content: ["./src/routes/**/*.{html,js}"],
  important: true,
  theme: {
    screens: {
      xs: "475px",
      ...defaultTheme.screens,
    },
    extend: {},
  },
  plugins: [],
};
