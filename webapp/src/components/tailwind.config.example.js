/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Cascadia Code', 'Consolas', 'Courier New', 'monospace'],
      },
      colors: {
        // Azure Brand Colors
        'azure-blue': '#0078d4',
        'azure-blue-hover': '#106ebe',
        'azure-blue-dark': '#005a9e',

        // Gray Scale (Microsoft Design)
        'gray-900': '#323130',
        'gray-800': '#605e5c',
        'gray-700': '#797775',
        'gray-600': '#8a8886',
        'gray-500': '#a19f9d',
        'gray-400': '#c8c6c4',
        'gray-300': '#d2d0ce',
        'gray-200': '#e5e5e5',
        'gray-100': '#f3f2f1',
        'gray-50': '#faf9f8',

        // Status Colors
        'success-green': '#107c10',
        'warning-yellow': '#ffc83d',
        'error-red': '#e81123',
      },
      typography: (theme) => ({
        azure: {
          css: {
            '--tw-prose-body': theme('colors.gray-800'),
            '--tw-prose-headings': theme('colors.gray-900'),
            '--tw-prose-lead': theme('colors.gray-700'),
            '--tw-prose-links': theme('colors.azure-blue'),
            '--tw-prose-bold': theme('colors.gray-900'),
            '--tw-prose-counters': theme('colors.gray-600'),
            '--tw-prose-bullets': theme('colors.gray-400'),
            '--tw-prose-hr': theme('colors.gray-300'),
            '--tw-prose-quotes': theme('colors.gray-800'),
            '--tw-prose-quote-borders': theme('colors.azure-blue'),
            '--tw-prose-captions': theme('colors.gray-700'),
            '--tw-prose-code': '#d73a49',
            '--tw-prose-pre-code': theme('colors.gray-800'),
            '--tw-prose-pre-bg': theme('colors.gray-50'),
            '--tw-prose-th-borders': theme('colors.gray-300'),
            '--tw-prose-td-borders': theme('colors.gray-200'),
            maxWidth: 'none',
          },
        },
      }),
      animation: {
        'spin': 'spin 1s linear infinite',
      },
      keyframes: {
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
