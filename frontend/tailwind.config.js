/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // High-energy technical brand orange (ChainGPT Labs aesthetic)
        brand: {
          50:  '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#FF5500', // Primary Accent
          600: '#E64D00',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        primary: {
          50:  '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#FF5500',
          600: '#E64D00',
          700: '#C2410C',
          800: '#18181B',
          900: '#09090B',
        },
        // Technical architectural palette
        tech: {
          canvas:  '#ECECEE',
          surface: '#FFFFFF',
          panel:   '#F4F4F6',
          border:  '#E4E4E7',
          dark:    '#09090B',
          muted:   '#71717A',
        },
        // Status colors
        danger: {
          50:  '#FEF2F2',
          100: '#FEE2E2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
        success: {
          50:  '#F0FDF4',
          100: '#DCFCE7',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },
        warning: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
        },
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      borderRadius: {
        'xs':  '0.25rem',
        'sm':  '0.375rem',
        'md':  '0.5rem',
        'lg':  '0.75rem',
        'xl':  '1rem',
      },
      boxShadow: {
        'tech': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        'tech-md': '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
        'orange': '0 4px 14px 0 rgba(255, 85, 0, 0.35)',
      },
      keyframes: {
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.4s ease-out forwards',
        'blink': 'blink 0.8s infinite',
      },
    },
  },
  plugins: [],
}
