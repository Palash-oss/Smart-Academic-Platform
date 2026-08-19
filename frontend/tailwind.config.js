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
        ink: '#F9F9F8',
        paper: '#0A0A0B',
        surface: '#FFFFFF',
        'surface-hover': '#F4F4F5',
        border: '#E4E4E7',
        'border-strong': '#18181B',
        subtle: '#71717A',
      },
      fontFamily: {
        serif: ['Lora', 'Source Serif 4', 'Georgia', 'serif'],
        sans: ['Inter', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
