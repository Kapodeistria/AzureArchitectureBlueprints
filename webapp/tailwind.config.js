/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Cascadia Code', 'Consolas', 'Courier New', 'monospace'],
      },
      colors: {
        'azure-blue': '#0078d4',
        'azure-blue-hover': '#106ebe',
        'gray-900': '#323130',
        'gray-800': '#605e5c',
        'gray-700': '#797775',
      },
      typography: (theme) => ({
        azure: {
          css: {
            '--tw-prose-body': theme('colors.gray-800'),
            '--tw-prose-headings': theme('colors.gray-900'),
            '--tw-prose-links': theme('colors.azure-blue'),
            '--tw-prose-code': '#d73a49',
            maxWidth: 'none',
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
