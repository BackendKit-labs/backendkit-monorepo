import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#05050a',
        'primary-blue': '#4f7eff',
        'primary-purple': '#6d4aff',
        'text-primary': '#ffffff',
        'text-secondary': '#e2e8f0',
        'text-muted': '#94a3b8',
        'surface': '#0d1117',
        'surface-elevated': '#161b22',
        'border': 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #4f7eff, #6d4aff)',
        'gradient-radial-blue': 'radial-gradient(ellipse at 20% 50%, rgba(79,126,255,0.15) 0%, transparent 60%)',
        'gradient-radial-purple': 'radial-gradient(ellipse at 80% 50%, rgba(109,74,255,0.15) 0%, transparent 60%)',
        'gradient-hero': 'radial-gradient(ellipse at 50% 0%, rgba(79,126,255,0.12) 0%, transparent 70%)',
        'gradient-noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'border-flow': 'borderFlow 4s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        borderFlow: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      boxShadow: {
        'glow-blue': '0 0 40px rgba(79,126,255,0.3)',
        'glow-purple': '0 0 40px rgba(109,74,255,0.3)',
        'card': '0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(79,126,255,0.2)',
      },
    },
  },
  plugins: [],
};

export default config;
