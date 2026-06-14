module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        nvidia: {
          50:  '#f4fae6',
          100: '#e5f4c0',
          200: '#c8e87a',
          300: '#a8d840',
          400: '#8cc818',
          500: '#76b900',  // NVIDIA brand green
          600: '#5e9300',
          700: '#456d00',
          800: '#2d4800',
          900: '#162300',
        },
        status: {
          running:   '#22c55e',
          idle:      '#64748b',
          down:      '#ef4444',
          delayed:   '#f97316',
          blocked:   '#6b7280',
          scheduled: '#3b82f6',
          warning:   '#f59e0b',
          critical:  '#dc2626',
        }
      }
    }
  },
  plugins: [],
}
