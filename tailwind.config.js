/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          50: '#e8ecf5',
          100: '#d1d9eb',
          200: '#b8c4dd',
          300: '#9fb0cf',
          400: '#7a95c1',
          500: '#4a6ab1', // Main brand color rgb(74, 106, 177)
          600: '#4a6ab1', // Same as 500
          700: '#3d5a95', // Darker for hover
          800: '#304a79',
          900: '#233a5d',
        },
        primary: {
          50: '#e8ecf5',
          100: '#d1d9eb',
          200: '#b8c4dd',
          300: '#9fb0cf',
          400: '#7a95c1',
          500: '#4a6ab1', // Main brand color rgb(74, 106, 177)
          600: '#4a6ab1', // Same as 500
          700: '#3d5a95', // Darker for hover
          800: '#304a79',
          900: '#233a5d',
        },
      },
    },
  },
  plugins: [],
}

