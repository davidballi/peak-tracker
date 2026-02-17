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
        'border-elevated': '#30363d',
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
        sans: ['-apple-system', 'SF Pro Display', 'SF Pro Text', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        modal: '0 8px 30px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4)',
        nav: '0 -1px 8px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}
