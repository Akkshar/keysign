/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: {
    relative: true,            // resolve globs against this file, not the shell cwd
    files: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  },
  theme: {
    extend: {
      colors: {
        'primary': {
          DEFAULT: '#1d4ed8',
          dark: '#3b82f6',
          container: '#1d4ed8',
          'on-container': '#cad3ff',
          fixed: '#dce1ff',
          'fixed-dim': '#b7c4ff',
        },
        'secondary': {
          DEFAULT: '#059669',
          dark: '#10b981',
          container: '#82f5c1',
          'on-container': '#00714e',
          fixed: '#85f8c4',
          'fixed-dim': '#68dba9',
        },
        'tertiary': {
          DEFAULT: '#d97706',
          dark: '#f59e0b',
          container: '#8d4b00',
          'on-container': '#ffcba3',
          fixed: '#ffdcc3',
        },
        'error': {
          DEFAULT: '#dc2626',
          dark: '#ef4444',
          container: '#ffdad6',
          'on-container': '#93000a',
        },
        'surface': {
          DEFAULT: 'var(--surface)',
          dim: 'var(--surface-dim)',
          bright: 'var(--surface-bright)',
          'container-lowest': 'var(--surface-container-lowest)',
          'container-low': 'var(--surface-container-low)',
          container: 'var(--surface-container)',
          'container-high': 'var(--surface-container-high)',
          'container-highest': 'var(--surface-container-highest)',
        },
        'on-surface': 'var(--on-surface)',
        'on-surface-variant': 'var(--on-surface-variant)',
        'outline': 'var(--outline)',
        'outline-variant': 'var(--outline-variant)',
        'background': 'var(--background)',
        'on-background': 'var(--on-background)',
        'brand': {
          50: '#F5F7FF',
          100: '#EBF0FE',
          500: '#4F46E5',
          600: '#4338CA',
        },
      },
      // Three Fontshare families, served from public/fonts. Utilities and the
      // base rules in index.css must agree, because a utility outranks the
      // element selector and a mismatch shows up as one stray paragraph.
      fontFamily: {
        sans: ['Chillax', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
        body: ['Chillax', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
        headline: ['Chillax', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
        serif: ['Zodiak', 'Georgia', 'Cambria', 'serif'],
        display: ['Boska', 'Zodiak', 'Georgia', 'serif'],
        telemetry: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'Consolas', 'monospace'],
      },
      spacing: {
        'space-2xs': '0.125rem',
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '0.75rem',
        'space-base': '1rem',
        'space-lg': '1.25rem',
        'space-xl': '1.5rem',
        'space-2xl': '2rem',
        'space-3xl': '2.5rem',
        'space-4xl': '3rem',
        'sidebar-width-expanded': '16.25rem',
        'sidebar-width-collapsed': '4.25rem',
        'max-content-width': '90rem',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px',
      },
    },
  },
  plugins: [],
}
