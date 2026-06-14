module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        nvidia: {
          50: '#f2f7f3',
          100: '#e6efe7',
          200: '#bfe0c8',
          300: '#99d1aa',
          400: '#4fb36c',
          500: '#2aa64f',
          600: '#20813f',
          700: '#175f2f',
          800: '#0f3d1f',
          900: '#07190b'
        }
      }
    }
  },
  plugins: [],
}
