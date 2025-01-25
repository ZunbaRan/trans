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
        'morandi': {
          blue: 'rgb(var(--morandi-blue-rgb))',
          green: 'rgb(var(--morandi-green-rgb))',
          gray: 'rgb(var(--morandi-gray-rgb))',
          beige: 'rgb(var(--morandi-beige-rgb))',
          brown: 'rgb(var(--morandi-brown-rgb))',
        }
      },
      backgroundColor: {
        'morandi-green-light': 'rgba(var(--morandi-green-rgb), 0.15)',
        'morandi-green-soft': 'rgba(var(--morandi-green-rgb), 0.25)',
        'morandi-blue-light': 'rgba(var(--morandi-blue-rgb), 0.15)',
        'morandi-blue-soft': 'rgba(var(--morandi-blue-rgb), 0.25)',
        'morandi-brown-light': 'rgba(var(--morandi-brown-rgb), 0.15)',
        'morandi-gray-light': 'rgba(var(--morandi-gray-rgb), 0.15)',
      }
    },
  },
  plugins: [],
  safelist: [
    {
      pattern: /^(bg|text|border)-(morandi)-(blue|green|gray|beige|brown)/,
      variants: ['hover', 'focus', 'active', 'disabled'],
    },
    {
      pattern: /^bg-morandi-(blue|green|brown|gray)-(light|soft)/,
    },
  ]
} 