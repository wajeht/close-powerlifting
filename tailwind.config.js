/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/views/**/*.{html,js}'],
  theme: {
    extend: {},
  },
  plugins: [
    {
      tailwindcss: {},
      autoprefixer: {},
    },
  ],
};
