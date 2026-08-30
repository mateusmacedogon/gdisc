/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gdisc: {
          bg: {
            primary: '#0B0D12',
            secondary: '#11141B',
            card: '#171B24',
            hover: '#202532',
            active: '#282E3E',
          },
          brand: {
            primary: 'var(--color-brand-primary, #6C63FF)',
            secondary: 'var(--color-brand-secondary, #8B85FF)',
            glow: 'var(--color-brand-glow, rgba(108, 99, 255, 0.25))',
          },
          text: {
            primary: '#F5F7FA',
            secondary: '#9AA4B2',
            muted: '#636D7E',
          },
          status: {
            online: '#35D07F',
            idle: '#FFAE33',
            dnd: '#FF5C70',
            offline: '#636D7E',
          },
          danger: '#FF5C70',
          success: '#35D07F',
          warning: '#FFAE33',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'gdisc-subtle': '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
        'gdisc-glow': '0 0 15px rgba(108, 99, 255, 0.35)',
        'gdisc-speaking': '0 0 0 2px #35D07F, 0 0 16px rgba(53, 208, 127, 0.5)',
      },
      animation: {
        'pulse-subtle': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 150ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      }
    },
  },
  plugins: [],
}
