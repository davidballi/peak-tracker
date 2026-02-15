/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0d1117',
        card: '#161b22',
        input: '#0d1117',
        border: '#21262d',
        'border-focus': '#f5a623',
        accent: '#f5a623',
        text: '#c9d1d9',
        bright: '#e6edf3',
        muted: '#8b949e',
        dim: '#636e72',
        faint: '#484f58',
        tech: '#e94560',
        absolute: '#f5a623',
        superset: '#4a6fa5',
        accessory: '#636e72',
        success: '#2ea043',
        danger: '#e94560',
      },
      fontFamily: {
        mono: ['SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
