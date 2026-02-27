/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
      },
      colors: {
        theme: 'var(--theme-color)',
        page: 'var(--bg-color)',
        surface: 'var(--surface-color)',
        font: 'var(--font-color)',
        divider: 'var(--divider-color)',
        inputbg: 'var(--input-bg)',
        inputborder: 'var(--input-border)',
        cardhover: 'var(--card-hover)',
        badgebg: 'var(--badge-bg)',
        teal: {
          50:  '#e6f4f7',
          100: '#b3dde6',
          200: '#80c6d5',
          300: '#4dafc4',
          400: '#2698b3',
          500: '#006080',
          600: '#005570',
          700: '#004a60',
          800: '#003f50',
          900: '#002d3a',
          950: '#001d26',
        },
      },
    },
  },
  plugins: [],
};
